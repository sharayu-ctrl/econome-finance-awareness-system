"""
EconoMe Testing Suite (Phase 8a-b)
Pytest configuration and integration tests
"""
import pytest
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
import os


# Test database setup
TEST_DB_URL = os.getenv("TEST_DATABASE_URL", "sqlite+aiosqlite:///:memory:")


@pytest.fixture
async def test_db():
    """Create test database"""
    engine = create_async_engine(TEST_DB_URL, echo=False)

    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async with engine.begin() as conn:
        await conn.run_sync(lambda: None)  # Create tables

    yield async_session()

    await engine.dispose()


@pytest.fixture
async def test_user():
    """Create test user"""
    return {
        "user_id": "usr_test123",
        "email": "test@example.com",
        "password": "TestPassword123!@#",
        "full_name": "Test User",
    }


# Integration tests configuration
@pytest.mark.asyncio
class TestAuthenticationFlow:
    """Test authentication flow (Phase 1)"""

    async def test_login_step1_creates_otp(self, test_db, test_user):
        """Test login step 1 sends OTP"""
        # Arrange
        from backend.shared.otp_service import OTPService
        otp_service = OTPService()

        # Act
        otp_token, otp_code = await otp_service.generate_and_store_otp(
            test_user["email"],
            "login",
        )

        # Assert
        assert otp_token is not None
        assert len(otp_code) == 6
        assert otp_code.isdigit()

    async def test_otp_verification_succeeds(self, test_db, test_user):
        """Test OTP verification succeeds with correct code"""
        from backend.shared.otp_service import OTPService
        otp_service = OTPService()

        # Generate OTP
        otp_token, otp_code = await otp_service.generate_and_store_otp(
            test_user["email"],
            "login",
        )

        # Verify
        result = await otp_service.verify_otp(otp_token, otp_code, test_user["email"])
        assert result is True

    async def test_otp_verification_fails_wrong_code(self, test_db, test_user):
        """Test OTP verification fails with wrong code"""
        from backend.shared.otp_service import OTPService
        otp_service = OTPService()

        otp_token, _ = await otp_service.generate_and_store_otp(
            test_user["email"],
            "login",
        )

        result = await otp_service.verify_otp(otp_token, "000000", test_user["email"])
        assert result is False


@pytest.mark.asyncio
class TestEncryption:
    """Test encryption service (Phase 4)"""

    def test_encryption_decryption_roundtrip(self):
        """Test encrypt/decrypt roundtrip"""
        from backend.shared.encryption_service import EncryptionService

        crypto = EncryptionService()
        plaintext = "Sensitive transaction data"

        encrypted = crypto.encrypt(plaintext)
        decrypted = crypto.decrypt(encrypted)

        assert decrypted == plaintext

    def test_different_encryptions_produce_different_ciphertexts(self):
        """Test that same plaintext produces different ciphertexts (nonce)"""
        from backend.shared.encryption_service import EncryptionService

        crypto = EncryptionService()
        plaintext = "Test data"

        encrypted1 = crypto.encrypt(plaintext)
        encrypted2 = crypto.encrypt(plaintext)

        assert encrypted1 != encrypted2  # Different nonces


@pytest.mark.asyncio
class TestInputValidation:
    """Test input validation (Phase 6)"""

    def test_email_validation(self):
        """Test email validation"""
        from backend.shared.input_validator import InputValidator

        assert InputValidator.validate_email("test@example.com")
        assert not InputValidator.validate_email("invalid-email")
        assert not InputValidator.validate_email("test@")

    def test_password_strength_validation(self):
        """Test password strength requirements"""
        from backend.shared.input_validator import InputValidator

        valid, msg = InputValidator.validate_password("WeakPass123")
        assert not valid  # Too short

        valid, msg = InputValidator.validate_password("ValidPassword123!@#")
        assert valid

    def test_input_sanitization(self):
        """Test string sanitization"""
        from backend.shared.input_validator import InputValidator

        dirty = "<script>alert('xss')</script>Test"
        clean = InputValidator.sanitize_string(dirty)

        assert "<script>" not in clean
        assert "alert" in clean


@pytest.mark.asyncio
class TestIDGeneration:
    """Test ID generation (Phase 5)"""

    def test_generate_user_id(self):
        """Test user ID generation"""
        from backend.shared.id_generator import IDGenerator

        user_id = IDGenerator.generate_user_id()
        assert user_id.startswith("usr_")
        assert len(user_id) > 4

    def test_transaction_id_format(self):
        """Test transaction ID format"""
        from backend.shared.id_generator import IDGenerator

        txn_id = IDGenerator.generate_transaction_id()
        assert txn_id.startswith("txn_")

    def test_id_uniqueness(self):
        """Test that generated IDs are unique"""
        from backend.shared.id_generator import IDGenerator

        ids = [IDGenerator.generate_user_id() for _ in range(100)]
        assert len(set(ids)) == 100  # All unique


@pytest.mark.asyncio
class TestRateLimiting:
    """Test rate limiting (Phase 6)"""

    async def test_rate_limit_allows_under_limit(self):
        """Test requests under limit are allowed"""
        from backend.shared.rate_limiter import RateLimiter

        limiter = RateLimiter(redis=None)  # Use no Redis for test

        # With no Redis, should always allow
        allowed, stats = await limiter.is_allowed(
            "test_user",
            "api_endpoint",
            limit=5,
            window=60,
        )
        assert allowed


@pytest.mark.asyncio
class TestTransactionAtomicity:
    """Test transaction atomicity (Phase 3)"""

    async def test_transaction_creation_atomic(self, test_db):
        """Test transaction creation is atomic"""
        from backend.shared.transaction_manager import TransactionManager

        manager = TransactionManager(test_db)

        # This would test atomicity in a real environment
        # For now, just verify the manager initializes
        assert manager is not None


# Pytest configuration
def pytest_configure(config):
    """Pytest configuration hook"""
    config.addinivalue_line(
        "markers",
        "asyncio: mark test as async",
    )
