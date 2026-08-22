import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';

export interface ForecastDetails {
  date: string;
  value: number;
  method: string;
  category: string;
  color: string;
  static_advisory: string;
  advisory: string;
  profile: string;
}

export interface ForecastResponse {
  city: string;
  latest_reading_date: string;
  latest_reading_aqi: number;
  forecast_1d: ForecastDetails;
  forecast_2d: ForecastDetails;
  explanation: string;
  // Backwards compatibility keys
  predicted_aqi: number;
  forecast_date: string;
  category: string;
  color: string;
  advisory: string;
  profile: string;
}

export interface StationDetails {
  name: string;
  latitude: number;
  longitude: number;
  aqi: number | null;
  pollutants: {
    pm25?: number | null;
    pm10?: number | null;
    no2?: number | null;
    so2?: number | null;
    co?: number | null;
    o3?: number | null;
    nh3?: number | null;
  };
}

export interface LiveAqiResponse {
  live: boolean;
  city: string;
  date: string;
  aqi: number | null;
  pollutants: {
    pm25: number | null;
    pm10: number | null;
    no2: number | null;
    so2: number | null;
    co: number | null;
    o3: number | null;
    nh3: number | null;
  };
  derived_method: string;
  stations: StationDetails[];
}

@Injectable({
  providedIn: 'root'
})
export class AqiService {
  private http = inject(HttpClient);
  private readonly apiUrl = 'http://127.0.0.1:8000/api/forecast/';
  private readonly liveUrl = 'http://127.0.0.1:8000/api/live-aqi/';

  getForecast(city: string, profile: string): Observable<ForecastResponse> {
    const url = `${this.apiUrl}?city=${encodeURIComponent(city)}&profile=${encodeURIComponent(profile)}`;
    return this.http.get<ForecastResponse>(url).pipe(
      catchError(this.handleError)
    );
  }

  getLiveAqi(city: string): Observable<LiveAqiResponse> {
    const url = `${this.liveUrl}?city=${encodeURIComponent(city)}`;
    return this.http.get<LiveAqiResponse>(url).pipe(
      catchError(this.handleError)
    );
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'An unknown error occurred!';
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Server-side error
      errorMessage = `Backend returned code ${error.status}, body was: ${JSON.stringify(error.error)}`;
    }
    return throwError(() => new Error(errorMessage));
  }
}

