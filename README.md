# Vermicast Forecasting & Inventory Prototype

A functional web-based prototype for an academic Capstone project — **Organic Fertilizer Production and Inventory Forecasting System for EcoAgri**. It demonstrates a multi-model forecasting engine (Simple / Double / Triple Exponential Smoothing), inventory management with Re-Order Point (ROP) alerts, batch-based production tracking, and a monthly sales feed used by the forecasting layer.

The frontend is plain HTML/CSS/JS with **LocalStorage** as a stub "database" so the prototype runs without an external service. A **Python Flask** backend on port `5001` does the actual forecasting math (time-series smoothing) and exposes a single `POST /forecast` endpoint.

## Tech Stack
- **Frontend:** Vanilla HTML, CSS, JavaScript (LocalStorage for data persistence)
- **Backend:** Python Flask (Multi-model forecasting engine) + `numpy` for the math
- **Visualization:** Chart.js (CDN) for both Dashboard and Forecast View charts
- **Test:** `python -m unittest test_forecaster.py`

## Prerequisites
- Python 3.x
- `pip`

## Installation & Setup

1. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```
   (Or directly: `pip install flask flask-cors numpy`.)

2. **Start the prototype:**
   ```bash
   run.bat
   ```
   This launches the Flask backend on port `5001` and a static web server on port `8000` (to bypass `file://` security restrictions on `localStorage`).

3. **Open the application:**
   Browse to `http://localhost:8000/index.html`. The batch file opens this URL automatically.

## Default Accounts (Role-Based Access Control)
| Role | Username | Password | Scopes |
|---|---|---|---|
| Admin | `admin` | `password123` | All modules + Reports + User management |
| Inventory Manager | `manager1` | `password123` | Dashboard, Inventory, Sales, Forecast View, Settings |
| Production Staff | `staff1` | `password123` | Dashboard, Production, Settings |

## Module-by-Module Walkthrough

### 1. Dashboard
- **Stat cards:** Current Vermicast Stock, Next Period Stockout Prediction, Active Batches, Monthly Sales Goal (with % progress bar).
- **Top-bar buttons:** *Generate Stockout Prediction* (uses last 6 months of sales history → forward-projects the next period) and *Set Sales Goal* (sets a target in sacks; chart shows a dashed green goal line).
- **Alert panel:** CRITICAL / CAUTION when stock ≤ Re-Order Point, OK otherwise.
- **Trend chart:** Actual sales (last 6 months) vs the Stockout Prediction point (+ optional Sales Goal line).

### 2. Inventory
- Live Vermicast stock count (sacks).
- Stock-in / Stock-out transaction feed (deducted via `updateStock()`, capped at zero).
- Low-stock warning alert tied to the Re-Order Point.

### 3. Production
- **Start new batch:** captures Batch ID + Quantity (in **No. of Sacks**). The new status badge starts as "Processing".
- **Production History table:** shows Batch ID, No. of Sacks, Date — no Status / Actions columns (removed for prototype simplicity). The batch auto-completes on inventory replenishment.

### 4. Sales
- **Record Monthly Sales:** form with a `<select>` of all 12 months + Amount (in **No. of Sacks**).
- **History table:** grouped by day. Each row shows Time / Activity (Sale or Stock) / Details / **No. of Sacks** / Actions. The historical Revenue / Adjustment column has been removed (no price model in the prototype).
- **Import Historical Data** button (visual placeholder at the top).
- Every Sales entry is also recorded as a stock-out transaction, so the Forecast View can pull a clean history.

### 5. Forecasting (`forecast_view.html`)
- **Sidebar label:** "Forecasting" (internal route: `/forecast`).
- **Month picker:** dropdown of every month that contains historical sales data. No interactive calendar — the user selects a whole month.
- **KPI cards (5):**
    - Current Stock (No. of Sacks)
    - Stock Demand (Avg Daily)
    - Stockout Projection (Days Until Zero)
    - 30-Day Total Stock Demand
    - Suggested Production Batches
- **Chart:** "Next 30 Days Stockout Prediction" — historical month as blue bars, next-7-day forecast as orange bars.
- **Table:** "Stockout Prediction Breakdown" — per-day predicted stock-out + cumulative.
- Negative prediction values are clamped to `--` in display (no negative signs shown).

### 6. Reports (Admin only)
- Avg Monthly Sales card. The Forecast-Accuracy MAPE card has been removed; admin cannot crash on a missing model score.
- Summary table: total vermicast produced (sacks), inventory turnover, top-performing month.

### 7. Settings (Admin for forecasting config)
- Re-Order Point (No. of Sacks)
- Safety Stock (No. of Sacks)
- Lead Time (days)
- SES Alpha (smoothing factor)
- **Prototype Demo Templates:** one button per month — *June 2025*, *August 2025*, *May 2025*, *October 2025*. Selecting a button seeds exactly 30 days of random sales (capped at 80 sacks/day, weekends / holidays = `sales: 0` with `isOffDay: true`) and produces a fresh weekly-harvest log.
- **Reset Prototype Data** (admin) wipes LocalStorage and reloads.

### 8. Users (Admin only)
- Add / edit / delete user accounts (Admin, Manager, Staff).

## Forecasting Logic

The system uses **adaptive Exponential Smoothing** picked by the backend (`forecaster.py`) based on data length and shape:

Initial idea:
| History length | Model |
|---|---|
| ≥ 14 daily points | Triple Exponential Smoothing (Holt-Winters) — captures trend + weekly seasonality |
| 7–13 daily points | Double Exponential Smoothing (Holt's linear) — captures trend only |
| 3–6 daily points | Simple Exponential Smoothing — captures level only |

Prototype Agile improvement, (Now Monthly Only):
METHOD - Rolling Forecast (or Rolling 30-Day Forecast): Main focus feature: 2-3 Years Data for predicting next month(30 days).

Request payload for `POST /forecast`:
```json
{
  "sales_data":   [38, 41, 37, ...],
  "dates":        ["2025-06-01", "2025-06-02", ...],
  "off_dates":    [],
  "periods":      30,
  "current_stock": 500,
  "alpha":        0.3
}
```
Response carries:
- `predictions` — next 30 daily point estimates (sacks)
- `avg_daily_forecast` — mean of that list
- `days_until_stockout` — `current_stock / avg_daily_forecast` (rounded)
- `action_alerts` — array of `{ severity, message, detail }` based on ROP + safety-stock comparisons.

Negative predictions are mathematically possible when the trend term dips; they are filtered to `0` for the chart and to `--` for display so testers never see minus signs.

## Terminology Note (important)
The wording is precise in this prototype:
- **Stockout Prediction / Stockout Projection** — *forecasting when current inventory will reach zero* based on the predicted daily consumption rate.
- **Stock-Out** — *a transaction recording items issued or sold out of inventory* (an outflow, i.e., a sale).

These two terms are **not** synonyms. Every user-facing occurrence is marked with a blue `?` badge that opens a tooltip on hover explaining the distinction.

## Project Structure
```
.
├── app.py                  # Flask backend (port 5001), routes /login, /register, /forecast
├── forecaster.py           # Time-series forecasting engine (Holt-Winters + Holt + SES)
├── test_forecaster.py      # Unit tests for the forecasting engine
├── requirements.txt        # flask, flask-cors, numpy
├── run.bat                 # Boots Flask backend + static server on port 8000
├── index.html              # Role-based login
├── dashboard.html          # Stats + alert + Sales Trend chart + Goal button
├── inventory.html          # Stock tracking (No. of Sacks)
├── production.html         # Batch creation + history (Actions / Status removed)
├── sales.html              # Monthly sales record + grouped history
├── forecast_view.html      # Month-picker + 5 KPI cards + chart + table
├── settings.html           # Inventory / forecast config + monthly demo templates
├── reports.html            # Admin-only summary report
├── users.html              # Admin-only user management
├── style.css               # Global styling + .term-help tooltip CSS
├── js/
│   ├── store.js            # LocalStorage "DB" layer (sales, production, inventory, settings, etc.)
│   ├── api.js              # API calls to Flask
│   └── ui.js               # Common UI (sidebar, auth check, role-based nav hiding)
└── README.md
```

## Run Tests
```bash
python -m unittest test_forecaster.py
```
