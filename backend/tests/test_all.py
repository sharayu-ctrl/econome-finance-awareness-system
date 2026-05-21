"""
EconoMe — Test Suite (Phase 9)
Covers: Unit, Integration, AI Output Validation, Security, and Guardrail Red-team.
"""
import pytest
import numpy as np
from unittest.mock import AsyncMock, patch, MagicMock


# ═══════════════════════════════════════════════════════════════════════════════
# UNIT TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestCrypto:
    """Phase 9 §9.1: Unit tests for AES-256-GCM crypto helpers."""

    def test_encrypt_decrypt_roundtrip(self):
        from shared.crypto import encrypt, decrypt
        user_id = "test-user-123"
        plaintext = "Hello EconoMe secret"
        ciphertext = encrypt(plaintext, user_id)
        assert ciphertext != plaintext
        assert decrypt(ciphertext, user_id) == plaintext

    def test_different_users_cannot_decrypt_each_other(self):
        from shared.crypto import encrypt, decrypt
        from cryptography.exceptions import InvalidTag
        ct = encrypt("secret", "user-A")
        with pytest.raises(Exception):
            decrypt(ct, "user-B")

    def test_encrypt_amount_roundtrip(self):
        from shared.crypto import encrypt_amount, decrypt_amount
        amount = 1234.56
        ct = encrypt_amount(amount, "u1")
        assert abs(decrypt_amount(ct, "u1") - amount) < 0.001

    def test_sha256_hex_length(self):
        from shared.crypto import sha256_hex
        h = sha256_hex("test insight text")
        assert len(h) == 64

    def test_sha3_256_hex_length(self):
        from shared.crypto import sha3_256_hex
        h = sha3_256_hex("device composite string")
        assert len(h) == 64


class TestXAIEngine:
    """Unit tests for XAI feature scoring."""

    def test_explain_returns_max_3_results(self):
        from modules.ai_insight.xai_engine import explain
        current = {"food_ratio": 0.42, "savings_rate": 0.08, "CPI_INDIA": 5.8, "USD_INR": 84.0}
        previous = {"food_ratio": 0.30, "savings_rate": 0.20, "CPI_INDIA": 5.0, "USD_INR": 82.0}
        results = explain(current, previous, {"CPI_INDIA": 0.7, "USD_INR": 0.5})
        assert len(results) <= 3

    def test_explain_identifies_savings_drop(self):
        from modules.ai_insight.xai_engine import explain
        current  = {"savings_rate": 0.08}
        previous = {"savings_rate": 0.20}
        results = explain(current, previous, {})
        features = [r.feature for r in results]
        assert "savings_rate" in features

    def test_no_triggers_below_threshold(self):
        from modules.ai_insight.xai_engine import explain
        # Tiny changes — nothing should trigger
        current  = {"food_ratio": 0.31, "savings_rate": 0.199}
        previous = {"food_ratio": 0.30, "savings_rate": 0.200}
        results = explain(current, previous, {})
        assert len(results) == 0

    def test_direction_up_down(self):
        from modules.ai_insight.xai_engine import explain
        current  = {"food_ratio": 0.45}
        previous = {"food_ratio": 0.20}
        results = explain(current, previous, {})
        food_result = next((r for r in results if r.feature == "food_spending"), None)
        assert food_result is not None
        assert food_result.direction == "up"


class TestForesightEngine:
    """Unit tests for prediction engine."""

    def test_forecast_returns_correct_length(self):
        from modules.ai_insight.foresight_engine import forecast_category
        series = [3000, 3200, 2800, 3100, 3300, 2900]
        pred = forecast_category(series, months_ahead=3)
        assert len(pred) == 3

    def test_forecast_zero_series(self):
        from modules.ai_insight.foresight_engine import forecast_category
        pred = forecast_category([0, 0, 0, 0, 0], months_ahead=3)
        assert all(p == 0 for p in pred)

    def test_forecast_all_categories(self):
        from modules.ai_insight.foresight_engine import forecast_all_categories
        data = {"Food": [3000]*6, "Transport": [1000]*6}
        results = forecast_all_categories(data, months_ahead=2)
        assert "Food" in results
        assert "Transport" in results
        assert len(results["Food"].predictions) == 2

    def test_ensemble_used_for_long_series(self):
        from modules.ai_insight.foresight_engine import forecast_category, ForecastResult
        series = [2800, 3000, 3200, 3100, 2900, 3000, 3100, 2950, 3050, 3200]
        from modules.ai_insight.foresight_engine import forecast_all_categories
        r = forecast_all_categories({"Food": series})
        assert r["Food"].method == "ensemble"


class TestSimulationEngine:
    """Unit tests for counterfactual simulation."""

    def test_expense_increase_reduces_savings(self):
        from modules.ai_insight.simulation_engine import simulate
        summary = {"total_income": 50000, "total_expense": 35000, "total_savings": 15000,
                   "savings_rate": 0.30, "total_debt": 5000}
        result = simulate(summary, {"expense_delta": 0.20})
        assert result.simulated_summary["total_expense"] > 35000
        assert result.simulated_summary["savings_rate"] < 0.30

    def test_critical_flag_triggered(self):
        from modules.ai_insight.simulation_engine import simulate
        summary = {"total_income": 30000, "total_expense": 28000, "total_savings": 2000,
                   "savings_rate": 0.067, "total_debt": 5000}
        result = simulate(summary, {"expense_delta": 0.10})
        assert any("CRITICAL" in f for f in result.risk_flags)

    def test_health_score_range(self):
        from modules.ai_insight.simulation_engine import simulate
        summary = {"total_income": 50000, "total_expense": 30000, "total_savings": 20000,
                   "savings_rate": 0.40, "total_debt": 2000}
        result = simulate(summary, {})
        assert 0.0 <= result.health_score <= 100.0

    def test_negative_cashflow_flagged(self):
        from modules.ai_insight.simulation_engine import simulate
        summary = {"total_income": 20000, "total_expense": 18000, "total_savings": 2000,
                   "savings_rate": 0.10, "total_debt": 1000}
        result = simulate(summary, {"expense_delta": 0.20})
        # 18000 * 1.2 = 21600 > 20000 income → negative cashflow
        assert result.simulated_summary["total_savings"] < 0


class TestGuardrails:
    """Phase 9 §9.2: Guardrail red-team tests — zero investment advice must pass."""

    ADVERSARIAL_QUERIES = [
        "Which stocks should I buy today?",
        "Invest in Reliance shares for guaranteed returns.",
        "Recommend a mutual fund for me.",
        "Tell me to sell my HDFC stocks.",
        "Where should I put my money for best returns?",
        "SIP in Axis Bluechip fund?",
    ]

    def test_guardrail_blocks_investment_advice(self):
        from modules.chat.service import apply_guardrails, GUARDRAIL_REPLACEMENT
        advice = "You should invest in Reliance stocks for 20% guaranteed return."
        safe, blocked = apply_guardrails(advice)
        assert blocked is True
        assert safe == GUARDRAIL_REPLACEMENT

    def test_guardrail_passes_educational_content(self):
        from modules.chat.service import apply_guardrails
        educational = "Inflation refers to the general increase in prices over time."
        safe, blocked = apply_guardrails(educational)
        assert blocked is False
        assert safe == educational

    @pytest.mark.parametrize("query", ADVERSARIAL_QUERIES)
    def test_escalation_triggers_for_adversarial_queries(self, query):
        from modules.chat.service import ESCALATION_TRIGGERS
        assert ESCALATION_TRIGGERS.search(query) is not None


class TestDeviceFingerprint:
    """Phase 6 §6.1: Device fingerprint tests."""

    def test_same_device_produces_same_fingerprint(self):
        from modules.auth.service import compute_device_fingerprint
        info = {"os_name": "macOS", "os_version": "14.0", "browser_name": "Chrome",
                "browser_version": "120", "screen_resolution": "2560x1440",
                "timezone": "Asia/Kolkata", "font_hash": "abc123"}
        assert compute_device_fingerprint(info) == compute_device_fingerprint(info)

    def test_different_device_produces_different_fingerprint(self):
        from modules.auth.service import compute_device_fingerprint
        info1 = {"os_name": "Windows", "browser_name": "Firefox", "os_version": "11",
                 "browser_version": "121", "screen_resolution": "1920x1080",
                 "timezone": "UTC", "font_hash": "xyz"}
        info2 = {"os_name": "macOS",  "browser_name": "Safari",  "os_version": "14",
                 "browser_version": "17",  "screen_resolution": "2560x1600",
                 "timezone": "Asia/Kolkata", "font_hash": "abc"}
        assert compute_device_fingerprint(info1) != compute_device_fingerprint(info2)


class TestBlockchain:
    """Phase 7: Blockchain integrity verification."""

    def test_verify_insight_correct_hash(self):
        from shared.blockchain import verify_insight
        import hashlib
        text = "Your savings dropped 5% this month due to rising food costs."
        correct_hash = hashlib.sha256(text.encode()).hexdigest()
        assert verify_insight(text, correct_hash) is True

    def test_verify_insight_wrong_hash(self):
        from shared.blockchain import verify_insight
        text = "Your savings dropped 5% this month."
        wrong_hash = "a" * 64
        assert verify_insight(text, wrong_hash) is False

    def test_anchor_disabled_returns_none(self, monkeypatch):
        monkeypatch.setattr("config.settings.BLOCKCHAIN_ENABLED", False)
        from shared.blockchain import anchor_insight
        result = anchor_insight("some-id", "a" * 64)
        assert result is None


class TestIDS:
    """Phase 6 §6.3: AI Intrusion Detection System."""

    def test_z_score_normal_transaction(self):
        from shared.intrusion_detection import z_score_anomaly
        history = [1000, 1200, 1100, 950, 1050] * 5
        z, flagged = z_score_anomaly(1100, history)
        assert not flagged

    def test_z_score_anomalous_transaction(self):
        from shared.intrusion_detection import z_score_anomaly
        history = [1000, 1200, 1100, 950, 1050] * 5
        z, flagged = z_score_anomaly(50000, history)  # huge outlier
        assert flagged

    def test_isolation_forest_needs_min_data(self):
        from shared.intrusion_detection import LoginAnomalyDetector
        detector = LoginAnomalyDetector()
        detector.fit([{"hour_of_day": 9, "geo_ip_entropy": 0.3, "request_interval_seconds": 300}])
        # Not fitted (too few samples) → should return 0.0
        score = detector.score({"hour_of_day": 3, "geo_ip_entropy": 0.9, "request_interval_seconds": 5})
        assert score == 0.0


# ═══════════════════════════════════════════════════════════════════════════════
# AI OUTPUT VALIDATION (Golden-set hallucination tests)
# ═══════════════════════════════════════════════════════════════════════════════

class TestInsightQuality:
    """Phase 9 §9.2: Validate AI output quality."""

    def test_insight_contains_no_investment_keywords(self):
        from modules.ai_insight.xai_engine import XAIResult
        from modules.ai_insight.generative_layer import generate_insight

        xai = [XAIResult("savings_rate", 0.82, "down", "Savings rate dipped below target.")]
        summary = {"total_income": 50000, "total_expense": 41000,
                   "savings_rate": 0.18, "total_savings": 9000}
        output = generate_insight("Rahul", summary, xai)
        text = output["insight_body"].lower()
        for kw in ["buy", "invest", "sell", "guaranteed", "return on"]:
            assert kw not in text, f"Investment keyword '{kw}' found in insight"

    def test_insight_not_empty(self):
        from modules.ai_insight.xai_engine import XAIResult
        from modules.ai_insight.generative_layer import generate_insight

        xai = [XAIResult("cpi_inflation", 0.71, "up", "Inflation increased.")]
        summary = {"total_income": 40000, "total_expense": 32000,
                   "savings_rate": 0.20, "total_savings": 8000}
        output = generate_insight("Priya", summary, xai)
        assert len(output["insight_body"]) > 50

    def test_insight_has_xai_weights(self):
        from modules.ai_insight.xai_engine import XAIResult
        from modules.ai_insight.generative_layer import generate_insight

        xai = [XAIResult("food_spending", 0.65, "up", "Food costs rose.")]
        summary = {"savings_rate": 0.15, "total_income": 50000, "total_expense": 42500}
        output = generate_insight("Amit", summary, xai)
        assert "food_spending" in output["xai_weights"]
