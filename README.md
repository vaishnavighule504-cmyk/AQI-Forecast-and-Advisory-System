# AI-Powered Hyperlocal AQI Forecast & Health Advisory System

This system provides a reliable tool for forecasting hyperlocal air quality and delivering timely, clinical-grade data-driven health advisories.

## 1. Machine Learning Forecasting Pipeline

### Model Deployment Configuration
Predicts daily Air Quality Index (AQI) values for 1-day-ahead ($T+1$) and 2-day-ahead ($T+2$) forecasting horizons.

*   **Regression Cities (Delhi, Mumbai, Kolkata):**
    *   **Delhi:** 1-Day Model -> Ordinary Least Squares `LinearRegression`; 2-Day Model -> `Ridge` Regression ($\alpha = 1.0$).
    *   **Kolkata:** 1-Day Model -> `Ridge` Regression ($\alpha = 1.0$); 2-Day Model -> `Ridge` Regression ($\alpha = 1.0$).
    *   **Mumbai:** 1-Day Model -> Ordinary Least Squares `LinearRegression`; 2-Day Model -> Ordinary Least Squares `LinearRegression`.
*   **Baseline Cities (Ahmedabad, Bengaluru, Chennai, Hyderabad):**
    *   **Strategy:** Predicted AQI = Last observed historical AQI (Persistence Naïve Model) for both $T+1$ and $T+2$ horizons.
    *   **Rationale:** Coastal, flatter, or highly volatile cities overfit standard regression estimators. Utilizing the persistence baseline yields the lowest MAE/RMSE scores.

### Features Utilized
Computed strictly on lagged matrices to eliminate future lookahead data leakage:
*   `AQI_lag1`: Target AQI 1 day prior ($T$).
*   `AQI_lag3`: Target AQI 3 days prior ($T-2$).
*   `AQI_lag7`: Target AQI 7 days prior ($T-6$).
*   `AQI_rolling_mean_3d`: Window average of the past 3 days ($T, T-1, T-2$).
*   `AQI_rolling_mean_7d`: Window average of the past 7 days ($T, T-1, \dots, T-6$).
*   `AQI_rolling_std_7d`: Standard deviation of the past 7 days.
*   `day_of_week`: Integer representing forecasted day of the week (0 = Monday, 6 = Sunday).
*   `month`: Integer representing forecasted month (1 = January, 12 = December).

### Multistep Strategy
*   **Direct Multi-step Strategy:** Uses separate models (`aqi_model_{city}.pkl` and `aqi_model_2d_{city}.pkl`) for predicting the $T+1$ and $T+2$ AQIs respectively. No forecasted values are recursively fed back into the inference vector, ensuring forecast stability.
*   **Train/Test Split:** Chronological split (Train: 2015-01-08 to 2019-12-31; Test: 2020-01-01 to 2020-07-01).

## 2. Live Telemetry Pipeline (CPCB)
*   **Endpoint:** `/api/live-aqi/?city=Delhi` (currently Delhi only).
*   **Methodology:**
    1.  Fetch hourly JSON telemeter from data.gov.in.
    2.  Aggregates concentrations by station.
    3.  Averages pollutant concentrations across all stations.
    4.  Applies non-linear CPCB piecewise interpolation formulas to concentration averages to determine the city AQI (satisfying physical balance).
    *   *Note: Station AQIs are calculated but never averaged for the city AQI.*
*   **Carbon Monoxide (CO) Scaling:** API telemeter values are divided by $1000.0$ to scale concentrations from micro-grams/$m^3$ to $mg/m^3$ before running sub-index breakpoints.
*   **Data Completeness Checks:** Stations and aggregates must track at least 3 pollutants in total, showing at least one of $PM_{2.5}$ or $PM_{10}$ to return valid calculations.
*   **Database Decoupling:** Live values are saved and cached in a dedicated `LiveAQIReading` PostgreSQL table. Training and historical model inferences query the isolated `AQIReading` table, preventing live feed outages or format shifts from contaminating core models.