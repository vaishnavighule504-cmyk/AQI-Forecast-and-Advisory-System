import os
import django
import pandas as pd

# 1. Initialize Django Environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'aqi_backend.settings')
django.setup()

from forecast.models import AQIReading

def seed_2025_data():
    print("Loading CSV data...")
    # Make sure this path points to your actual CSV location
    df = pd.read_csv('final_model_ready_data.csv')
    df['Date'] = pd.to_datetime(df['Date'])
    
    # 2. Filter for only 2025 records
    df_2025 = df[df['Date'].dt.year == 2025]
    
    if df_2025.empty:
        print("No 2025 data found in the CSV!")
        return

    print(f"Found {len(df_2025)} records for 2025. Inserting into database...")
    
    # 3. Save records to the database
    count = 0
    for _, row in df_2025.iterrows():
        AQIReading.objects.update_or_create(
            city=row['City'],
            date=row['Date'].date(),
            defaults={
                'aqi': row.get('AQI', 0),
                'pm25': row.get('PM2.5', 50.0),
                'pm10': row.get('PM10', 100.0),
                'no2': row.get('NO2', 30.0),
                'co': row.get('CO', 1.0),
                'so2': row.get('SO2', 20.0),
            }
        )
        count += 1
        
    print(f"Success! Inserted/Updated {count} records for 2025.")

if __name__ == '__main__':
    seed_2025_data()