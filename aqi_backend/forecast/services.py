import os
import joblib
import datetime
import pandas as pd
import numpy as np
import requests
from zoneinfo import ZoneInfo
from django.conf import settings
from forecast.models import AQIReading, LiveAQIReading
from pathlib import Path


# Resolve models directory using BASE_DIR defined in settings
BASE_DIR = Path(settings.BASE_DIR)
# models config folder is located outside aqi_backend, at the workspace root
MODELS_DIR = BASE_DIR.parent / "models"

# Global dictionary to cache loaded ML models
LOADED_MODELS_1D = {}
LOADED_MODELS_2D = {}

# The 7 target cities
REGRESSION_CITIES = ['delhi', 'kolkata', 'mumbai']
BASELINE_CITIES = ['ahmedabad', 'bengaluru', 'chennai', 'hyderabad']

def load_models():
    """Loads model pickles at startup for regression cities."""
    for city in REGRESSION_CITIES:
        model_path_1d = MODELS_DIR / f"aqi_model_{city}.pkl"
        model_path_2d = MODELS_DIR / f"aqi_model_2d_{city}.pkl"
        
        if model_path_1d.exists():
            LOADED_MODELS_1D[city] = joblib.load(model_path_1d)
            print(f"[Model Loader] Loaded 1D Model for {city.capitalize()} from {model_path_1d}")
        else:
            print(f"[Model Loader Warning] 1D model not found for {city.capitalize()} at {model_path_1d}")
            
        if model_path_2d.exists():
            LOADED_MODELS_2D[city] = joblib.load(model_path_2d)
            print(f"[Model Loader] Loaded 2D Model for {city.capitalize()} from {model_path_2d}")
        else:
            print(f"[Model Loader Warning] 2D model not found for {city.capitalize()} at {model_path_2d}")

# Load the models immediately.
try:
    load_models()
except Exception as e:
    print(f"[Model Loader Error] Error during model loading: {e}")

def get_forecast(city_name):
    """
    Computes 1-day-ahead and 2-day-ahead AQI forecasts for a given city.
    
    If the city belongs to [Delhi, Kolkata, Mumbai], a trained machine learning model
    (Linear/Ridge Regression) is used to calculate the prediction based on historical features.
    
    If the city belongs to [Ahmedabad, Bengaluru, Chennai, Hyderabad], the naive persistence
    baseline is used directly (predicted AQI = most recent known AQI), based on the validation/test 
    results showing that baseline is superior or comparable, preventing overfitting on short sequences.
    """
    city_slug = city_name.strip().lower()
    
    # 1. Fetch latest 7 raw readings for the city from the database
    readings = list(AQIReading.objects.filter(city__iexact=city_name).order_by('-date')[:7])
    
    if not readings:
        raise ValueError(f"No records found in database for city '{city_name}'. Please verify database seeding.")
        
    latest_reading = readings[0]
    latest_date = latest_reading.date
    latest_aqi = latest_reading.aqi
    
    # If the city is in baseline cities, implement persistence forecast directly:
    if city_slug in BASELINE_CITIES:
        # Reference: Model comparison evaluations show that in flatter, less extreme, or coastal cities
        # (Bengaluru, Chennai, Hyderabad) and volatile cities with metric conflicts (Ahmedabad),
        # the persistence baseline yields the lowest MAE and dominates ML models.
        # Thus, we bypass loading ML model pickles for these cities and directly return the last known AQI.
        forecast_1d = latest_aqi
        forecast_2d = latest_aqi
        method_1d = "Naïve Baseline (Persistence)"
        method_2d = "Naïve Baseline (Persistence)"
        explanation = (
            f"Under joint MAE-RMSE deployment criteria, {city_name} is configured for Naïve Baseline (Persistence) "
            "because the baseline outperformed time-series regressors or exhibited severe metric disagreement."
        )
        return {
            "city": city_name,
            "latest_reading_date": latest_date.strftime("%Y-%m-%d"),
            "latest_reading_aqi": latest_aqi,
            "forecast_1d": {
                "date": (latest_date + datetime.timedelta(days=1)).strftime("%Y-%m-%d"),
                "value": int(round(forecast_1d)),
                "method": method_1d
            },
            "forecast_2d": {
                "date": (latest_date + datetime.timedelta(days=2)).strftime("%Y-%m-%d"),
                "value": int(round(forecast_2d)),
                "method": method_2d
            },
            "explanation": explanation
        }
        
    # If the city is in regression cities, compute features and use the trained regressor:
    elif city_slug in REGRESSION_CITIES:
        if len(readings) < 7:
            raise ValueError(f"Insufficient history for {city_name} (need 7 daily records, found {len(readings)})")
            
        # Extract AQI values (readings[0] is today, readings[1] is yesterday, etc.)
        aqi_series = [r.aqi for r in readings] # index 0 is T, 1 is T-1, ..., 6 is T-6
        
        # Calculate lag features:
        # lag1 represents yesterday relative to target (so for target T+1/T+2, information boundary is T)
        # Therefore, features are calculated up to date T:
        aqi_lag1 = aqi_series[0] # T
        aqi_lag3 = aqi_series[2] # T-2
        aqi_lag7 = aqi_series[6] # T-6
        
        # Rolling stats:
        # rolling_mean_3d: average of past 3 days (T, T-1, T-2)
        aqi_rolling_mean_3d = np.mean(aqi_series[:3])
        # rolling_mean_7d: average of past 7 days (T, T-1, ..., T-6)
        aqi_rolling_mean_7d = np.mean(aqi_series)
        # rolling_std_7d: sample std of past 7 days (T, T-1, ..., T-6) (ddof=1)
        aqi_rolling_std_7d = pd.Series(aqi_series).std()
        if pd.isna(aqi_rolling_std_7d):
            aqi_rolling_std_7d = 0.0
            
        # Target calendar features (weekday and month)
        target_date_1d = latest_date + datetime.timedelta(days=1)
        target_date_2d = latest_date + datetime.timedelta(days=2)
        
        # Construct feature vector for 1-Day-Ahead
        X_1d = pd.DataFrame([{
            'AQI_lag1': aqi_lag1,
            'AQI_lag3': aqi_lag3,
            'AQI_lag7': aqi_lag7,
            'AQI_rolling_mean_3d': aqi_rolling_mean_3d,
            'AQI_rolling_mean_7d': aqi_rolling_mean_7d,
            'AQI_rolling_std_7d': aqi_rolling_std_7d,
            'day_of_week': target_date_1d.weekday(),
            'month': target_date_1d.month
        }])
        
        # Construct feature vector for 2-Day-Ahead
        X_2d = pd.DataFrame([{
            'AQI_lag1': aqi_lag1,
            'AQI_lag3': aqi_lag3,
            'AQI_lag7': aqi_lag7,
            'AQI_rolling_mean_3d': aqi_rolling_mean_3d,
            'AQI_rolling_mean_7d': aqi_rolling_mean_7d,
            'AQI_rolling_std_7d': aqi_rolling_std_7d,
            'day_of_week': target_date_2d.weekday(),
            'month': target_date_2d.month
        }])
        
        # Pick models
        model_1d = LOADED_MODELS_1D.get(city_slug)
        model_2d = LOADED_MODELS_2D.get(city_slug)
        
        if not model_1d or not model_2d:
            # Load fallback if dict is empty (lazy load)
            load_models()
            model_1d = LOADED_MODELS_1D.get(city_slug)
            model_2d = LOADED_MODELS_2D.get(city_slug)
            if not model_1d or not model_2d:
                raise RuntimeError(f"Trained ML models for {city_name} could not be loaded from disk.")
        
        forecast_1d = model_1d.predict(X_1d)[0]
        forecast_2d = model_2d.predict(X_2d)[0]
        
        # Clip outputs to official CPCB scale
        forecast_1d = float(np.clip(forecast_1d, 0, 500))
        forecast_2d = float(np.clip(forecast_2d, 0, 500))
        
        method_1d = f"ML Model ({model_1d.__class__.__name__})"
        method_2d = f"ML Model ({model_2d.__class__.__name__})"
        explanation = (
            f"Under joint MAE-RMSE deployment criteria, {city_name} is configured for machine learning "
            "forecasting because the trained regressor outperformed the baseline on both MAE and RMSE features."
        )
        
        return {
            "city": city_name,
            "latest_reading_date": latest_date.strftime("%Y-%m-%d"),
            "latest_reading_aqi": latest_aqi,
            "forecast_1d": {
                "date": target_date_1d.strftime("%Y-%m-%d"),
                "value": int(round(forecast_1d)),
                "method": method_1d
            },
            "forecast_2d": {
                "date": target_date_2d.strftime("%Y-%m-%d"),
                "value": int(round(forecast_2d)),
                "method": method_2d
            },
            "explanation": explanation
        }
        
    else:
        raise ValueError(f"City '{city_name}' is not supported by the AQI Forecasting System.")

# --- CPCB Live Ingestion & Calculation Pipeline ---

# Official CPCB Breakpoints Table (CPCB National AQI Report, 2014)
# Tuple format: (Concentration Low, Concentration High, Index Low, Index High)
CPCB_BREAKPOINTS = {
    'pm25': [(0.0, 30.0, 0, 50), (30.1, 60.0, 51, 100), (60.1, 90.0, 101, 200), (90.1, 120.0, 201, 300), (120.1, 250.0, 301, 400), (250.1, 380.0, 401, 500)],
    'pm10': [(0.0, 50.0, 0, 50), (50.1, 100.0, 51, 100), (100.1, 250.0, 101, 200), (250.1, 350.0, 201, 300), (350.1, 430.0, 301, 400), (430.1, 510.0, 401, 500)],
    'no2': [(0.0, 40.0, 0, 50), (40.1, 80.0, 51, 100), (80.1, 180.0, 101, 200), (180.1, 280.0, 201, 300), (280.1, 400.0, 301, 400), (400.1, 1000.0, 401, 500)],
    'o3': [(0.0, 50.0, 0, 50), (50.1, 100.0, 51, 100), (100.1, 168.0, 101, 200), (168.1, 208.0, 201, 300), (208.1, 748.0, 301, 400), (748.1, 1000.0, 401, 500)],
    'co': [(0.0, 1.0, 0, 50), (1.01, 2.0, 51, 100), (2.01, 10.0, 101, 200), (10.01, 17.0, 201, 300), (17.01, 34.0, 301, 400), (34.01, 50.0, 401, 500)],
    'so2': [(0.0, 40.0, 0, 50), (40.1, 80.0, 51, 100), (80.1, 380.0, 101, 200), (380.1, 800.0, 201, 300), (800.1, 1600.0, 301, 400), (1601.1, 2000.0, 401, 500)],
    'nh3': [(0.0, 200.0, 0, 50), (200.1, 400.0, 51, 100), (400.1, 800.0, 101, 200), (800.1, 1200.0, 201, 300), (1200.1, 1800.0, 301, 400), (1801.1, 2800.0, 401, 500)]
}

def calculate_sub_index(pollutant, conc):
    if conc is None or conc < 0:
        return None
    ranges = CPCB_BREAKPOINTS.get(pollutant)
    if not ranges:
        return None
    for bplo, bphi, ilo, ihi in ranges:
        if bplo <= conc <= bphi:
            # Piecewise linear interpolation math
            return int(round(ilo + (ihi - ilo) / (bphi - bplo) * (conc - bplo)))
    # Clip to maximum AQI if concentration exceeds upper bounds
    if conc > ranges[-1][1]:
        return 500
    return None

def compute_aqi_from_pollutants(pollutant_dict):
    """
    CPCB Data Completeness Checks:
    - Minimum 3 pollutants must have active, valid sub-indices.
    - At least one pollutant must be PM2.5 or PM10.
    """
    sub_indices = {}
    for p, val in pollutant_dict.items():
        if val is not None:
            sub = calculate_sub_index(p, val)
            if sub is not None:
                sub_indices[p] = sub
    
    if len(sub_indices) < 3:
        return None, {}
    if 'pm25' not in sub_indices and 'pm10' not in sub_indices:
        return None, {}
        
    overall_aqi = max(sub_indices.values())
    return overall_aqi, sub_indices

def parse_api_timestamp(ts_str):
    """Converts data.gov.in last_update string (e.g. '21-08-2026 11:00:00') into timezone-aware datetime."""
    try:
        dt = datetime.datetime.strptime(ts_str.strip(), "%d-%m-%d %H:%M:%S")
        return dt.replace(tzinfo=ZoneInfo("Asia/Kolkata"))
    except Exception:
        return datetime.datetime.now(ZoneInfo("Asia/Kolkata"))

def sanitize_error_message(msg):
    """Sanitizes sensitive information like query API keys from exception or log messages."""
    import re
    if not msg:
        return ""
    # Mask CPCB API key (api-key=xxxx) and general query tokens (token=xxxx) or password info
    msg_str = str(msg)
    msg_str = re.sub(r'api-key=[^&\s\)\']+', 'api-key=REDACTED', msg_str)
    msg_str = re.sub(r'token=[^&\s\)\']+', 'token=REDACTED', msg_str)
    msg_str = re.sub(r'passw[^&\s\)\'\w\\]*=[^&\s\)\']+', 'password=REDACTED', msg_str)
    return msg_str

def fetch_live_cpcb_data(city_name):
    """
    Fetches real-time hourly telemetry data from data.gov.in,
    performs station aggregation, completes unit conversions (micrograms/m3 to mg/m3 for CO),
    calculates station-level AQIs, averages pollutant concentrations across stations for city AQI,
    and caches the observation separately in PostgreSQL.
    """
    c_slug = city_name.strip().lower()
    
    # We restrict implementation to Delhi only for now, but design parameters allow easy extension
    if c_slug != "delhi":
        return handle_db_fallback(city_name, f"City '{city_name}' is not yet supported in the live pipeline. Currently supports Delhi only.")

    api_key = os.getenv("CPCB_API_KEY")
    if not api_key:
        return handle_db_fallback(city_name, "API Key Missing (CPCB_API_KEY environment variable not set)")

    url = "https://api.data.gov.in/resource/3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69"
    params = {
        "api-key": api_key,
        "format": "json",
        "limit": 5000,
        "filters[city]": city_name
    }
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }

    try:
        response = requests.get(url, params=params, headers=headers, timeout=15)
        if response.status_code != 200:
            return handle_db_fallback(city_name, f"CPCB API HTTP Status {response.status_code}")

        data = response.json()
        records = data.get("records", [])
        if not records:
            return handle_db_fallback(city_name, "API did not return any records for selected city")

        stations = {}
        newest_timestamp_str = None

        for r in records:
            st = r.get("station")
            lat = float(r.get("latitude")) if r.get("latitude") else 0.0
            lng = float(r.get("longitude")) if r.get("longitude") else 0.0
            ts = r.get("last_update")
            
            if ts and (not newest_timestamp_str or ts > newest_timestamp_str):
                newest_timestamp_str = ts

            pid = r.get("pollutant_id", "").lower().replace(".", "")
            if pid == "ozone":
                pid = "o3"

            val_str = r.get("avg_value")
            if val_str is None or val_str == "NA":
                continue

            try:
                val = float(val_str)
            except ValueError:
                continue

            # CO Unit conversion check:
            # Official CPCB AQI breakpoints use mg/m3 for CO. Telemetry returns CO concentration in micrograms/m3.
            # Convert micrograms/m3 to mg/m3 by dividing by 1000.0.
            if pid == "co":
                val = val / 1000.0

            if st not in stations:
                stations[st] = {
                    "name": st,
                    "latitude": lat,
                    "longitude": lng,
                    "pollutants": {}
                }
            stations[st]["pollutants"][pid] = val

        station_list = []
        pollutant_concentrations = {p: [] for p in CPCB_BREAKPOINTS.keys()}

        for st_name, st_info in stations.items():
            # Calculate standard station AQI separately for map rendering
            st_aqi, sub_indices = compute_aqi_from_pollutants(st_info["pollutants"])
            st_info["aqi"] = st_aqi
            st_info["sub_indices"] = sub_indices
            station_list.append(st_info)

            # Store concentrations for city-wide aggregation averages
            for p in CPCB_BREAKPOINTS.keys():
                if p in st_info["pollutants"]:
                    pollutant_concentrations[p].append(st_info["pollutants"][p])

        if not station_list:
            return handle_db_fallback(city_name, "No active stations found in live API response data")

        # Core city-level aggregation methodology:
        # Calculate city AQI by averaging pollutant concentrations across stations first
        city_avg_pollutants = {}
        for p in CPCB_BREAKPOINTS.keys():
            concs = pollutant_concentrations[p]
            city_avg_pollutants[p] = sum(concs) / len(concs) if concs else None

        # Then apply CPCB sub-index calculations to those averaged concentrations
        city_aqi, city_subs = compute_aqi_from_pollutants(city_avg_pollutants)

        if city_aqi is None:
            # Fallback to station average AQI if concentration averages don't meet completeness checks
            valid_aqis = [st["aqi"] for st in station_list if st["aqi"] is not None]
            city_aqi = int(round(sum(valid_aqis) / len(valid_aqis))) if valid_aqis else 0

        parsed_ts = parse_api_timestamp(newest_timestamp_str)

        # Cache live observation separately in the database, protecting training records
        live_rec, created = LiveAQIReading.objects.update_or_create(
            city=city_name,
            timestamp=parsed_ts,
            defaults={
                "aqi": city_aqi,
                "pm25": city_avg_pollutants.get("pm25"),
                "pm10": city_avg_pollutants.get("pm10"),
                "no2": city_avg_pollutants.get("no2"),
                "so2": city_avg_pollutants.get("so2"),
                "co": city_avg_pollutants.get("co"),
                "o3": city_avg_pollutants.get("o3"),
                "nh3": city_avg_pollutants.get("nh3"),
                "is_live": True,
                "derived_method": "Project-derived city average AQI using CPCB methodology",
                "station_data": station_list
            }
        )

        return format_api_response(live_rec)

    except Exception as e:
        safe_msg = sanitize_error_message(e)
        return handle_db_fallback(city_name, f"Pipeline Error: {safe_msg}")

def handle_db_fallback(city_name, reason):
    """Fallback handler returning latest LiveAQIReading stored record marked as is_live=False."""
    print(f"[CPCB Fallback] Triggered database fallback: {reason}")
    latest = LiveAQIReading.objects.filter(city__iexact=city_name).order_by('-timestamp').first()
    if latest:
        latest.is_live = False
        latest.derived_method = f"PostgreSQL Historical Fallback ({reason})"
        return format_api_response(latest)
    else:
        return {
            "live": False,
            "city": city_name,
            "date": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "aqi": 0,
            "pollutants": {p: None for p in CPCB_BREAKPOINTS.keys()},
            "derived_method": f"Database Fallback [No records cached] ({reason})",
            "stations": []
        }

def format_api_response(record):
    return {
        "live": record.is_live,
        "city": record.city,
        "date": record.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
        "aqi": record.aqi,
        "pollutants": {
            "pm25": record.pm25,
            "pm10": record.pm10,
            "no2": record.no2,
            "so2": record.so2,
            "co": record.co,
            "o3": record.o3,
            "nh3": record.nh3
        },
        "derived_method": record.derived_method,
        "stations": record.station_data or []
    }

