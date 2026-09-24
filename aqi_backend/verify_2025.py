# 1st 15-days of 2025
# import pandas as pd
# import joblib
# import numpy as np

# def run_verification():
#     print("Loading model and 2025 data...")
    
#     # 1. Load your trained model
#     model = joblib.load('aqi_model.pkl')
    
#     # 2. Load the CSV
#     df = pd.read_csv('final_model_ready_data.csv')
#     df['Date'] = pd.to_datetime(df['Date'])
    
#     # 3. Filter for 2025 and pick a specific city to test (e.g., Delhi)
#     city_to_test = 'Bengaluru'
#     df_2025 = df[(df['Date'].dt.year == 2025) & (df['City'] == city_to_test)].sort_values('Date').copy()
    
#     if df_2025.empty:
#         print(f"No 2025 data found for {city_to_test}.")
#         return

#     # 4. Extract the exact features the model requires
#     features = [
#         'PM2.5', 'PM10', 'NO2', 'CO', 'SO2',
#         'AQI_lag1', 'AQI_lag3', 'AQI_lag7',
#         'AQI_rolling_mean_3d', 'AQI_rolling_mean_7d',
#         'AQI_rolling_std_7d', 'day_of_week', 'month'
#     ]
    
#     X_test = df_2025[features]
    
#     # 5. Generate Predictions!
#     df_2025['Predicted_AQI'] = np.round(model.predict(X_test))
    
#     # Calculate the error (Difference between Predicted and Actual)
#     df_2025['Difference'] = df_2025['Predicted_AQI'] - df_2025['AQI']
    
#     # 6. Display the side-by-side comparison
#     print(f"\n--- Side-by-Side Verification for {city_to_test} (First 15 days of 2025) ---")
    
#     # Rename for cleaner printing
#     display_df = df_2025[['Date', 'AQI', 'Predicted_AQI', 'Difference']].rename(
#         columns={'AQI': 'Actual AQI'}
#     )
#     # Convert Date to string for cleaner output
#     display_df['Date'] = display_df['Date'].dt.strftime('%Y-%m-%d') 
    
#     print(display_df.head(15).to_string(index=False))
    
#     # 7. Calculate overall accuracy for the whole year
#     mae = np.mean(np.abs(df_2025['Difference']))
#     print(f"\nOverall Average Error (MAE) for 2025: {mae:.2f} AQI points")

# if __name__ == '__main__':
#     run_verification()


# last 15-days of 2025
import pandas as pd
import joblib
import numpy as np

def run_late_verification():
    print("Loading model and 2025 data...")
    
    # 1. Load your trained model
    model = joblib.load('aqi_model.pkl')
    
    # 2. Load the CSV
    df = pd.read_csv('final_model_ready_data.csv')
    df['Date'] = pd.to_datetime(df['Date'])
    
    # 3. Filter for 2025, pick Delhi, and get the LAST 15 days of the year
    city_to_test = 'Mumbai'
    df_2025 = df[(df['Date'].dt.year == 2025) & (df['City'] == city_to_test)].sort_values('Date').copy()
    
    if df_2025.empty:
        print(f"No 2025 data found for {city_to_test}.")
        return

    # Grab the tail end (last 15 rows of 2025)
    df_late_2025 = df_2025.tail(15)

    # 4. Extract the exact features the model requires
    features = [
        'PM2.5', 'PM10', 'NO2', 'CO', 'SO2',
        'AQI_lag1', 'AQI_lag3', 'AQI_lag7',
        'AQI_rolling_mean_3d', 'AQI_rolling_mean_7d',
        'AQI_rolling_std_7d', 'day_of_week', 'month'
    ]
    
    X_test = df_late_2025[features]
    
    # 5. Generate Predictions!
    df_late_2025 = df_late_2025.copy()
    df_late_2025['Predicted_AQI'] = np.round(model.predict(X_test))
    
    # Calculate the error (Difference between Predicted and Actual)
    df_late_2025['Difference'] = df_late_2025['Predicted_AQI'] - df_late_2025['AQI']
    
    # 6. Display the side-by-side comparison
    print(f"\n--- Side-by-Side Verification for {city_to_test} (Last 15 days of 2025) ---")
    
    display_df = df_late_2025[['Date', 'AQI', 'Predicted_AQI', 'Difference']].rename(
        columns={'AQI': 'Actual AQI'}
    )
    display_df['Date'] = display_df['Date'].dt.strftime('%Y-%m-%d') 
    
    print(display_df.to_string(index=False))
    
    # 7. Calculate overall accuracy for these final days
    mae = np.mean(np.abs(df_late_2025['Difference']))
    print(f"\nAverage Error (MAE) for late 2025: {mae:.2f} AQI points")

if __name__ == '__main__':
    run_late_verification()