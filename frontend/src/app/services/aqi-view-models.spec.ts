import { describe, expect, it } from 'vitest';
import { isExplicitDemoMode, toForecastVM, toLiveVM } from './aqi-view-models';

describe('AQI view-model adapters', () => {
  it('preserves live readings and leaves missing pollutant values unavailable', () => {
    const result = toLiveVM({ live: true, city: 'Delhi', date: '2026-10-15', aqi: 91, pollutants: { pm25: 20 } });
    expect(result.dataStatus).toBe('live');
    expect(result.aqi).toBe(91);
    expect(result.pollutants?.['pm25']).toBe(20);
    expect(result.pollutants?.['pm10']).toBeNull();
  });

  it('marks stored responses and does not treat empty or malformed data as stored', () => {
    expect(toLiveVM({ live: false, aqi: 110 }).dataStatus).toBe('stored');
    expect(toLiveVM({}).dataStatus).toBe('unavailable');
    expect(toLiveVM(null).aqi).toBeNull();
    expect(toLiveVM({ live: true, aqi: '110' }).aqi).toBeNull();
  });

  it('normalizes available forecast fields and keeps missing values null', () => {
    const result = toForecastVM({ city: 'Delhi', forecast_1d: { value: 125, date: '2026-10-16' } });
    expect(result.dataStatus).toBe('backend');
    expect(result.day1?.value).toBe(125);
    expect(result.day1?.advisory).toBeNull();
    expect(result.day2).toBeNull();
    expect(toForecastVM({}).dataStatus).toBe('unavailable');
    expect(toForecastVM(null).latestReadingAqi).toBeNull();
  });

  it('omits backend guidance that contains diagnosis or treatment instructions', () => {
    const result = toForecastVM({ forecast_1d: { value: 120, advisory: 'Avoid prolonged outdoor activity. Take medication as prescribed.' } });
    expect(result.day1?.advisory).toBe('Avoid prolonged outdoor activity.');
  });

  it('only enables demo data for an explicit mock=1 query parameter', () => {
    expect(isExplicitDemoMode('?mock=1')).toBe(true);
    expect(isExplicitDemoMode('?city=Delhi&mock=0')).toBe(false);
    expect(isExplicitDemoMode('')).toBe(false);
  });
});
