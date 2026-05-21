"""
EconoMe — AI Foresight Engine (Phase 4 §4.4)
Predicts next 3 months' expenses per category.
Algorithm: Linear Regression (scikit-learn) + Holt-Winters (statsmodels)
           blended at 60:40 weight.
"""
import warnings
import numpy as np
from dataclasses import dataclass
from sklearn.linear_model import LinearRegression
from statsmodels.tsa.holtwinters import ExponentialSmoothing


@dataclass
class ForecastResult:
    category: str
    predictions: list[float]   # next N months
    confidence_low: list[float]
    confidence_high: list[float]
    method: str                # "ensemble" | "linear_regression"


def forecast_category(series: list[float], months_ahead: int = 3) -> np.ndarray:
    """
    Ensemble forecast for a single category's expense time series.
    Falls back to pure LinearRegression if series length < 8.
    """
    if not series or all(v == 0 for v in series):
        return np.zeros(months_ahead)

    y = np.array(series, dtype=float)
    X = np.arange(len(y)).reshape(-1, 1)
    X_future = np.arange(len(y), len(y) + months_ahead).reshape(-1, 1)

    # Linear Regression
    lr = LinearRegression().fit(X, y)
    lr_pred = lr.predict(X_future)

    # Holt-Winters (needs >= 8 data points)
    if len(y) >= 8:
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                hw = ExponentialSmoothing(
                    y, trend="add", seasonal=None, damped_trend=True
                ).fit(optimized=True)
            hw_pred = hw.forecast(months_ahead)
            return 0.6 * lr_pred + 0.4 * hw_pred   # ensemble blend
        except Exception:
            pass

    return lr_pred


def forecast_all_categories(
    category_series: dict[str, list[float]],
    months_ahead: int = 3,
) -> dict[str, ForecastResult]:
    """
    Run forecasts for every expense category.
    category_series: { "Food": [3200, 3400, 3100, ...], "Transport": [...], ... }
    """
    results: dict[str, ForecastResult] = {}
    for category, series in category_series.items():
        pred = forecast_category(series, months_ahead)
        # Simple ±10% confidence interval
        ci_low  = [max(0, p * 0.9) for p in pred]
        ci_high = [p * 1.1 for p in pred]
        method  = "ensemble" if len(series) >= 8 else "linear_regression"
        results[category] = ForecastResult(
            category=category,
            predictions=[round(p, 2) for p in pred],
            confidence_low=[round(v, 2) for v in ci_low],
            confidence_high=[round(v, 2) for v in ci_high],
            method=method,
        )
    return results


def compute_savings_forecast(
    income_series: list[float],
    total_expense_forecasts: list[float],
) -> list[float]:
    """Forecast savings = forecast income − forecast total expense."""
    if not income_series:
        return [0.0] * len(total_expense_forecasts)
    avg_income = sum(income_series[-3:]) / min(3, len(income_series))
    return [round(avg_income - exp, 2) for exp in total_expense_forecasts]
