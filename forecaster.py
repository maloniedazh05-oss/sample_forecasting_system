import numpy as np
import pandas as pd
from statsmodels.tsa.holtwinters import ExponentialSmoothing, Holt
import warnings
import traceback

# Ignore statsmodels UserWarnings for cleaner output
warnings.filterwarnings('ignore', category=UserWarning, module='statsmodels')

class ForecastingEngine:
    """
    Handles advanced forecasting calculations using various time series models.
    """

    @staticmethod
    def calculate_forecast(sales, dates_str=None, off_dates=None, periods=1, current_stock=None):
        """
        Calculates forecast values based on historical sales data.
        
        Args:
            sales (list): List of historical sales values.
            dates_str (list, optional): List of dates corresponding to sales.
            off_dates (list, optional): List of dates to be excluded (holidays/off-days).
            periods (int): Number of future periods to forecast.
            current_stock (float, optional): Current inventory level.

        Returns:
            dict: Forecast results including predictions, model used, and alerts.
        """
        try:
            # 1. Data Preparation
            if dates_str and len(dates_str) == len(sales):
                dates = pd.to_datetime(dates_str)
            else:
                # Default to daily frequency starting from 2026-01-01 if no dates provided
                dates = pd.date_range(start='2026-01-01', periods=len(sales), freq='D')
            
            series = pd.Series(sales, index=dates)

            # Reindex to fill any gaps in the date range
            full_range = pd.date_range(start=dates.min(), end=dates.max(), freq='D')
            series = series.reindex(full_range)

            # Handle off-days: mark as NaN and interpolate to preserve continuity
            if off_dates:
                off_dt = pd.to_datetime(off_dates)
                mask = series.index.isin(off_dt)
                series[mask] = np.nan
            
            series = series.interpolate(method='linear')
            series = series.bfill().ffill()

            valid_n = int(series.notna().sum())

            # 2. Model Selection and Forecasting
            model_name = "Simple Average"
            forecast_vals = []

            if valid_n >= 14:
                # Use Holt-Winters for data with at least 2 weeks of history (handles seasonality)
                try:
                    est = ExponentialSmoothing(
                        series, trend='add', seasonal='add', seasonal_periods=7,
                        initialization_method='estimated'
                    )
                    fit = est.fit()
                    model_name = "Holt-Winters"
                    forecast_vals = fit.forecast(periods)
                except Exception:
                    # Fallback to Holt if Holt-Winters fails
                    forecast_vals, model_name = ForecastingEngine._fallback_to_holt(series, periods)
            elif valid_n >= 7:
                # Use Holt for data with at least 1 week of history (handles trend)
                forecast_vals, model_name = ForecastingEngine._fallback_to_holt(series, periods)
            else:
                # Simple average for very small datasets
                avg = float(series.mean()) if valid_n > 0 else 0
                # Add a tiny bit of random variance (±5%) for prototype visual appeal
                noise = np.random.normal(0, avg * 0.05, periods) if avg > 0 else np.zeros(periods)
                forecast_vals = pd.Series([avg] * periods) + noise
                forecast_vals = forecast_vals.clip(lower=0) # Ensure no negative forecasts

            # 3. Post-processing
            forecast_list = [round(float(v), 1) for v in forecast_vals]
            avg_fc = float(np.mean(forecast_list)) if forecast_list else 0

            # 4. Inventory Analysis
            days_until_stockout, alerts = ForecastingEngine._analyze_inventory(
                current_stock, forecast_list, avg_fc
            )

            return {
                "predictions": forecast_list,
                "prediction": forecast_list[0] if forecast_list else 0,
                "model_name": model_name,
                "avg_daily_forecast": round(avg_fc, 1),
                "days_until_stockout": days_until_stockout,
                "action_alerts": alerts,
                "status": "success"
            }
        except Exception as e:
            return {
                "status": "error",
                "message": str(e),
                "traceback": traceback.format_exc()
            }

    @staticmethod
    def _fallback_to_holt(series, periods):
        """Helper to try Holt model or fallback to Mean."""
        try:
            est = Holt(series)
            fit = est.fit()
            return fit.forecast(periods), "Holt"
        except Exception:
            return pd.Series([float(series.mean())] * periods), "Simple Average"

    @staticmethod
    def _analyze_inventory(current_stock, forecast_list, avg_fc):
        """Calculates days until stockout and generates alerts."""
        days_until_stockout = None
        alerts = []

        if current_stock is not None and current_stock > 0:
            cumulative_demand = 0
            for i, val in enumerate(forecast_list):
                cumulative_demand += val
                if cumulative_demand >= current_stock:
                    days_until_stockout = i + 1
                    break

        if current_stock is not None:
            if days_until_stockout is not None:
                order_qty = round(avg_fc * 14, 1)
                severity = "success"
                if days_until_stockout <= 7:
                    severity = "danger"
                elif days_until_stockout <= 14:
                    severity = "warning"
                
                alerts.append({
                    "severity": severity,
                    "message": f"Stockout projected in {days_until_stockout} days",
                    "detail": f"Order {order_qty} kg to cover 14 days."
                })
        
        return days_until_stockout, alerts
