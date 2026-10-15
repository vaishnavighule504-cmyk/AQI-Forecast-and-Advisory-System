import { StationDetails } from './aqi.service';

export type DataStatus = 'live' | 'stored' | 'backend' | 'demo' | 'loading' | 'unavailable';

export interface ForecastDayVM {
  value: number | null;
  date: string | null;
  category: string | null;
  advisory: string | null;
  profile: string | null;
}

export interface ForecastVM {
  city: string | null;
  latestReadingDate: string | null;
  latestReadingAqi: number | null;
  day1: ForecastDayVM | null;
  day2: ForecastDayVM | null;
  history: unknown[] | null;
  dataStatus: DataStatus;
}

export interface LiveVM {
  city: string | null;
  aqi: number | null;
  category: string | null;
  updatedTime: string | null;
  pollutants: Record<string, number | null> | null;
  stations: StationDetails[] | null;
  dataStatus: DataStatus;
}

type JsonRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is JsonRecord => typeof value === 'object' && value !== null && !Array.isArray(value);
const numberOrNull = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
const stringOrNull = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value : null;
const safeGuidanceOrNull = (value: unknown): string | null => {
  const text = stringOrNull(value);
  if (!text) return null;
  const unsafe = /\b(diagnos\w*|prescri\w*|medicat\w*|medicin\w*|treat(?:ment)?s?|cure\w*|guarantee\w*|dosage?|inhaler\w*|drug\w*)\b/i;
  const safeLines = text.split(/\r?\n|(?<=[.!?])\s+/).filter(line => !unsafe.test(line));
  return safeLines.join('\n').trim() || null;
};

export function isExplicitDemoMode(search: string): boolean {
  return new URLSearchParams(search).get('mock') === '1';
}

export function toForecastVM(input: unknown, source: DataStatus = 'backend'): ForecastVM {
  const value = isRecord(input) ? input : {};
  const day = (candidate: unknown): ForecastDayVM | null => {
    if (!isRecord(candidate)) return null;
    return {
      value: numberOrNull(candidate['value']),
      date: stringOrNull(candidate['date']),
      category: stringOrNull(candidate['category']),
      advisory: safeGuidanceOrNull(candidate['advisory']),
      profile: stringOrNull(candidate['profile'])
    };
  };
  const history = Array.isArray(value['history']) ? value['history'] : null;
  const latestReadingAqi = numberOrNull(value['latest_reading_aqi']);
  const day1 = day(value['forecast_1d']);
  const day2 = day(value['forecast_2d']);
  const hasData = latestReadingAqi !== null || day1?.value !== null && day1?.value !== undefined ||
    day2?.value !== null && day2?.value !== undefined || !!history?.length;

  return {
    city: stringOrNull(value['city']),
    latestReadingDate: stringOrNull(value['latest_reading_date']),
    latestReadingAqi,
    day1,
    day2,
    history,
    dataStatus: source === 'demo' ? 'demo' : hasData ? source : 'unavailable'
  };
}

export function toLiveVM(input: unknown): LiveVM {
  const value = isRecord(input) ? input : {};
  const rawPollutants = isRecord(value['pollutants']) ? value['pollutants'] : null;
  const pollutantKeys = ['pm25', 'pm10', 'no2', 'so2', 'co', 'o3', 'nh3'];
  const pollutants = rawPollutants
    ? Object.fromEntries(pollutantKeys.map(key => [key, numberOrNull(rawPollutants[key])]))
    : null;
  const stations = Array.isArray(value['stations'])
    ? value['stations'].filter((station): station is JsonRecord => isRecord(station) && typeof station['name'] === 'string')
      .map(station => ({
        name: station['name'] as string,
        latitude: numberOrNull(station['latitude']),
        longitude: numberOrNull(station['longitude']),
        aqi: numberOrNull(station['aqi']),
        pollutants: isRecord(station['pollutants'])
          ? Object.fromEntries(pollutantKeys.map(key => [key, numberOrNull((station['pollutants'] as JsonRecord)[key])]))
          : {}
      }))
    : null;
  const aqi = numberOrNull(value['aqi']);
  const hasMeasurement = aqi !== null || Object.values(pollutants || {}).some(item => item !== null) || !!stations?.length;
  const dataStatus: DataStatus = !hasMeasurement ? 'unavailable' : value['live'] === true ? 'live' : value['live'] === false ? 'stored' : 'backend';
  const category = aqi === null ? null : aqi <= 50 ? 'Good' : aqi <= 100 ? 'Satisfactory' : aqi <= 200 ? 'Moderate' : aqi <= 300 ? 'Poor' : aqi <= 400 ? 'Very Poor' : 'Severe';

  return {
    city: stringOrNull(value['city']),
    aqi,
    category,
    updatedTime: stringOrNull(value['date']),
    pollutants,
    stations,
    dataStatus
  };
}
