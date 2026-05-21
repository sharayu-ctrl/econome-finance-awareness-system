"""
EconoMe Transaction Management (Phase 3d)
Ensures atomic operations for financial transactions with automatic rollback
"""
from contextlib import asynccontextmanager
from typing import Optional, Any, Callable
from decimal import Decimal
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, and_
from loguru import logger

from modules.finance.models import Transaction, Account, Budget
from shared.redis_client import redis_client


class TransactionManager:
    """Manage financial operations with ACID guarantees"""

    def __init__(self, db_session: AsyncSession):
        self.db_session = db_session
        self.operations: list[dict[str, Any]] = []
        self.is_rolled_back = False

    async def create_transaction(
        self,
        user_id: str,
        account_id: str,
        amount: Decimal,
        category: str,
        description: str,
        transaction_type: str = "expense",
    ) -> Optional[Transaction]:
        """
        Create a new transaction with automatic account balance update
        Ensures atomicity: both transaction and account update succeed or both fail
        """
        try:
            # Start transaction
            logger.info(f"📝 Creating transaction: {amount} {category}")

            # 1. Create transaction record
            new_transaction = Transaction(
                user_id=user_id,
                account_id=account_id,
                amount=amount,
                category=category,
                description=description,
                transaction_type=transaction_type,
                created_at=datetime.utcnow(),
                status="completed",
            )
            self.db_session.add(new_transaction)
            await self.db_session.flush()  # Get ID without committing

            # 2. Update account balance
            account = await self.db_session.get(Account, account_id)
            if not account:
                raise ValueError(f"Account {account_id} not found")

            # Verify sufficient balance for expenses
            if transaction_type == "expense" and account.balance < amount:
                raise ValueError(
                    f"Insufficient balance: {account.balance} < {amount}"
                )

            # Update balance based on type
            if transaction_type == "expense":
                account.balance -= amount
                logger.info(f"💸 Debited: {amount}, New balance: {account.balance}")
            else:  # income or transfer
                account.balance += amount
                logger.info(f"💰 Credited: {amount}, New balance: {account.balance}")

            account.updated_at = datetime.utcnow()
            await self.db_session.flush()

            # 3. Update budget if applicable
            if transaction_type == "expense":
                budget = await self.db_session.execute(
                    select(Budget).where(
                        and_(
                            Budget.user_id == user_id,
                            Budget.category == category,
                        )
                    )
                )
                budget = budget.scalar_one_or_none()
                if budget:
                    budget.spent += amount
                    budget.updated_at = datetime.utcnow()
                    await self.db_session.flush()
                    logger.info(f"📊 Budget updated: {category} spent: {budget.spent}")

            # 4. Commit transaction
            await self.db_session.commit()
            logger.info(f"✅ Transaction committed: {new_transaction.id}")

            # 5. Invalidate cache
            await self._invalidate_caches(user_id, account_id)

            return new_transaction

        except Exception as e:
            await self.db_session.rollback()
            logger.error(f"❌ Transaction failed: {e}")
            raise

    async def transfer_between_accounts(
        self,
        user_id: str,
        from_account_id: str,
        to_account_id: str,
        amount: Decimal,
        description: str = "Transfer",
    ) -> dict[str, Any]:
        """
        Transfer money between accounts
        ACID guarantee: both debit and credit succeed or both fail
        """
        try:
            logger.info(
                f"🔄 Transfer: {amount} from {from_account_id} to {to_account_id}"
            )

            # Get both accounts
            from_account = await self.db_session.get(Account, from_account_id)
            to_account = await self.db_session.get(Account, to_account_id)

            if not from_account or not to_account:
                raise ValueError("One or both accounts not found")

            if from_account.user_id != user_id or to_account.user_id != user_id:
                raise PermissionError("Cannot transfer to other user's accounts")

            if from_account.balance < amount:
                raise ValueError(f"Insufficient balance in source account")

            # 1. Create debit transaction
            debit_tx = Transaction(
                user_id=user_id,
                account_id=from_account_id,
                amount=amount,
                category="transfer_out",
                description=f"Transfer to {to_account.name}",
                transaction_type="transfer_out",
                status="completed",
            )
            self.db_session.add(debit_tx)

            # 2. Create credit transaction
            credit_tx = Transaction(
                user_id=user_id,
                account_id=to_account_id,
                amount=amount,
                category="transfer_in",
                description=f"Transfer from {from_account.name}",
                transaction_type="transfer_in",
                status="completed",
            )
            self.db_session.add(credit_tx)

            await self.db_session.flush()

            # 3. Update account balances atomically
            from_account.balance -= amount
            to_account.balance += amount
            from_account.updated_at = datetime.utcnow()
            to_account.updated_at = datetime.utcnow()

            await self.db_session.flush()

            # 4. Commit
            await self.db_session.commit()
            logger.info(f"✅ Transfer committed successfully")

            # 5. Invalidate caches
            await self._invalidate_caches(user_id, from_account_id)
            await self._invalidate_caches(user_id, to_account_id)

            return {
                "debit_transaction_id": debit_tx.id,
                "credit_transaction_id": credit_tx.id,
                "from_balance": from_account.balance,
                "to_balance": to_account.balance,
            }

        except Exception as e:
            await self.db_session.rollback()
            logger.error(f"❌ Transfer failed: {e}")
            raise

    async def revert_transaction(self, transaction_id: str, user_id: str):
        """
        Revert a transaction (e.g., refund) with atomic rollback
        """
        try:
            logger.info(f"⏮️  Reverting transaction: {transaction_id}")

            # Get original transaction
            original_tx = await self.db_session.get(Transaction, transaction_id)
            if not original_tx or original_tx.user_id != user_id:
                raise ValueError("Transaction not found or unauthorized")

            if original_tx.status == "reverted":
                raise ValueError("Transaction already reverted")

            # Get account
            account = await self.db_session.get(Account, original_tx.account_id)
            if not account:
                raise ValueError("Account not found")

            # Create reverse transaction
            reverse_amount = -original_tx.amount
            reverse_tx = Transaction(
                user_id=user_id,
                account_id=original_tx.account_id,
                amount=reverse_amount,
                category=original_tx.category,
                description=f"Reversal of {original_tx.id}",
                transaction_type="reversal",
                status="completed",
            )
            self.db_session.add(reverse_tx)

            # Update account balance (reverse the original amount)
            if original_tx.transaction_type == "expense":
                account.balance += original_tx.amount
            else:
                account.balance -= original_tx.amount

            # Mark original as reverted
            original_tx.status = "reverted"
            account.updated_at = datetime.utcnow()

            await self.db_session.flush()

            # Update budget if necessary
            if original_tx.transaction_type == "expense":
                budget = await self.db_session.execute(
                    select(Budget).where(
                        and_(
                            Budget.user_id == user_id,
                            Budget.category == original_tx.category,
                        )
                    )
                )
                budget = budget.scalar_one_or_none()
                if budget and budget.spent >= original_tx.amount:
                    budget.spent -= original_tx.amount
                    budget.updated_at = datetime.utcnow()

            await self.db_session.commit()
            logger.info(f"✅ Transaction reverted: {reverse_tx.id}")

            # Invalidate caches
            await self._invalidate_caches(user_id, original_tx.account_id)

            return reverse_tx

        except Exception as e:
            await self.db_session.rollback()
            logger.error(f"❌ Reversal failed: {e}")
            raise

    async def _invalidate_caches(self, user_id: str, account_id: str):
        """Invalidate Redis caches after transaction"""
        try:
            if not redis_client:
                return

            keys_to_delete = [
                f"transactions:{user_id}",
                f"accounts:{user_id}",
                f"account:{account_id}",
                f"analytics:{user_id}",
                f"budgets:{user_id}",
            ]

            for key in keys_to_delete:
                await redis_client.delete(key)
                logger.debug(f"🗑️  Cache invalidated: {key}")

        except Exception as e:
            logger.warning(f"Cache invalidation failed: {e}")


@asynccontextmanager
async def transaction_context(db_session: AsyncSession):
    """Context manager for transaction operations"""
    tm = TransactionManager(db_session)
    try:
        yield tm
    finally:
        if not tm.is_rolled_back:
            try:
                await db_session.commit()
            except Exception as e:
                await db_session.rollback()
                logger.error(f"Context manager commit failed: {e}")
