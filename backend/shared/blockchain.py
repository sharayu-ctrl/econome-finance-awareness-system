"""
EconoMe — Blockchain Audit Layer (Phase 7)
Anchors SHA-256 hashes of AI insights on Polygon L2.
Raw financial data never touches the chain — only hashes.
"""
from config import settings


INSIGHT_RECORD_ABI = [
    {
        "inputs": [
            {"name": "insightId", "type": "bytes32"},
            {"name": "insightHash", "type": "bytes32"},
            {"name": "modelVersion", "type": "string"},
        ],
        "name": "anchorInsight",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [{"name": "insightId", "type": "bytes32"}],
        "name": "getInsight",
        "outputs": [
            {"name": "insightHash",    "type": "bytes32"},
            {"name": "timestamp",      "type": "uint256"},
            {"name": "modelVersion",   "type": "string"},
            {"name": "anchorAddress",  "type": "address"},
        ],
        "stateMutability": "view",
        "type": "function",
    },
]


def _get_web3():
    try:
        from web3 import Web3
        w3 = Web3(Web3.HTTPProvider(settings.POLYGON_RPC_URL))
        return w3
    except ImportError:
        raise RuntimeError("web3 package not installed — run: pip install web3")


def _id_to_bytes32(insight_id: str) -> bytes:
    """Convert UUID string to bytes32."""
    return bytes.fromhex(insight_id.replace("-", "").ljust(64, "0"))


def anchor_insight(insight_id: str, insight_hash: str, model_version: str = "jinja2-v1.0") -> str | None:
    """
    Anchor an insight hash on Polygon L2.
    Returns the transaction hash string, or None if blockchain is disabled.
    """
    if not settings.BLOCKCHAIN_ENABLED:
        return None
    if not settings.SMART_CONTRACT_ADDRESS or not settings.BLOCKCHAIN_WALLET_PRIVATE_KEY:
        return None

    try:
        w3 = _get_web3()
        contract = w3.eth.contract(
            address=w3.to_checksum_address(settings.SMART_CONTRACT_ADDRESS),
            abi=INSIGHT_RECORD_ABI,
        )
        account = w3.eth.account.from_key(settings.BLOCKCHAIN_WALLET_PRIVATE_KEY)

        id_bytes   = _id_to_bytes32(insight_id)
        hash_bytes = bytes.fromhex(insight_hash)

        nonce = w3.eth.get_transaction_count(account.address)
        tx = contract.functions.anchorInsight(
            id_bytes, hash_bytes, model_version
        ).build_transaction({
            "from":     account.address,
            "nonce":    nonce,
            "gas":      100_000,
            "gasPrice": w3.to_wei("30", "gwei"),
        })
        signed = account.sign_transaction(tx)
        tx_hash = w3.eth.send_raw_transaction(signed.rawTransaction)
        return w3.to_hex(tx_hash)
    except Exception as e:
        # Log and return None — blockchain failure must not block insight delivery
        print(f"[blockchain] anchor failed for {insight_id}: {e}")
        return None


def verify_insight(insight_text: str, on_chain_hash: str) -> bool:
    """
    User-facing verification: compute SHA-256 of insight text,
    compare against stored on-chain hash.
    """
    import hashlib
    computed = hashlib.sha256(insight_text.encode()).hexdigest()
    return computed == on_chain_hash
