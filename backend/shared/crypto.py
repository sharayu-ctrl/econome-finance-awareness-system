"""
EconoMe — Cryptography Module
Phase 3 + 6: AES-256-GCM encryption/decryption for all sensitive fields.

Design:
  • Each user has a unique Data Encryption Key (DEK) derived via HKDF(SHA-256)
    from the MASTER_ENCRYPTION_KEY + user_id.
  • AES-256-GCM: 12-byte random nonce, 16-byte auth tag, base64-encoded output.
  • Format stored in DB: base64(nonce || ciphertext || tag)
  • The DB never sees plaintext financial amounts.
"""
import base64
import hashlib
import os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes
from config import settings


# ── Key Derivation ────────────────────────────────────────────────────────────

def _derive_dek(user_id: str) -> bytes:
    """
    Derive a 256-bit Data Encryption Key for a user using HKDF(SHA-256).
    The master key is loaded from settings (env var / AWS KMS in production).
    """
    master_key = settings.MASTER_ENCRYPTION_KEY.encode()
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=None,
        info=f"econome-dek-{user_id}".encode(),
    )
    return hkdf.derive(master_key)


# ── Encryption / Decryption ───────────────────────────────────────────────────

def encrypt(plaintext: str, user_id: str) -> str:
    """
    Encrypt a plaintext string for the given user.
    Returns base64(nonce[12] || ciphertext || tag[16]).
    """
    dek = _derive_dek(user_id)
    aesgcm = AESGCM(dek)
    nonce = os.urandom(12)
    ct = aesgcm.encrypt(nonce, plaintext.encode(), None)
    return base64.b64encode(nonce + ct).decode()


def decrypt(ciphertext_b64: str, user_id: str) -> str:
    """
    Decrypt a base64-encoded AES-GCM blob for the given user.
    Raises ValueError on authentication failure (tampered data).
    """
    dek = _derive_dek(user_id)
    aesgcm = AESGCM(dek)
    raw = base64.b64decode(ciphertext_b64)
    nonce, ct = raw[:12], raw[12:]
    return aesgcm.decrypt(nonce, ct, None).decode()


def encrypt_amount(amount: float, user_id: str) -> str:
    return encrypt(str(amount), user_id)


def decrypt_amount(ciphertext_b64: str, user_id: str) -> float:
    return float(decrypt(ciphertext_b64, user_id))


# ── Hashing ───────────────────────────────────────────────────────────────────

def sha256_hex(text: str) -> str:
    """SHA-256 hex digest — used for blockchain insight anchoring."""
    return hashlib.sha256(text.encode()).hexdigest()


def sha3_256_hex(text: str) -> str:
    """SHA-3-256 hex digest — used for device fingerprint hashing."""
    return hashlib.sha3_256(text.encode()).hexdigest()


def sha256_phone(phone: str) -> str:
    """Hash phone number for storage without PII exposure."""
    return hashlib.sha256(phone.strip().encode()).hexdigest()
