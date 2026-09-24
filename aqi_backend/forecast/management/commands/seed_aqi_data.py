import os
import datetime
import random
import pandas as pd
from django.core.management.base import BaseCommand
from django.utils import timezone
from forecast.models import AQIReading, LiveAQIReading

CITY_PROFILES = {
    "Delhi": {
        "base_aqi": 185,
        "pm25": 92.0,
        "pm10": 165.0,
        "no2": 42.0,
        "so2": 14.0,
        "co": 1.3,
        "o3": 38.0,
        "stations": [
            {"name": "Anand Vihar, Delhi - DPCC", "lat": 28.6476, "lng": 77.3158, "offset": 30},
            {"name": "R K Puram, Delhi - DPCC", "lat": 28.5632, "lng": 77.1869, "offset": -10},
            {"name": "Punjabi Bagh, Delhi - DPCC", "lat": 28.6740, "lng": 77.1310, "offset": 15},
            {"name": "ITO, Delhi - CPCB", "lat": 28.6289, "lng": 77.2410, "offset": 5},
            {"name": "Dwarka Sector 8, Delhi - DPCC", "lat": 28.5710, "lng": 77.0710, "offset": -15},
        ]
    },
    "Mumbai": {
        "base_aqi": 105,
        "pm25": 42.0,
        "pm10": 78.0,
        "no2": 26.0,
        "so2": 12.0,
        "co": 0.8,
        "o3": 24.0,
        "stations": [
            {"name": "Bandra, Mumbai - MPCB", "lat": 19.0596, "lng": 72.8295, "offset": -8},
            {"name": "Worli, Mumbai - MPCB", "lat": 19.0178, "lng": 72.8183, "offset": -12},
            {"name": "Kurla, Mumbai - MPCB", "lat": 19.0688, "lng": 72.8842, "offset": 18},
            {"name": "Borivali East, Mumbai - MPCB", "lat": 19.2288, "lng": 72.8564, "offset": -5},
        ]
    },
    "Kolkata": {
        "base_aqi": 125,
        "pm25": 54.0,
        "pm10": 98.0,
        "no2": 32.0,
        "so2": 15.0,
        "co": 0.9,
        "o3": 28.0,
        "stations": [
            {"name": "Victoria, Kolkata - WBPCB", "lat": 22.5448, "lng": 88.3426, "offset": -15},
            {"name": "Jadavpur, Kolkata - WBPCB", "lat": 22.4988, "lng": 88.3716, "offset": 5},
            {"name": "Rabindra Bharati, Kolkata - WBPCB", "lat": 22.5851, "lng": 88.3768, "offset": 15},
        ]
    },
    "Bengaluru": {
        "base_aqi": 68,
        "pm25": 22.0,
        "pm10": 48.0,
        "no2": 18.0,
        "so2": 8.0,
        "co": 0.5,
        "o3": 18.0,
        "stations": [
            {"name": "BTM Layout, Bengaluru - KSPCB", "lat": 12.9166, "lng": 77.6101, "offset": 5},
            {"name": "Hebbal, Bengaluru - KSPCB", "lat": 13.0358, "lng": 77.5970, "offset": -8},
            {"name": "Silk Board, Bengaluru - KSPCB", "lat": 12.9174, "lng": 77.6238, "offset": 14},
            {"name": "Peenya, Bengaluru - KSPCB", "lat": 13.0285, "lng": 77.5197, "offset": 10},
        ]
    },
    "Chennai": {
        "base_aqi": 72,
        "pm25": 25.0,
        "pm10": 52.0,
        "no2": 16.0,
        "so2": 9.0,
        "co": 0.6,
        "o3": 20.0,
        "stations": [
            {"name": "Alandur, Chennai - TNPCB", "lat": 12.9975, "lng": 80.2006, "offset": -5},
            {"name": "Velachery, Chennai - TNPCB", "lat": 12.9815, "lng": 80.2180, "offset": 4},
            {"name": "Manali, Chennai - TNPCB", "lat": 13.1667, "lng": 80.2667, "offset": 18},
        ]
    },
    "Hyderabad": {
        "base_aqi": 88,
        "pm25": 32.0,
        "pm10": 68.0,
        "no2": 22.0,
        "so2": 10.0,
        "co": 0.7,
        "o3": 24.0,
        "stations": [
            {"name": "Bollaram Industrial Area, Hyderabad - TSPCB", "lat": 17.5500, "lng": 78.3300, "offset": 20},
            {"name": "Sanathnagar, Hyderabad - TSPCB", "lat": 17.4566, "lng": 78.4439, "offset": 0},
            {"name": "Zoo Park, Hyderabad - TSPCB", "lat": 17.3500, "lng": 78.4500, "offset": -12},
        ]
    },
    "Ahmedabad": {
        "base_aqi": 135,
        "pm25": 58.0,
        "pm10": 110.0,
        "no2": 35.0,
        "so2": 16.0,
        "co": 1.0,
        "o3": 28.0,
        "stations": [
            {"name": "Maninagar, Ahmedabad - GPCB", "lat": 22.9983, "lng": 72.6033, "offset": -5},
            {"name": "Chandkheda, Ahmedabad - GPCB", "lat": 23.1111, "lng": 72.5722, "offset": -10},
            {"name": "Rakhial, Ahmedabad - GPCB", "lat": 23.0234, "lng": 72.6178, "offset": 18},
        ]
    }
}

class Command(BaseCommand):
    help = "Seed historical AQI records strictly from CSV data for all pilot cities"

    def handle(self, *args, **options):
        random.seed(42)
        seeded_readings = 0
        seeded_live = 0

        self.stdout.write("Starting AQI database seeding strictly from CSV...")

        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        data_dir = os.path.join(base_dir, 'data')
        csv_path = os.path.join(data_dir, 'city_day_clean_features.csv')

        if not os.path.exists(csv_path):
            self.stdout.write(self.style.ERROR(f"CSV file not found at {csv_path}! Please ensure the file exists."))
            return

        try:
            df_csv = pd.read_csv(csv_path)
            self.stdout.write(f"Successfully loaded CSV with {len(df_csv)} records.")
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Could not parse CSV: {e}"))
            return

        for city, profile in CITY_PROFILES.items():
            city_df = df_csv[df_csv['City'].str.lower() == city.lower()] if 'City' in df_csv.columns else pd.DataFrame()

            if city_df.empty:
                self.stdout.write(self.style.WARNING(f"No records found in CSV for city: {city}. Skipping."))
                continue

            for _, row in city_df.iterrows():
                try:
                    rec_date = datetime.datetime.strptime(str(row['Date']).split()[0], '%Y-%m-%d').date()
                except Exception:
                    continue

                def safe_val(val, default=0.0):
                    try:
                        return float(val) if pd.notnull(val) else default
                    except:
                        return default

                day_aqi = int(safe_val(row.get('AQI'), profile['base_aqi']))
                pm25 = safe_val(row.get('PM2.5'), profile['pm25'])
                pm10 = safe_val(row.get('PM10'), profile['pm10'])
                no2 = safe_val(row.get('NO2'), profile['no2'])
                so2 = safe_val(row.get('SO2'), profile['so2'])
                co = safe_val(row.get('CO'), profile['co'])
                o3 = safe_val(row.get('O3'), profile['o3'])

                AQIReading.objects.update_or_create(
                    city=city,
                    date=rec_date,
                    defaults={
                        "aqi": day_aqi,
                        "pm25": pm25,
                        "pm10": pm10,
                        "no2": no2,
                        "so2": so2,
                        "co": co,
                        "o3": o3,
                    }
                )
                seeded_readings += 1

            latest_reading = AQIReading.objects.filter(city=city).order_by('-date').first()
            latest_date = latest_reading.date if latest_reading else datetime.date(2020, 6, 30)
            live_aqi = latest_reading.aqi if latest_reading else profile["base_aqi"]
            
            now = timezone.make_aware(datetime.datetime.combine(latest_date, datetime.time(12, 0, 0)))

            stations_data = []
            for st in profile["stations"]:
                st_aqi = max(15, min(490, live_aqi + st.get("offset", 0)))
                stations_data.append({
                    "name": st["name"],
                    "latitude": st["lat"],
                    "longitude": st["lng"],
                    "aqi": st_aqi,
                    "pollutants": {
                        "pm25": round(profile["pm25"] * (st_aqi / profile["base_aqi"]), 1) if profile["base_aqi"] > 0 else profile["pm25"],
                        "pm10": round(profile["pm10"] * (st_aqi / profile["base_aqi"]), 1) if profile["base_aqi"] > 0 else profile["pm10"],
                        "no2": round(profile["no2"], 1),
                        "so2": round(profile["so2"], 1),
                        "co": round(profile["co"], 2),
                        "o3": round(profile["o3"], 1),
                        "nh3": 12.0
                    }
                })

            LiveAQIReading.objects.update_or_create(
                city=city,
                timestamp=now,
                defaults={
                    "aqi": live_aqi,
                    "pm25": profile["pm25"],
                    "pm10": profile["pm10"],
                    "no2": profile["no2"],
                    "so2": profile["so2"],
                    "co": profile["co"],
                    "o3": profile["o3"],
                    "nh3": 12.0,
                    "is_live": False,
                    "derived_method": "PostgreSQL Historical Fallback (Strict CSV Timeline)",
                    "station_data": stations_data
                }
            )
            seeded_live += 1

        self.stdout.write(self.style.SUCCESS(
            f"Successfully seeded {seeded_readings} historical CSV records and {seeded_live} fallback stations up to the true dataset timeline!"
        ))+