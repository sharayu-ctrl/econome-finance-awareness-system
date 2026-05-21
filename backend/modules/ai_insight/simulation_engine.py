"""
EconoMe — Counterfactual Simulation Engine (Phase 4 §4.5)
"What-if" parametric perturbation on a user's financial summary.
"""
from copy import deepcopy
from dataclasses import dataclass, field


SAFE_SAVINGS_RATE   = 0.15   # 15% recommended minimum
CRITICAL_SAVINGS    = 0.10   # 10% critical threshold
SAFE_EMI_RATIO      = 0.35   # EMI ≤ 35% of income
EMERGENCY_FUND_MONTHS = 3    # 3 months of expenses recommended


@dataclass
class SimulationResult:
    simulated_summary: dict
    original_summary: dict
    delta: dict
    risk_flags: list[str] = field(default_factory=list)
    health_score: float = 0.0    # 0–100


def simulate(summary: dict, params: dict) -> SimulationResult:
    """
    Apply parametric perturbation to a financial summary and evaluate health.

    params keys (all optional):
      expense_delta   : float  — fractional change to total expenses (+0.10 = 10% more)
      income_delta    : float  — fractional change to income
      emi_delta       : float  — fractional change to loan payments
      food_delta      : float  — fractional change to food category specifically
    """
    sim = deepcopy(summary)

    if "expense_delta" in params:
        sim["total_expense"] = sim.get("total_expense", 0) * (1 + params["expense_delta"])

    if "income_delta" in params:
        sim["total_income"] = sim.get("total_income", 0) * (1 + params["income_delta"])

    if "emi_delta" in params:
        sim["total_debt"] = sim.get("total_debt", 0) * (1 + params["emi_delta"])
        sim["total_expense"] = sim.get("total_expense", 0) + \
            (sim["total_debt"] * params["emi_delta"])

    income  = sim.get("total_income", 0) or 1
    expense = sim.get("total_expense", 0)
    debt    = sim.get("total_debt", 0)

    sim["total_savings"] = income - expense
    sim["savings_rate"]  = (income - expense) / income
    sim["emi_ratio"]     = debt / income

    # ── Risk Flags ────────────────────────────────────────────────────────────
    risk_flags = []
    if sim["savings_rate"] < CRITICAL_SAVINGS:
        risk_flags.append("CRITICAL: Savings rate below 10% — financial buffer is dangerously thin.")
    elif sim["savings_rate"] < SAFE_SAVINGS_RATE:
        risk_flags.append("WARNING: Savings rate below recommended 15%.")

    if sim["emi_ratio"] > SAFE_EMI_RATIO:
        risk_flags.append(f"WARNING: EMI burden at {sim['emi_ratio']*100:.1f}% of income — above safe threshold of 35%.")

    if sim["total_savings"] < 0:
        risk_flags.append("CRITICAL: Expenses exceed income — negative cash flow.")

    # ── Health Score (0–100) ──────────────────────────────────────────────────
    score = 100.0
    if sim["savings_rate"] < 0:
        score -= 40
    elif sim["savings_rate"] < CRITICAL_SAVINGS:
        score -= 30
    elif sim["savings_rate"] < SAFE_SAVINGS_RATE:
        score -= 15

    if sim["emi_ratio"] > SAFE_EMI_RATIO:
        score -= 20

    health_score = max(0.0, min(100.0, score))

    # ── Delta ─────────────────────────────────────────────────────────────────
    delta = {
        "savings_rate_delta": sim["savings_rate"] - summary.get("savings_rate", 0),
        "expense_delta_abs":  sim["total_expense"]  - summary.get("total_expense", 0),
        "savings_delta_abs":  sim["total_savings"]  - summary.get("total_savings", 0),
    }

    return SimulationResult(
        simulated_summary=sim,
        original_summary=summary,
        delta=delta,
        risk_flags=risk_flags,
        health_score=round(health_score, 1),
    )
