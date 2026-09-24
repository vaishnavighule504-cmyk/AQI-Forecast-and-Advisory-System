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


# Resolve root directory using BASE_DIR defined in settings
BASE_DIR = Path(settings.BASE_DIR)

# Global variable to hold your single newly trained model
SINGLE_MODEL = None

def load_single_model():
    """Loads your single root aqi_model.pkl file at startup."""
    global SINGLE_MODEL  # <-- Declared properly here
    model_path = BASE_DIR / "aqi_model.pkl"
    
    if model_path.exists():
        SINGLE_MODEL = joblib.load(model_path)
        print(f"[Model Loader] Successfully loaded single model from {model_path}")
    else:
        print(f"[Model Loader Warning] aqi_model.pkl not found at {model_path}")

# Load the model immediately on startup
try:
    load_single_model()
except Exception as e:
    print(f"[Model Loader Error] Error during model loading: {e}")

def get_forecast(city_name):
    """
    Computes 1-day-ahead and 2-day-ahead AQI forecasts for any given city
    using your single newly trained machine learning model (aqi_model.pkl).
    """
    global SINGLE_MODEL
    if SINGLE_MODEL is None:
        load_single_model()
        if SINGLE_MODEL is None:
            raise RuntimeError("Trained ML model 'aqi_model.pkl' could not be loaded from disk.")

    # 1. Fetch latest 7 raw readings for the city from the database
    readings = list(AQIReading.objects.filter(city__iexact=city_name).order_by('-date')[:7])
    
    if len(readings) < 7:
        raise ValueError(f"Insufficient history for {city_name} (need 7 daily records, found {len(readings)})")
        
    # Extract AQI values (readings[0] is today, readings[1] is yesterday, etc.)
    aqi_series = [r.aqi for r in readings] # index 0 is T, 1 is T-1, ..., 6 is T-6
    latest_reading = readings[0]
    latest_date = latest_reading.date
    latest_aqi = latest_reading.aqi
    
    # Extract pollutant values from latest reading with safe fallbacks
    pm25 = getattr(latest_reading, 'pm25', 50.0)
    pm10 = getattr(latest_reading, 'pm10', 100.0)
    no2 = getattr(latest_reading, 'no2', 30.0)
    co = getattr(latest_reading, 'co', 1.0)
    so2 = getattr(latest_reading, 'so2', 20.0)
    
    # Calculate lag features
    aqi_lag1 = aqi_series[0] # T
    aqi_lag3 = aqi_series[2] # T-2
    aqi_lag7 = aqi_series[6] # T-6
    
    # Rolling stats
    aqi_rolling_mean_3d = np.mean(aqi_series[:3])
    aqi_rolling_mean_7d = np.mean(aqi_series)
    aqi_rolling_std_7d = pd.Series(aqi_series).std()
    if pd.isna(aqi_rolling_std_7d):
        aqi_rolling_std_7d = 0.0
        
    # Target calendar features (weekday and month)
    target_date_1d = latest_date + datetime.timedelta(days=1)
    target_date_2d = latest_date + datetime.timedelta(days=2)
    
    # Construct feature vector for 1-Day-Ahead (matching exact training feature names)
    X_1d = pd.DataFrame([{
        'PM2.5': pm25,
        'PM10': pm10,
        'NO2': no2,
        'CO': co,
        'SO2': so2,
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
        'PM2.5': pm25,
        'PM10': pm10,
        'NO2': no2,
        'CO': co,
        'SO2': so2,
        'AQI_lag1': aqi_lag1,
        'AQI_lag3': aqi_lag3,
        'AQI_lag7': aqi_lag7,
        'AQI_rolling_mean_3d': aqi_rolling_mean_3d,
        'AQI_rolling_mean_7d': aqi_rolling_mean_7d,
        'AQI_rolling_std_7d': aqi_rolling_std_7d,
        'day_of_week': target_date_2d.weekday(),
        'month': target_date_2d.month
    }])
    
    # Run predictions using your single root model
    forecast_1d = SINGLE_MODEL.predict(X_1d)[0]
    forecast_2d = SINGLE_MODEL.predict(X_2d)[0]
    
    # Clip outputs to official CPCB scale (0 to 500)
    forecast_1d = float(np.clip(forecast_1d, 0, 500))
    forecast_2d = float(np.clip(forecast_2d, 0, 500))
    
    method_name = f"ML Model ({SINGLE_MODEL.__class__.__name__})"
    explanation = (
        f"Forecast for {city_name} generated successfully using your newly trained single "
        "machine learning model (aqi_model.pkl) based on pollutant concentrations and lag features."
    )
    
    return {
        "city": city_name,
        "latest_reading_date": latest_date.strftime("%Y-%m-%d"),
        "latest_reading_aqi": latest_aqi,
        "forecast_1d": {
            "date": target_date_1d.strftime("%Y-%m-%d"),
            "value": int(round(forecast_1d)),
            "method": method_name
        },
        "forecast_2d": {
            "date": target_date_2d.strftime("%Y-%m-%d"),
            "value": int(round(forecast_2d)),
            "method": method_name
        },
        "explanation": explanation
    }

# --- CPCB Live Ingestion & Calculation Pipeline ---

# Official CPCB Breakpoints Table (CPCB National AQI Report, 2014)
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
            return int(round(ilo + (ihi - ilo) / (bphi - bplo) * (conc - bplo)))
    if conc > ranges[-1][1]:
        return 500
    return None

def compute_aqi_from_pollutants(pollutant_dict):
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
    try:
        dt = datetime.datetime.strptime(ts_str.strip(), "%d-%m-%d %H:%M:%S")
        return dt.replace(tzinfo=ZoneInfo("Asia/Kolkata"))
    except Exception:
        return datetime.datetime.now(ZoneInfo("Asia/Kolkata"))

def sanitize_error_message(msg):
    import re
    if not msg:
        return ""
    msg_str = str(msg)
    msg_str = re.sub(r'api-key=[^&\s\)\']+', 'api-key=REDACTED', msg_str)
    msg_str = re.sub(r'token=[^&\s\)\']+', 'token=REDACTED', msg_str)
    msg_str = re.sub(r'passw[^&\s\)\'\w\\]*=[^&\s\)\']+', 'password=REDACTED', msg_str)
    return msg_str

def fetch_live_cpcb_data(city_name):
    c_slug = city_name.strip().lower()
    
    if c_slug not in ['delhi', 'mumbai', 'kolkata', 'bengaluru', 'chennai', 'hyderabad', 'ahmedabad']:
        return handle_db_fallback(city_name, f"City '{city_name}' is not yet supported in the live pipeline.")

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
            st_aqi, sub_indices = compute_aqi_from_pollutants(st_info["pollutants"])
            st_info["aqi"] = st_aqi
            st_info["sub_indices"] = sub_indices
            station_list.append(st_info)

            for p in CPCB_BREAKPOINTS.keys():
                if p in st_info["pollutants"]:
                    pollutant_concentrations[p].append(st_info["pollutants"][p])

        if not station_list:
            return handle_db_fallback(city_name, "No active stations found in live API response data")

        city_avg_pollutants = {}
        for p in CPCB_BREAKPOINTS.keys():
            concs = pollutant_concentrations[p]
            city_avg_pollutants[p] = sum(concs) / len(concs) if concs else None

        city_aqi, city_subs = compute_aqi_from_pollutants(city_avg_pollutants)

        if city_aqi is None:
            valid_aqis = [st["aqi"] for st in station_list if st["aqi"] is not None]
            city_aqi = int(round(sum(valid_aqis) / len(valid_aqis))) if valid_aqis else 0

        parsed_ts = parse_api_timestamp(newest_timestamp_str)

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