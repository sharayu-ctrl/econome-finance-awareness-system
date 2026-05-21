"""
EconoMe — AI Intrusion Detection System (Phase 6 §6.3)
Isolation Forest for login anomaly detection.
Z-score for financial transaction anomaly detection.
Rate-spike detection for AI usage abuse.
"""
import numpy as np
from sklearn.ensemble import IsolationForest
from datetime import datetime, timedelta
import json

# ── Login Anomaly Detector ────────────────────────────────────────────────────

class LoginAnomalyDetector:
    """
    Isolation Forest trained on: hour_of_day, geo_ip_entropy, request_interval_seconds.
    Anomaly score threshold: 0.7 → account temp-lock + admin alert.
    """
    def __init__(self):
        self.model = IsolationForest(
            n_estimators=100,
            contamination=0.05,
            random_state=42,
        )
        self._fitted = False

    def fit(self, login_logs: list[dict]):
        """Train on historical login feature dicts."""
        if len(login_logs) < 20:
            return  # not enough data to train
        X = self._extract_features(login_logs)
        self.model.fit(X)
        self._fitted = True

    def score(self, login_event: dict) -> float:
        """
        Returns anomaly score: negative = anomaly (< -0.1 = suspicious).
        Higher magnitude negative = more anomalous.
        """
        if not self._fitted:
            return 0.0
        X = self._extract_features([login_event])
        scores = self.model.decision_function(X)
        return float(scores[0])

    def is_anomalous(self, login_event: dict, threshold: float = -0.1) -> bool:
        return self.score(login_event) < threshold

    @staticmethod
    def _extract_features(events: list[dict]) -> np.ndarray:
        rows = []
        for e in events:
            hour = e.get("hour_of_day", datetime.utcnow().hour)
            geo  = e.get("geo_ip_entropy", 0.5)
            interval = e.get("request_interval_seconds", 300)
            rows.append([hour, geo, interval])
        return np.array(rows, dtype=float)


# ── Financial Behaviour Monitor ───────────────────────────────────────────────

def z_score_anomaly(amount: float, history: list[float]) -> tuple[float, bool]:
    """
    Compute z-score of amount vs user's historical transaction amounts.
    Flags if |z| > 3.
    Returns (z_score, is_flagged).
    """
    if len(history) < 5:
        return 0.0, False
    arr = np.array(history, dtype=float)
    mean = arr.mean()
    std  = arr.std()
    if std == 0:
        return 0.0, False
    z = (amount - mean) / std
    return float(z), abs(z) > 3.0


# ── AI Usage Pattern Monitor ──────────────────────────────────────────────────

async def check_ai_usage_rate(user_id: str, redis) -> bool:
    """
    Returns True if usage is normal, False if rate spike detected.
    > 50 messages/hour = potential automated abuse.
    """
    key = f"ai_usage:{user_id}:{datetime.utcnow().strftime('%Y%m%d%H')}"
    count = await redis.incr(key)
    if count == 1:
        await redis.expire(key, 3600)
    return count <= 50


# ── Global IDS Instance ───────────────────────────────────────────────────────

login_ids = LoginAnomalyDetector()
