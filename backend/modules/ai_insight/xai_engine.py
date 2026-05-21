"""
EconoMe — Explainable AI (XAI) Engine (Phase 4 §4.3)
Rule-based feature importance ranking — top-3 contributing features
by absolute delta from prior period.
"""
import numpy as np
from dataclasses import dataclass


@dataclass
class XAIResult:
    feature: str
    weight: float          # absolute importance score
    direction: str         # "up" | "down"
    explanation: str       # human-readable clause


RULES = [
    {"feature": "food_ratio",    "threshold": 0.04, "label": "food_spending",
     "up":   "Food spending rose significantly — groceries and dining are taking a larger share of your budget.",
     "down": "Food spending is under control this month."},

    {"feature": "transport_ratio", "threshold": 0.03, "label": "transport_spending",
     "up":   "Transport costs have increased, possibly due to fuel prices or increased commuting.",
     "down": "Transport spending is down this month."},

    {"feature": "savings_rate",  "threshold": 0.04, "label": "savings_rate",
     "up":   "Your savings rate improved — more of your income is being preserved.",
     "down": "Savings rate dipped below last month's level — worth understanding why."},

    {"feature": "CPI_INDIA",     "threshold": 0.02, "label": "cpi_inflation",
     "up":   "Retail inflation has risen — the same budget buys less than it did last month.",
     "down": "Inflation eased slightly — purchasing power improved marginally."},

    {"feature": "USD_INR",       "threshold": 0.015,"label": "rupee_weakening",
     "up":   "The rupee weakened against the dollar — imports and fuel costs tend to rise.",
     "down": "The rupee strengthened — imported goods may become slightly cheaper."},

    {"feature": "CRUDE_OIL",     "threshold": 0.03, "label": "crude_oil",
     "up":   "Crude oil prices rose — fuel and transport costs may follow.",
     "down": "Crude oil prices fell — fuel costs could ease in coming weeks."},

    {"feature": "REPO_RATE",     "threshold": 0.001,"label": "repo_rate",
     "up":   "The RBI raised the repo rate — new loans and existing floating-rate EMIs may cost more.",
     "down": "The RBI cut the repo rate — borrowing costs may ease for floating-rate loans."},

    {"feature": "emi_ratio",     "threshold": 0.05, "label": "emi_burden",
     "up":   "Your EMI-to-income ratio has increased — debt obligations are consuming more of your income.",
     "down": "EMI burden lightened this month."},
]


def explain(
    current_features: dict,
    previous_features: dict,
    sensitivity: dict,
) -> list[XAIResult]:
    """
    Compare current vs previous period feature values.
    Return top-3 XAI results by absolute weighted delta.
    """
    triggered: list[tuple[dict, float, str]] = []

    for rule in RULES:
        key = rule["feature"]
        curr = current_features.get(key, 0.0)
        prev = previous_features.get(key, 0.0)
        delta = curr - prev
        abs_delta = abs(delta)

        if abs_delta < rule["threshold"]:
            continue

        # Weight = delta magnitude * macro sensitivity (if applicable)
        sens = sensitivity.get(key, 1.0)
        weight = abs_delta * (1.0 + sens)
        direction = "up" if delta > 0 else "down"
        triggered.append((rule, weight, direction))

    # Sort by weight descending, take top 3
    triggered.sort(key=lambda x: x[1], reverse=True)
    top3 = triggered[:3]

    return [
        XAIResult(
            feature=r["label"],
            weight=round(w, 4),
            direction=d,
            explanation=r[d],
        )
        for r, w, d in top3
    ]


def build_feature_dict(
    category_ratios: dict,
    macro_snapshot: dict,
    summary: dict,
) -> dict:
    """Flatten all signals into a single comparable feature dict."""
    features = dict(category_ratios)
    for key, val in macro_snapshot.items():
        if isinstance(val, dict):
            features[key] = val.get("value", 0.0)
        else:
            features[key] = float(val)

    total_income = summary.get("total_income", 0) or 1
    features["savings_rate"] = summary.get("savings_rate", 0.0)
    return features
