"""
EconoMe — Generative Layer (Phase 4 §4.6)
Converts structured AI outputs into personalised natural language.
Primary method: Jinja2 template rendering (deterministic, fast, auditable).
Optional: Local LLM (Mistral-7B Q4) for narrative enrichment.
"""
from jinja2 import Environment, DictLoader
from datetime import datetime
from dateutil.relativedelta import relativedelta

from modules.ai_insight.xai_engine import XAIResult
from modules.ai_insight.foresight_engine import ForecastResult

# ── Jinja2 Templates ──────────────────────────────────────────────────────────

TEMPLATES = {
    "main_insight": """
{%- if savings_rate < 0.10 -%}
{{ name }}, this month's finances show a critical pattern that deserves attention.
{%- elif savings_rate < 0.15 -%}
{{ name }}, your savings rate of {{ (savings_rate * 100) | round(1) }}% is below the recommended 15% — here's what's driving it.
{%- else -%}
{{ name }}, your finances are on a reasonable track this month — but a few signals are worth knowing.
{%- endif %}

{% for item in xai_results %}
{{ item.explanation }}{% if not loop.last %} {% endif %}
{% endfor %}

{%- if forecast_amount is not none %}
At current trends, your savings in {{ forecast_month }} are projected at ₹{{ forecast_amount | int | format_inr }}.
{%- endif %}

{%- if risk_flags %}
⚠️ Simulation alert: {{ risk_flags[0] }}
{%- endif %}
""",

    "headline": """
{%- if savings_rate < 0.10 -%}
Savings Critical — Action Needed
{%- elif savings_rate < 0.15 -%}
Savings Below Target ({{ (savings_rate * 100) | round(1) }}%)
{%- else -%}
Finances on Track — Stay Aware
{%- endif %}
""",

    "xai_explanation": """
Top insight drivers this month:
{% for item in xai_results %}
{{ loop.index }}. {{ item.feature | replace('_', ' ') | title }} — {{ item.explanation }}
{% endfor %}
""",
}


def _format_inr(value: float) -> str:
    """Format a number in Indian numbering system (lakhs/crores)."""
    value = int(value)
    if value >= 10_000_000:
        return f"{value/10_000_000:.1f}Cr"
    if value >= 100_000:
        return f"{value/100_000:.1f}L"
    return f"{value:,}"


def _build_env() -> Environment:
    env = Environment(loader=DictLoader(TEMPLATES))
    env.filters["format_inr"] = _format_inr
    return env


_jinja_env = _build_env()


def generate_insight(
    name: str,
    summary: dict,
    xai_results: list[XAIResult],
    forecasts: dict[str, ForecastResult] | None = None,
    risk_flags: list[str] | None = None,
) -> dict:
    """
    Render all insight templates and return structured output.
    """
    savings_rate = summary.get("savings_rate", 0.0)

    # Next month label
    next_month = (datetime.utcnow() + relativedelta(months=1)).strftime("%B")

    # Savings forecast amount
    forecast_amount = None
    if forecasts:
        total_pred = sum(
            f.predictions[0] for f in forecasts.values() if f.predictions
        )
        forecast_income = summary.get("total_income", 0)
        forecast_amount = max(0, forecast_income - total_pred)

    ctx = dict(
        name=name,
        savings_rate=savings_rate,
        xai_results=xai_results,
        forecast_amount=forecast_amount,
        forecast_month=next_month,
        risk_flags=risk_flags or [],
    )

    body      = _jinja_env.get_template("main_insight").render(**ctx).strip()
    headline  = _jinja_env.get_template("headline").render(**ctx).strip()
    xai_text  = _jinja_env.get_template("xai_explanation").render(**ctx).strip()

    return {
        "headline":         headline,
        "insight_body":     body,
        "xai_explanation":  xai_text,
        "savings_rate":     savings_rate,
        "forecast_amount":  forecast_amount,
        "risk_flags":       risk_flags or [],
        "xai_weights":      {r.feature: r.weight for r in xai_results},
    }


def enrich_with_llm(structured_output: dict, local_llm=None) -> dict:
    """
    If local LLM is configured, pass the Jinja2 output for narrative enrichment.
    Numbers and facts always come from the deterministic structured_output.
    The LLM only polishes the language.
    """
    if not local_llm:
        return structured_output

    prompt = f"""You are EconoMe, a financial awareness educator. 
Rewrite the following insight in warm, natural language. 
Do NOT change any numbers. Do NOT add investment advice. 
Keep it to 100–130 words.

ORIGINAL:
{structured_output['insight_body']}

REWRITTEN:"""

    try:
        enriched = local_llm.generate(prompt, max_tokens=200)
        structured_output["insight_body"] = enriched.strip()
    except Exception:
        pass  # fallback to Jinja2 output silently

    return structured_output
