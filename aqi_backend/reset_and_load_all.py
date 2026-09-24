import os
import django
import pandas as pd

# 1. Initialize Django Environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'aqi_backend.settings')
django.setup()

from forecast.models import AQIReading

def reset_and_load():
    # Step A: Wipe the old database clean
    print("1. Clearing out all old database records...")
    deleted_count, _ = AQIReading.objects.all().delete()
    print(f" -> Permanently deleted {deleted_count} old records.")

    # Step B: Load the complete CSV
    print("\n2. Reading the complete CSV data...")
    df = pd.read_csv('final_model_ready_data.csv')
    df['Date'] = pd.to_datetime(df['Date'])
    
    # NEW STEP: Drop duplicates to prevent database IntegrityErrors
    original_len = len(df)
    df = df.drop_duplicates(subset=['City', 'Date'], keep='last')
    new_len = len(df)
    
    if original_len != new_len:
        print(f" -> Automatically removed {original_len - new_len} duplicate records.")
    
    print(f" -> Preparing {new_len} unique records for bulk insert...")
    
    # Step C: Package the records for a rapid bulk insertion
    records_to_insert = []
    for _, row in df.iterrows():
        records_to_insert.append(AQIReading(
            city=row['City'],
            date=row['Date'].date(),
            aqi=row.get('AQI', 0),
            pm25=row.get('PM2.5', 50.0),
            pm10=row.get('PM10', 100.0),
            no2=row.get('NO2', 30.0),
            co=row.get('CO', 1.0),
            so2=row.get('SO2', 20.0)
        ))
        
    # Step D: Save everything to the database quickly in batches
    print("\n3. Saving to database... (this might take a few seconds)")
    AQIReading.objects.bulk_create(records_to_insert, batch_size=2000, ignore_conflicts=True)
    
    print(f"\nSUCCESS! Your database is now fully synchronized with {new_len} rows.")

if __name__ == '__main__':
    reset_and_load()