import os
import joblib
import pandas as pd
import numpy as np
import requests

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

class AQIAdvisoryAgent:
    def __init__(self, models_dir="models"):
        self.models_dir = models_dir
        # City slug mapping for API compatibility
        self.city_aliases = {
            "bengaluru": "bangalore",
            "delhi": "delhi",
            "mumbai": "mumbai",
            "chennai": "chennai",
            "hyderabad": "hyderabad",
            "ahmedabad": "ahmedabad",
            "kolkata": "kolkata"
        }

    def fetch_live_aqi(self, city):
        """Fetches real-time live AQI from the WAQI API.
        
        Raises:
            RuntimeError: If API fetch fails or returned data is malformed.
        """
        city_lower = city.strip().lower()
        api_city = self.city_aliases.get(city_lower, city_lower)
        
        # Load token from environment or use default fallback token
        api_token = os.getenv("WAQI_API_TOKEN", "").strip()
        if not api_token:
            api_token = "37befe58f7a62266a6c5699eed2a7ec178f7ab71"  
        
        url = f"https://api.waqi.info/feed/{api_city}/?token={api_token}"
        try:
            res = requests.get(url, timeout=10).json()
        except requests.exceptions.RequestException as e:
            raise RuntimeError(f"Network error while fetching AQI for {city}: {e}")
        except ValueError as e:
            raise RuntimeError(f"Invalid JSON response from WAQI API for {city}: {e}")
            
        status = res.get('status')
        if status != 'ok':
            error_msg = res.get('data', 'Unknown API Error')
            raise RuntimeError(f"WAQI API error for {city} (status: {status}): {error_msg}")
            
        data = res.get('data')
        if not isinstance(data, dict):
            raise RuntimeError(f"Malformed data object in WAQI API response for {city}: {data}")
            
        val = data.get('aqi')
        if val is None or val == "-":
            raise RuntimeError(f"No active AQI data available for {city} (received {val})")
            
        try:
            return int(val)
        except (ValueError, TypeError):
            raise RuntimeError(f"Invalid non-numeric AQI value returned for {city}: {val}")

    def predict_tomorrow_aqi(self, city="Delhi"):
        city_slug = city.strip().lower()
        model_file = os.path.join(self.models_dir, f"prophet_{city_slug}.pkl")

        # 1. Fetch live ground-truth AQI (raises exception on failure)
        live_aqi = self.fetch_live_aqi(city_slug)
        if live_aqi <= 0:
            raise RuntimeError(f"Invalid non-positive live AQI value fetched for {city}: {live_aqi}")

        # 2. Extract ML Seasonal Trend Delta from Prophet
        percent_change = 0.02  # Default +2% drift
        t_today = None
        t_tomorrow = None

        if os.path.exists(model_file):
            try:
                model = joblib.load(model_file)
                # Map to last year of training data (2020) for same month/day seasonality
                now = pd.Timestamp.now()
                ds_today = pd.Timestamp(year=2020, month=now.month, day=now.day)
                ds_tomorrow = ds_today + pd.Timedelta(days=1)

                future_df = pd.DataFrame({
                    'ds': [ds_today, ds_tomorrow], 
                    'cap': [500, 500], 
                    'floor': [10, 10]
                })
                
                forecast = model.predict(future_df)
                t_today = float(forecast[forecast['ds'] == ds_today]['yhat'].values[0])
                t_tomorrow = float(forecast[forecast['ds'] == ds_tomorrow]['yhat'].values[0])
                
                if t_today > 0:
                    raw_change = (t_tomorrow - t_today) / t_today
                    # Clip daily change to realistic physical limits (-15% to +15%)
                    percent_change = float(np.clip(raw_change, -0.15, 0.15))
            except Exception as e:
                print(f"[Prophet Warning] Trend calculation failed for {city}: {e}")

        # 3. Calculate final predicted AQI
        predicted_value = int(round(live_aqi * (1 + percent_change)))
        predicted_value = int(np.clip(predicted_value, 15, 500))

        # Safe print diagnostics (ASCII safe to prevent encoding errors on Windows terminal)
        print(f"[Live API + ML Trend] City: {city.capitalize()}")
        print(f"  - Live Baseline AQI: {live_aqi}")
        print(f"  - Prophet yhat Today: {t_today if t_today is not None else 'N/A'}")
        print(f"  - Prophet yhat Tomorrow: {t_tomorrow if t_tomorrow is not None else 'N/A'}")
        print(f"  - ML Seasonal Delta: {percent_change*100:+.1f}%")
        print(f"  - Predicted Tomorrow AQI: {predicted_value}")

        return predicted_value, (pd.Timestamp.now() + pd.Timedelta(days=1)).strftime('%Y-%m-%d')

    def get_aqi_category(self, aqi):
        if aqi <= 50: return "Good", "Green"
        elif aqi <= 100: return "Satisfactory", "Light Green"
        elif aqi <= 200: return "Moderate", "Yellow"
        elif aqi <= 300: return "Poor", "Orange"
        elif aqi <= 400: return "Very Poor", "Red"
        else: return "Severe", "Dark Red"

    def generate_health_advisory(self, predicted_aqi, profile_type, city_name="Delhi"):
        category_name, color = self.get_aqi_category(predicted_aqi)
        profile = profile_type.strip().lower()

        # Normalize the profile lookup
        if profile in ['asthma', 'respiratory', 'elderly', 'child']:
            lookup_profile = 'asthma'
        elif profile in ['outdoor worker', 'traffic police', 'delivery']:
            lookup_profile = 'outdoor worker'
        else:
            lookup_profile = 'general public'

        # Generate non-contradictory advice templates mapped directly to bands
        if lookup_profile == 'asthma':
            if category_name in ['Good', 'Satisfactory']:
                advisory_text = f"Good/Satisfactory air quality ({predicted_aqi}) in {city_name}. Low health risk for sensitive groups; routine outdoor activities are completely safe."
            elif category_name == 'Moderate':
                advisory_text = f"Moderate air quality ({predicted_aqi}) in {city_name}. Sensitive individuals may experience mild respiratory discomfort; carry essential medications if spending extended time outside."
            else: # Poor, Very Poor, Severe
                advisory_text = f"Warning: {category_name} air quality ({predicted_aqi}) in {city_name}! High health risk. Sensitive groups should stay indoors, keep windows closed, run air purifiers, and keep emergency inhalers ready."
                
        elif lookup_profile == 'outdoor worker':
            if category_name in ['Good', 'Satisfactory']:
                advisory_text = f"Good/Satisfactory air quality ({predicted_aqi}) in {city_name}. Standard outdoor operations can proceed without extra health precautions."
            elif category_name in ['Moderate', 'Poor']:
                advisory_text = f"Moderate/Poor air quality ({predicted_aqi}) in {city_name}. Outdoor workers should take regular breaks indoors if fatigue or mild breathing discomfort occurs."
            else: # Very Poor, Severe
                advisory_text = f"Alert: {category_name} air quality ({predicted_aqi}) in {city_name}! Wear fit-tested N95 masks during shifts and take hourly indoor breathing breaks."
                
        else: # general public
            if category_name in ['Good', 'Satisfactory']:
                advisory_text = f"Good/Satisfactory air quality ({predicted_aqi}) in {city_name}. Acceptable for routine day-to-day activities."
            elif category_name in ['Moderate', 'Poor']:
                advisory_text = f"Moderate/Poor air quality ({predicted_aqi}) in {city_name}. Acceptable for routine activities, but consider limiting prolonged or intense outdoor physical exertion."
            else: # Very Poor, Severe
                advisory_text = f"Warning: {category_name} air quality ({predicted_aqi}) in {city_name}! Avoid strenuous morning jogging or intense outdoor workouts; stay indoors when possible."

        return category_name, color, advisory_text

    def mock_bhashini_translate(self, text, target_language="Hindi"):
        return f"[{target_language} Regional Text Output]: " + text


# =====================================================================
# DEMO EXECUTION
# =====================================================================
if __name__ == "__main__":
    import sys
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except AttributeError:
        pass

    print("\n=================================================")
    print("      AI ADVISORY AGENT - LOCAL DEMO RUN")
    print("=================================================\n")

    agent = AQIAdvisoryAgent(models_dir="models")
    test_cities = ["Mumbai", "Bengaluru", "Delhi"]
    user_profile = "Asthma"

    for city in test_cities:
        try:
            predicted_aqi, forecast_date = agent.predict_tomorrow_aqi(city=city)
            category, color, advice = agent.generate_health_advisory(predicted_aqi, user_profile, city_name=city)
            print(f"City: {city} | Forecast Date: {forecast_date}")
            print(f"Predicted AQI: {predicted_aqi} | Category: {category} ({color})")
            print(f"Advisory: {advice}")
        except Exception as e:
            print(f"Error for {city}: {e}")
        print("-" * 55 + "\n")