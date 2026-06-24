import unittest
import numpy as np
from forecaster import ForecastingEngine

class TestForecastingEngine(unittest.TestCase):

    def test_simple_average(self):
        # Small dataset should use Simple Average
        sales = [10, 20, 30]
        result = ForecastingEngine.calculate_forecast(sales, periods=2)
        self.assertEqual(result['model_name'], "Simple Average")
        self.assertEqual(result['predictions'], [20.0, 20.0])

    def test_holt_winters_selection(self):
        # Larger dataset should ideally use Holt-Winters
        sales = [10, 12, 11, 13, 15, 14, 16] * 3 # 21 points
        result = ForecastingEngine.calculate_forecast(sales, periods=3)
        self.assertIn(result['model_name'], ["Holt-Winters", "Holt"])
        self.assertEqual(len(result['predictions']), 3)

    def test_stockout_logic(self):
        sales = [10, 10, 10, 10, 10, 10, 10]
        # Forecast will be 10.0 per day
        # Stock 25 should last 2.5 days -> day 3
        result = ForecastingEngine.calculate_forecast(sales, periods=5, current_stock=25)
        self.assertEqual(result['days_until_stockout'], 3)
        self.assertTrue(any(a['severity'] == 'danger' for a in result['action_alerts']))

    def test_error_handling(self):
        # Passing invalid data
        result = ForecastingEngine.calculate_forecast("not a list")
        self.assertEqual(result['status'], "error")
        self.assertIn("message", result)

if __name__ == '__main__':
    unittest.main()
