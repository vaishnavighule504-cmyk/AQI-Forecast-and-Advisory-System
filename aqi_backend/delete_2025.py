import os
import django

# 1. Initialize Django Environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'aqi_backend.settings')
django.setup()

from forecast.models import AQIReading

def delete_2025_data():
    print("Searching for 2025 records in the database...")
    
    # 2. Filter the database for any records where the year is 2025
    records_to_delete = AQIReading.objects.filter(date__year=2025)
    count = records_to_delete.count()
    
    if count == 0:
        print("No 2025 records found in the database. Nothing to delete!")
        return

    print(f"Found {count} records for 2025. Deleting them now...")
    
    # 3. Delete the records
    deleted_count, _ = records_to_delete.delete()
    
    print(f"Success! Permanently deleted {deleted_count} records from the database.")

if __name__ == '__main__':
    delete_2025_data()