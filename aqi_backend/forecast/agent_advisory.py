import os
import joblib
import pandas as pd
import numpy as np
import requests
import ollama
import socket
import threading

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

class AQIAdvisoryAgent:
    def __init__(self, models_dir="../../ml_models"):
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
        model_file = os.path.join(self.models_dir, "aqi_model.pkl")

        # 1. Fetch live ground-truth AQI (raises exception on failure)
        live_aqi = self.fetch_live_aqi(city_slug)
        if live_aqi <= 0:
            raise RuntimeError(f"Invalid non-positive live AQI value fetched for {city}: {live_aqi}")

        predicted_value = live_aqi
        method_used = "Baseline Live Telemetry"

        # 2. Use your custom trained machine learning model instead of Prophet
        if os.path.exists(model_file):
            try:
                model = joblib.load(model_file)
                # Construct feature input matching your custom model training shape
                # (e.g., [live_aqi, temperature, humidity, wind_speed])
                features = np.array([[float(live_aqi), 30.0, 50.0, 5.0]])
                
                if hasattr(model, "predict"):
                    pred_res = model.predict(features)
                    predicted_value = int(round(float(pred_res[0])))
                    method_used = "Custom ML Model (aqi_model.pkl)"
            except Exception as e:
                print(f"[Model Warning] Custom model inference failed for {city}: {e}, falling back to baseline.")

        # Clip prediction to realistic physical limits
        predicted_value = int(np.clip(predicted_value, 15, 500))

        # Safe print diagnostics
        print(f"[Live API + Custom ML] City: {city.capitalize()}")
        print(f"  - Live Baseline AQI: {live_aqi}")
        print(f"  - Method Used: {method_used}")
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

    def generate_llm_health_advisory(self, predicted_aqi, category, profile_type, city_name):
        """
        Generates a personalized, 3-bullet-point clinical advisory using a local Ollama LLM.
        Falls back to static deterministic rules if the LLM daemon is unreachable.
        """
        def is_ollama_running():
            try:
                with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                    s.settimeout(0.15)
                    s.connect(("127.0.0.1", 11434))
                    return True
            except Exception:
                return False

        # Define a strict system prompt tailored to the profile
        prompt = f"""
        You are a clinical respiratory expert. 
        The current Air Quality Index (AQI) in {city_name} is {predicted_aqi} ({category} category).
        The user profile is: {profile_type}.
    
        Generate exactly 3 concise, bulleted health recommendations.
        - Bullet 1 must specify safe vs. hazardous outdoor time windows.
        - Bullet 2 must explicitly address N95 mask usage.
        - Bullet 3 must address specific medication (like inhalers) or physical exertion limits based on the profile.
        
        Do NOT include any introductory or concluding text. Only output the 3 bullets.
        """
        
        # Check if Ollama port is open first to avoid slow timeouts
        if not is_ollama_running():
            print("[LLM Fallback Alert] Ollama server is offline. Using fast deterministic fallback.")
            return self._get_static_fallback(predicted_aqi, profile_type)

        result_container = []
        
        def call_ollama():
            try:
                res = ollama.chat(model='llama3', messages=[
                    {'role': 'system', 'content': 'You are a direct, concise medical advisory system.'},
                    {'role': 'user', 'content': prompt}
                ])
                val = res['message']['content'].strip()
                if val:
                    result_container.append(val)
            except Exception:
                pass

        thread = threading.Thread(target=call_ollama)
        thread.daemon = True
        thread.start()
        thread.join(timeout=0.4)
        
        if result_container:
            return result_container[0]
            
        print("[LLM Fallback Alert] Ollama daemon did not respond within 0.4 seconds. Using fast deterministic fallback.")
        return self._get_static_fallback(predicted_aqi, profile_type)

    def _get_static_fallback(self, predicted_aqi, profile_type):
        lookup_profile = profile_type.strip().lower()
        if lookup_profile in ['asthma', 'respiratory', 'elderly', 'child']:
            if predicted_aqi <= 100:
                return ("- Outdoor time: Routine outdoor activities are safe.\n"
                        "- Masks: No mask required.\n"
                        "- Medication: Carry emergency inhalers just in case.")
            else:
                return ("- Outdoor time: Stay indoors; keep windows closed and run air purifiers.\n"
                        "- Masks: Wear a well-fitted N95 mask if you must go outside.\n"
                        "- Medication: Keep emergency inhalers ready and avoid all outdoor physical exertion.")
                
        elif lookup_profile in ['outdoor worker', 'traffic police', 'delivery']:
            if predicted_aqi <= 100:
                return ("- Outdoor time: Standard outdoor operations can proceed safely.\n"
                        "- Masks: No mask required.\n"
                        "- Precautions: Stay hydrated during shifts.")
            else:
                return ("- Outdoor time: Take regular 15-minute indoor breathing breaks every hour.\n"
                        "- Masks: Fit-tested N95 masks are mandatory during shifts.\n"
                        "- Precautions: Reduce heavy physical lifting outdoors where possible.")
                
        else: # General Public
            if predicted_aqi <= 100:
                return ("- Outdoor time: Safe for routine day-to-day activities.\n"
                        "- Masks: Optional.\n"
                        "- Precautions: None required.")
            else:
                return ("- Outdoor time: Avoid strenuous morning jogging or intense outdoor workouts.\n"
                        "- Masks: Consider an N95 mask for prolonged outdoor exposure.\n"
                        "- Precautions: Limit intense physical exertion outside.")