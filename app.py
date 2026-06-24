from flask import Flask, request, jsonify
from flask_cors import CORS
from forecaster import ForecastingEngine
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def create_app():
    """Application factory for the Flask backend."""
    app = Flask(__name__)
    CORS(app)

    @app.route('/forecast', methods=['POST'])
    def forecast():
        """
        API endpoint to generate sales forecasts.
        Expects JSON payload with sales_data, dates, off_dates, periods, and current_stock.
        """
        try:
            req_data = request.get_json()
            if not req_data:
                return jsonify({'error': 'Invalid request: No JSON data provided'}), 400

            sales_data = req_data.get('sales_data', [])
            dates = req_data.get('dates', [])
            off_dates = req_data.get('off_dates', [])
            periods = int(req_data.get('periods', 1))
            current_stock = req_data.get('current_stock')

            if not sales_data:
                return jsonify({'error': 'Missing required field: sales_data'}), 400

            logger.info(f"Generating forecast for {len(sales_data)} data points over {periods} periods.")
            
            # Delegate logic to the ForecastingEngine
            result = ForecastingEngine.calculate_forecast(
                sales=sales_data,
                dates_str=dates,
                off_dates=off_dates,
                periods=periods,
                current_stock=current_stock
            )
            
            if result.get("status") == "error":
                logger.error(f"Forecasting error: {result.get('message')}")
                return jsonify(result), 500
                
            return jsonify(result)

        except ValueError as ve:
            logger.warning(f"Validation error: {ve}")
            return jsonify({'error': f'Invalid input: {str(ve)}'}), 400
        except Exception as e:
            logger.exception("Unexpected error in /forecast endpoint")
            return jsonify({'error': 'An internal server error occurred'}), 500

    return app

if __name__ == '__main__':
    app = create_app()
    # Using host 0.0.0.0 for container/network accessibility
    # Using port 5001 as per the original project setup
    app.run(debug=True, host='0.0.0.0', port=5001)
