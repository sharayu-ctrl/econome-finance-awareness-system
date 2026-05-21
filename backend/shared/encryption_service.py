"""
EconoMe Encryption Service (Phase 4)
Field-level encryption for sensitive data using AES-256-GCM
"""
from typing import Any, Optional
import os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2
import secrets
import base64
from loguru import logger

from config import settings


class EncryptionService:
    """Encrypt/decrypt sensitive data with AES-256-GCM"""

    def __init__(self, master_key: Optional[bytes] = None):
        """Initialize with master encryption key"""
        self.master_key = master_key or self._get_master_key()

    def _get_master_key(self) -> bytes:
        """Get or generate master encryption key"""
        # In production, retrieve from AWS Secrets Manager or HashiCorp Vault
        key_env = os.getenv("ENCRYPTION_KEY")

        if not key_env:
            # Generate new key (32 bytes for AES-256)
            if settings.ENV == "production":
                raise ValueError(
                    "ENCRYPTION_KEY not set in production. "
                    "Set via environment variable or secrets vault."
                )
            logger.warning("⚠️  Generating random encryption key for development only")
            return os.urandom(32)

        # Decode from base64
        try:
            key = base64.b64decode(key_env)
            if len(key) != 32:
                raise ValueError(f"Encryption key must be 32 bytes, got {len(key)}")
            return key
        except Exception as e:
            raise ValueError(f"Invalid ENCRYPTION_KEY: {e}")

    def encrypt(self, plaintext: str) -> str:
        """
        Encrypt plaintext using AES-256-GCM
        Returns: "base64(nonce || ciphertext || tag)"
        """
        try:
            # Generate random nonce (12 bytes)
            nonce = secrets.token_bytes(12)

            # Encrypt
            cipher = AESGCM(self.master_key)
            ciphertext = cipher.encrypt(
                nonce,
                plaintext.encode(),
                None  # No additional authenticated data
            )

            # Combine nonce + ciphertext
            encrypted_data = nonce + ciphertext

            # Return as base64 for storage
            return base64.b64encode(encrypted_data).decode()
        except Exception as e:
            logger.error(f"Encryption failed: {e}")
            raise

    def decrypt(self, encrypted_data: str) -> str:
        """
        Decrypt AES-256-GCM encrypted data
        Input: base64(nonce || ciphertext || tag)
        """
        try:
            # Decode from base64
            encrypted_bytes = base64.b64decode(encrypted_data)

            # Split nonce (first 12 bytes) and ciphertext (rest)
            nonce = encrypted_bytes[:12]
            ciphertext = encrypted_bytes[12:]

            # Decrypt
            cipher = AESGCM(self.master_key)
            plaintext = cipher.decrypt(nonce, ciphertext, None)

            return plaintext.decode()
        except Exception as e:
            logger.error(f"Decryption failed: {e}")
            raise ValueError("Failed to decrypt data")

    def hash_password(self, password: str) -> str:
        """Hash password using bcrypt (already imported in auth service)"""
        import bcrypt
        salt = bcrypt.gensalt(rounds=12)
        return bcrypt.hashpw(password.encode(), salt).decode()

    def verify_password(self, password: str, hashed: str) -> bool:
        """Verify password against hash"""
        import bcrypt
        return bcrypt.checkpw(password.encode(), hashed.encode())


class SensitiveFieldsManager:
    """Manage encryption for sensitive database fields"""

    def __init__(self, encryption_service: EncryptionService):
        self.crypto = encryption_service

    def encrypt_transaction_details(self, transaction_data: dict[str, Any]) -> dict:
        """Encrypt sensitive transaction fields"""
        encrypted = transaction_data.copy()

        # Encrypt description if present
        if "description" in encrypted and encrypted["description"]:
            encrypted["description"] = self.crypto.encrypt(
                encrypted["description"]
            )
            encrypted["_description_encrypted"] = True

        return encrypted

    def decrypt_transaction_details(
        self, transaction_data: dict[str, Any]
    ) -> dict:
        """Decrypt sensitive transaction fields"""
        decrypted = transaction_data.copy()

        if decrypted.get("_description_encrypted") and "description" in decrypted:
            try:
                decrypted["description"] = self.crypto.decrypt(
                    decrypted["description"]
                )
                decrypted.pop("_description_encrypted", None)
            except Exception as e:
                logger.error(f"Failed to decrypt transaction: {e}")

        return decrypted

    def encrypt_account_details(self, account_data: dict[str, Any]) -> dict:
        """Encrypt account holder information"""
        encrypted = account_data.copy()

        # Encrypt account number/iban
        if "account_number" in encrypted and encrypted["account_number"]:
            encrypted["account_number"] = self.crypto.encrypt(
                encrypted["account_number"]
            )
            encrypted["_account_number_encrypted"] = True

        return encrypted

    def decrypt_account_details(self, account_data: dict[str, Any]) -> dict:
        """Decrypt account information"""
        decrypted = account_data.copy()

        if (
            decrypted.get("_account_number_encrypted")
            and "account_number" in decrypted
        ):
            try:
                decrypted["account_number"] = self.crypto.decrypt(
                    decrypted["account_number"]
                )
                decrypted.pop("_account_number_encrypted", None)
            except Exception as e:
                logger.error(f"Failed to decrypt account: {e}")

        return decrypted

    def encrypt_user_profile(self, user_data: dict[str, Any]) -> dict:
        """Encrypt PII fields in user profile"""
        encrypted = user_data.copy()

        # Encrypt phone number if present
        if "phone_number" in encrypted and encrypted["phone_number"]:
            encrypted["phone_number"] = self.crypto.encrypt(
                encrypted["phone_number"]
            )
            encrypted["_phone_encrypted"] = True

        # Encrypt address
        if "address" in encrypted and encrypted["address"]:
            encrypted["address"] = self.crypto.encrypt(encrypted["address"])
            encrypted["_address_encrypted"] = True

        return encrypted

    def decrypt_user_profile(self, user_data: dict[str, Any]) -> dict:
        """Decrypt user PII"""
        decrypted = user_data.copy()

        if decrypted.get("_phone_encrypted") and "phone_number" in decrypted:
            try:
                decrypted["phone_number"] = self.crypto.decrypt(
                    decrypted["phone_number"]
                )
                decrypted.pop("_phone_encrypted", None)
            except Exception as e:
                logger.error(f"Failed to decrypt phone: {e}")

        if decrypted.get("_address_encrypted") and "address" in decrypted:
            try:
                decrypted["address"] = self.crypto.decrypt(decrypted["address"])
                decrypted.pop("_address_encrypted", None)
            except Exception as e:
                logger.error(f"Failed to decrypt address: {e}")

        return decrypted


# Singleton instances
encryption_service = EncryptionService()
sensitive_fields = SensitiveFieldsManager(encryption_service)


def get_encryption_service() -> EncryptionService:
    """Get encryption service instance"""
    return encryption_service


def get_sensitive_fields_manager() -> SensitiveFieldsManager:
    """Get sensitive fields manager instance"""
    return sensitive_fields
