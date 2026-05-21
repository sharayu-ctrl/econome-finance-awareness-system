"""
EconoMe ID Generation Service (Phase 5a-b)
Scalable intelligent IDs using NanoID with customizable alphabets
"""
from nanoid import generate
from datetime import datetime
from typing import Literal


class IDGenerator:
    """Generate scalable, non-sequential, hard-to-predict IDs"""

    # Custom alphabets for different use cases
    ALPHABETS = {
        "user": "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
        "transaction": "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ",  # Uppercase only for readability
        "api_key": "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_",
        "invite": "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ",  # Shareable
        "session": "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
    }

    # ID sizes (larger = lower collision probability, slower generation)
    ID_SIZES = {
        "user": 21,  # ~170 bits
        "transaction": 16,  # ~95 bits (sufficient for financial)
        "account": 16,
        "budget": 14,
        "goal": 14,
        "insight": 14,
        "chat_room": 16,
        "api_key": 32,  # Extra long for security
        "session": 32,
        "invite": 12,  # Short, shareable
    }

    @staticmethod
    def generate(
        entity_type: Literal[
            "user",
            "transaction",
            "account",
            "budget",
            "goal",
            "insight",
            "chat_room",
            "api_key",
            "session",
            "invite",
        ],
        prefix: str = "",
    ) -> str:
        """
        Generate a NanoID for the given entity type

        Format: [prefix_]nanoID
        Example: "usr_V1StGXR_Z5j3eK", "txn_F4bnzHjYX2ks9a1m"
        """
        alphabet = IDGenerator.ALPHABETS.get(entity_type, IDGenerator.ALPHABETS["user"])
        size = IDGenerator.ID_SIZES.get(entity_type, 21)

        # Generate NanoID
        nano_id = generate(alphabet=alphabet, size=size)

        # Add prefix if provided
        if prefix:
            return f"{prefix}_{nano_id}"

        return nano_id

    @staticmethod
    def generate_user_id() -> str:
        """Generate user ID (21 chars, format: usr_XXX...)"""
        return IDGenerator.generate("user", prefix="usr")

    @staticmethod
    def generate_transaction_id() -> str:
        """Generate transaction ID (16 chars, format: txn_XXX...)"""
        return IDGenerator.generate("transaction", prefix="txn")

    @staticmethod
    def generate_account_id() -> str:
        """Generate account ID (16 chars, format: acc_XXX...)"""
        return IDGenerator.generate("account", prefix="acc")

    @staticmethod
    def generate_budget_id() -> str:
        """Generate budget ID (14 chars, format: bgt_XXX...)"""
        return IDGenerator.generate("budget", prefix="bgt")

    @staticmethod
    def generate_goal_id() -> str:
        """Generate goal ID (14 chars, format: gol_XXX...)"""
        return IDGenerator.generate("goal", prefix="gol")

    @staticmethod
    def generate_insight_id() -> str:
        """Generate insight ID (14 chars, format: ins_XXX...)"""
        return IDGenerator.generate("insight", prefix="ins")

    @staticmethod
    def generate_chat_room_id() -> str:
        """Generate chat room ID (16 chars, format: chr_XXX...)"""
        return IDGenerator.generate("chat_room", prefix="chr")

    @staticmethod
    def generate_api_key() -> str:
        """Generate API key (32 chars, no prefix, extra long for security)"""
        return IDGenerator.generate("api_key")

    @staticmethod
    def generate_session_id() -> str:
        """Generate session ID (32 chars, no prefix)"""
        return IDGenerator.generate("session")

    @staticmethod
    def generate_invite_code() -> str:
        """Generate shareable invite code (12 chars, uppercase)"""
        return IDGenerator.generate("invite")

    @staticmethod
    def validate_id(id_str: str, entity_type: str) -> bool:
        """
        Validate ID format

        Returns:
            True if ID matches expected format and alphabet
        """
        if not id_str or not isinstance(id_str, str):
            return False

        # Check prefix if present
        if "_" in id_str:
            prefix, nano_id = id_str.split("_", 1)
            expected_prefix = {"user": "usr", "transaction": "txn", "account": "acc"}.get(
                entity_type
            )
            if expected_prefix and prefix != expected_prefix:
                return False
            nano_id = nano_id
        else:
            nano_id = id_str

        # Check alphabet
        alphabet = IDGenerator.ALPHABETS.get(entity_type, IDGenerator.ALPHABETS["user"])
        return all(c in alphabet for c in nano_id)

    @staticmethod
    def decode_info(id_str: str) -> dict:
        """
        Extract information from ID (for debugging)
        NanoID: doesn't contain timestamp, but is still sortable
        """
        info = {"original": id_str, "prefix": None, "nano_id": None}

        if "_" in id_str:
            prefix, nano_id = id_str.split("_", 1)
            info["prefix"] = prefix
            info["nano_id"] = nano_id
        else:
            info["nano_id"] = id_str

        # Estimate collision probability (very low for >16 chars)
        id_length = len(info["nano_id"])
        info["approx_collision_probability"] = f"2^-{id_length * 6} (negligible)"

        return info


class IDMigrationHelper:
    """Helper for migrating from sequential to NanoID"""

    @staticmethod
    def generate_mapping_id(old_sequential_id: int, prefix: str = "") -> str:
        """
        Generate NanoID for existing sequential ID
        Useful for migration without losing existing records
        """
        # Use old ID as seed for deterministic generation (for reference only)
        # In practice, just generate new IDs
        import hashlib

        seed = str(old_sequential_id).encode()
        hash_val = hashlib.sha256(seed).digest()[:3]

        # Convert first 3 bytes to string
        base_str = "".join(str(b) for b in hash_val)
        nano_id = IDGenerator.generate("user")

        return f"{prefix}_{nano_id}" if prefix else nano_id


# Singleton instance
id_generator = IDGenerator()


def get_id_generator() -> IDGenerator:
    """Get ID generator instance"""
    return id_generator
