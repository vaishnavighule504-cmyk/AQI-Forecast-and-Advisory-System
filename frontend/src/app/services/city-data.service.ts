import { Injectable, computed, signal } from '@angular/core';
import { ForecastVM, LiveVM } from './aqi-view-models';

export const PILOT_CITIES = ['Delhi', 'Mumbai', 'Bengaluru', 'Chennai', 'Hyderabad', 'Ahmedabad', 'Kolkata'] as const;
export type PilotCity = typeof PILOT_CITIES[number];
export type CityLoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface CityDataResult {
  readonly city: PilotCity;
  readonly live: LiveVM | null;
  readonly forecast: ForecastVM | null;
  readonly status: CityLoadStatus;
  readonly timestamp: string | null;
  readonly error: string | null;
}

const emptyResult = (city: PilotCity): CityDataResult => ({
  city, live: null, forecast: null, status: 'idle', timestamp: null, error: null
});

@Injectable({ providedIn: 'root' })
export class CityDataService {
  private readonly cityMap = signal<Record<PilotCity, CityDataResult>>(
    Object.fromEntries(PILOT_CITIES.map(city => [city, emptyResult(city)])) as Record<PilotCity, CityDataResult>
  );

  readonly cities = PILOT_CITIES;
  readonly results = computed(() => PILOT_CITIES.map(city => this.cityMap()[city]));
  readonly selectedCity = signal<PilotCity | null>(null);

  setSelectedCity(city: string): void {
    if (this.isPilotCity(city)) this.selectedCity.set(city);
  }

  beginLoad(city: string, preserve = false): void {
    if (!this.isPilotCity(city)) return;
    this.update(city, previous => ({
      ...previous,
      live: preserve ? previous.live : null,
      forecast: preserve ? previous.forecast : null,
      timestamp: preserve ? previous.timestamp : null,
      status: 'loading',
      error: null
    }));
  }

  storeLive(city: string, live: LiveVM): void {
    if (!this.isPilotCity(city)) return;
    this.update(city, previous => {
      const next = { ...previous, live, timestamp: live.updatedTime ?? previous.timestamp };
      return this.hasData(next) ? { ...next, status: 'ready', error: null } : next;
    });
  }

  storeForecast(city: string, forecast: ForecastVM): void {
    if (!this.isPilotCity(city)) return;
    this.update(city, previous => {
      const next = { ...previous, forecast, timestamp: previous.timestamp ?? forecast.latestReadingDate };
      return this.hasData(next) ? { ...next, status: 'ready', error: null } : next;
    });
  }

  finishLoad(city: string, error = 'No usable AQI or forecast data was returned.'): void {
    if (!this.isPilotCity(city)) return;
    this.update(city, previous => this.hasData(previous)
      ? { ...previous, status: 'ready', error: null }
      : { ...previous, status: 'error', error });
  }

  failLoad(city: string, error = 'City data could not be loaded.'): void {
    if (!this.isPilotCity(city)) return;
    this.update(city, previous => this.hasData(previous)
      ? { ...previous, status: 'ready', error }
      : { ...previous, status: 'error', error });
  }

  private hasData(result: CityDataResult): boolean {
    const liveHasData = result.live !== null && result.live.dataStatus !== 'unavailable';
    const forecastHasData = result.forecast !== null && result.forecast.dataStatus !== 'unavailable';
    return liveHasData || forecastHasData;
  }

  private isPilotCity(city: string): city is PilotCity {
    return (PILOT_CITIES as readonly string[]).includes(city);
  }

  private update(city: PilotCity, updater: (current: CityDataResult) => CityDataResult): void {
    this.cityMap.update(current => ({ ...current, [city]: updater(current[city]) }));
  }
}
