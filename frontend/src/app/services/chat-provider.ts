import { Injectable } from '@angular/core';
import { DataStatus, ForecastVM, LiveVM } from './aqi-view-models';
import { PilotCity } from './city-data.service';
import { UserProfile } from './profile.service';

export interface AssistantCitySnapshot {
  city: PilotCity;
  live: LiveVM | null;
  forecast: ForecastVM | null;
}

export interface AssistantContext {
  city: string;
  currentAqi: number | null;
  band: string | null;
  dataStatus: DataStatus;
  forecastStatus: DataStatus;
  pollutants: Record<string, number | null> | null;
  tomorrow: { value: number | null; date: string | null; advisory: string | null } | null;
  dayAfter: { value: number | null; date: string | null } | null;
  savedProfile: UserProfile | null;
  otherCities: AssistantCitySnapshot[];
}

export interface ChatChip {
  label: string;
  question: string;
  city?: PilotCity;
}

export interface ChatReply {
  text: string;
  sources: string[];
  sourceLine: string;
  dataStatus: DataStatus;
  dataStatusLabel: string;
  chips: ChatChip[];
}

export interface ChatProvider {
  answer(question: string, context: AssistantContext): ChatReply;
}

type IntentName =
  | 'greeting' | 'current_aqi' | 'forecast_tomorrow' | 'forecast_two_day' | 'trend'
  | 'safe_outside' | 'mask' | 'dominant_pollutant' | 'pollutant_explain' | 'why_high'
  | 'aqi_scale' | 'compare_cities' | 'city_query' | 'profile_advice' | 'how_forecast_works'
  | 'data_source' | 'alerts_help' | 'out_of_scope';

interface IntentDefinition {
  name: IntentName;
  keywords: Array<{ phrase: string; weight: number }>;
}

const cityNames: readonly PilotCity[] = ['Delhi', 'Mumbai', 'Bengaluru', 'Chennai', 'Hyderabad', 'Ahmedabad', 'Kolkata'];

@Injectable({ providedIn: 'root' })
export class RuleBasedChatProvider implements ChatProvider {
  private readonly scales: Record<string, { label: string; max: number }> = {
    pm25: { label: 'PM2.5', max: 250 }, pm10: { label: 'PM10', max: 400 }, no2: { label: 'NO₂', max: 200 },
    so2: { label: 'SO₂', max: 100 }, co: { label: 'CO', max: 10 }, o3: { label: 'O₃', max: 150 }
  };

  private readonly intents: IntentDefinition[] = [
    { name: 'greeting', keywords: [{ phrase: 'hello', weight: 4 }, { phrase: 'hi', weight: 3 }, { phrase: 'hey', weight: 4 }, { phrase: 'good morning', weight: 4 }, { phrase: 'good evening', weight: 4 }] },
    { name: 'current_aqi', keywords: [{ phrase: 'current aqi', weight: 5 }, { phrase: 'today aqi', weight: 5 }, { phrase: "today's aqi", weight: 5 }, { phrase: 'right now', weight: 3 }, { phrase: 'current reading', weight: 4 }, { phrase: 'what is the aqi', weight: 4 }, { phrase: 'today air quality', weight: 4 }] },
    { name: 'forecast_tomorrow', keywords: [{ phrase: 'tomorrow', weight: 4 }, { phrase: 'forecast 1d', weight: 5 }, { phrase: 'next day', weight: 4 }] },
    { name: 'forecast_two_day', keywords: [{ phrase: 'day after', weight: 5 }, { phrase: 'two day forecast', weight: 5 }, { phrase: '2 day forecast', weight: 5 }, { phrase: '48 hour', weight: 4 }] },
    { name: 'trend', keywords: [{ phrase: 'trend', weight: 4 }, { phrase: 'improving', weight: 5 }, { phrase: 'worsening', weight: 5 }, { phrase: 'getting better', weight: 5 }, { phrase: 'getting worse', weight: 5 }, { phrase: 'rise or fall', weight: 4 }] },
    { name: 'safe_outside', keywords: [{ phrase: 'safe outside', weight: 5 }, { phrase: 'safe to go outside', weight: 5 }, { phrase: 'go outside', weight: 4 }, { phrase: 'jog', weight: 5 }, { phrase: 'walk', weight: 4 }, { phrase: 'run', weight: 4 }, { phrase: 'exercise', weight: 4 }, { phrase: 'go out', weight: 4 }, { phrase: 'children playing', weight: 5 }, { phrase: 'outdoor activity', weight: 4 }, { phrase: 'what should i do', weight: 1 }] },
    { name: 'mask', keywords: [{ phrase: 'mask', weight: 5 }, { phrase: 'wear a face covering', weight: 4 }] },
    { name: 'dominant_pollutant', keywords: [{ phrase: 'highest pollutant', weight: 6 }, { phrase: 'dominant pollutant', weight: 6 }, { phrase: 'which pollutant', weight: 5 }, { phrase: 'pollutant levels', weight: 3 }] },
    { name: 'pollutant_explain', keywords: [{ phrase: 'what is pm2.5', weight: 6 }, { phrase: 'what is pm10', weight: 6 }, { phrase: 'what is no2', weight: 6 }, { phrase: 'what is so2', weight: 6 }, { phrase: 'what is co', weight: 6 }, { phrase: 'what is o3', weight: 6 }, { phrase: 'explain pm2.5', weight: 6 }, { phrase: 'explain pm10', weight: 6 }, { phrase: 'explain no2', weight: 6 }, { phrase: 'explain so2', weight: 6 }, { phrase: 'explain co', weight: 6 }, { phrase: 'explain o3', weight: 6 }] },
    { name: 'why_high', keywords: [{ phrase: 'why high', weight: 6 }, { phrase: 'why is aqi high', weight: 6 }, { phrase: 'why is the aqi high', weight: 6 }, { phrase: 'cause of aqi', weight: 5 }, { phrase: 'why is pollution high', weight: 6 }] },
    { name: 'aqi_scale', keywords: [{ phrase: 'what does moderate mean', weight: 6 }, { phrase: 'what does poor mean', weight: 6 }, { phrase: 'aqi scale', weight: 5 }, { phrase: 'aqi category', weight: 5 }, { phrase: 'cpcb band', weight: 5 }, { phrase: 'what is moderate', weight: 4 }, { phrase: 'what is poor', weight: 4 }] },
    { name: 'compare_cities', keywords: [{ phrase: 'compare cities', weight: 6 }, { phrase: 'city comparison', weight: 5 }, { phrase: 'highest city', weight: 5 }, { phrase: 'lowest city', weight: 5 }, { phrase: 'other cities', weight: 4 }] },
    { name: 'city_query', keywords: [{ phrase: 'how is', weight: 2 }, { phrase: 'aqi in', weight: 5 }, { phrase: 'air quality in', weight: 5 }, { phrase: 'forecast in', weight: 5 }, { phrase: 'reading in', weight: 4 }, ...cityNames.map(city => ({ phrase: city.toLowerCase(), weight: 1 }))] },
    { name: 'profile_advice', keywords: [{ phrase: 'my profile', weight: 5 }, { phrase: 'my guidance', weight: 5 }, { phrase: 'personalized', weight: 4 }, { phrase: 'selected profile', weight: 5 }] },
    { name: 'how_forecast_works', keywords: [{ phrase: 'how does the forecast work', weight: 6 }, { phrase: 'how forecast works', weight: 6 }, { phrase: 'how is aqi forecast', weight: 6 }, { phrase: 'model works', weight: 4 }, { phrase: 'forecast model', weight: 4 }] },
    { name: 'data_source', keywords: [{ phrase: 'is this live', weight: 6 }, { phrase: 'is it live', weight: 6 }, { phrase: 'live data', weight: 5 }, { phrase: 'data source', weight: 5 }, { phrase: 'where is this from', weight: 4 }, { phrase: 'last updated', weight: 3 }] },
    { name: 'alerts_help', keywords: [{ phrase: 'alert', weight: 4 }, { phrase: 'notification', weight: 4 }, { phrase: 'threshold', weight: 3 }] },
    { name: 'out_of_scope', keywords: [{ phrase: 'recipe', weight: 5 }, { phrase: 'football', weight: 5 }, { phrase: 'movie', weight: 5 }, { phrase: 'bitcoin', weight: 5 }, { phrase: 'write code', weight: 5 }, { phrase: 'capital of', weight: 5 }] }
  ];

  answer(question: string, context: AssistantContext): ChatReply {
    const normalized = question.toLowerCase().replace(/[’]/g, "'").trim();
    const city = this.detectCity(question);
    if (city && city.toLowerCase() !== context.city.toLowerCase()) {
      const snapshot = context.otherCities?.find(item => item.city.toLowerCase() === city.toLowerCase());
      if (!snapshot || (!snapshot.live && !snapshot.forecast)) {
        return this.reply(`I don't have ${city} loaded yet. Switch to that city on the dashboard to load its data.`, 'unavailable', [`${city}, data unavailable`], [
          { label: `Switch to ${city}`, question: '', city },
          { label: 'Ask about selected city', question: 'What is today’s AQI?' },
          { label: 'Compare loaded cities', question: 'Compare loaded cities' }
        ]);
      }
      context = this.contextForSnapshot(snapshot, context);
    }

    const scored = this.score(normalized);
    const top = scored[0];
    const tied = scored.length > 1 && scored[1].score === top.score;
    if (!top.score || top.score < 3 || tied) {
      if (!top.score && !this.hasAirQualityCue(normalized)) return this.outOfScope(context);
      return this.clarify(context);
    }
    if (top.name === 'out_of_scope') return this.outOfScope(context);

    switch (top.name) {
      case 'greeting': return this.reply('Hello! I can help with this dashboard’s air-quality readings, pollutants, forecasts, and general guidance.', context.dataStatus, this.source(context), this.followups('greeting'));
      case 'current_aqi': return this.currentAqi(context);
      case 'forecast_tomorrow': return this.forecast(context, 'tomorrow');
      case 'forecast_two_day': return this.forecast(context, 'dayAfter');
      case 'trend': return this.trend(context);
      case 'safe_outside': return this.safeOutside(context);
      case 'mask': return this.mask(context);
      case 'dominant_pollutant': return this.dominantPollutant(context, false);
      case 'why_high': return this.dominantPollutant(context, true);
      case 'pollutant_explain': return this.pollutantExplanation(normalized, context);
      case 'aqi_scale': return this.aqiScale(context);
      case 'compare_cities': return this.compareCities(context);
      case 'city_query': return this.currentAqi(context);
      case 'profile_advice': return this.profileAdvice(context);
      case 'how_forecast_works': return this.generalKnowledge('SaansCast uses lag and rolling AQI features plus calendar features, trained on 2015 to 2020 CPCB data. Delhi, Mumbai and Kolkata use linear or ridge models; the other four cities use a persistence baseline.', context, 'how_forecast_works');
      case 'data_source': return this.dataSource(context);
      case 'alerts_help': return this.reply('Alerts use the saved threshold and the readings or forecasts loaded by this app. They work only while the app is open; background push is not enabled.', context.dataStatus, this.source(context), this.followups('alerts_help'));
      default: return this.outOfScope(context);
    }
  }

  private score(question: string): Array<{ name: IntentName; score: number }> {
    const scores = this.intents.map(intent => ({
      name: intent.name,
      score: intent.keywords.reduce((total, keyword) => total + (this.matches(question, keyword.phrase) ? keyword.weight : 0), 0)
    }));
    return scores.sort((a, b) => b.score - a.score);
  }

  private matches(question: string, phrase: string): boolean {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    return new RegExp(`(^|[^\\w])${escaped}($|[^\\w])`, 'i').test(question);
  }

  private detectCity(question: string): PilotCity | null {
    return cityNames.find(city => this.matches(question.toLowerCase(), city.toLowerCase())) || null;
  }

  private hasAirQualityCue(question: string): boolean {
    return /\b(aqi|air|pollut|forecast|outside|outdoor|mask|profile|cpcb|pm2\.5|pm10|no2|so2|\bco\b|o3)\b/i.test(question);
  }

  private contextForSnapshot(snapshot: AssistantCitySnapshot, original: AssistantContext): AssistantContext {
    const live = snapshot.live;
    const forecast = snapshot.forecast;
    const currentAqi = live?.aqi ?? forecast?.latestReadingAqi ?? null;
    const dataStatus = live?.aqi !== null && live?.aqi !== undefined ? live.dataStatus : forecast?.dataStatus ?? 'unavailable';
    const forecastStatus = forecast?.dataStatus ?? 'unavailable';
    return {
      ...original,
      city: snapshot.city,
      currentAqi,
      band: live?.category ?? (currentAqi === null ? null : this.bandFor(currentAqi)),
      dataStatus,
      forecastStatus,
      pollutants: live?.pollutants ?? null,
      tomorrow: forecast?.day1 ? { value: forecast.day1.value, date: forecast.day1.date, advisory: forecast.day1.advisory } : null,
      dayAfter: forecast?.day2 ? { value: forecast.day2.value, date: forecast.day2.date } : null
    };
  }

  private bandFor(aqi: number): string {
    if (aqi <= 50) return 'Good';
    if (aqi <= 100) return 'Satisfactory';
    if (aqi <= 200) return 'Moderate';
    if (aqi <= 300) return 'Poor';
    if (aqi <= 400) return 'Very Poor';
    return 'Severe';
  }

  private currentAqi(context: AssistantContext): ChatReply {
    if (context.currentAqi === null) return this.unavailable(context, 'The current AQI value is unavailable. Retry the request or load this city again.');
    return this.reply(`${context.city} has AQI ${context.currentAqi}${context.band ? ` (${context.band})` : ''}.`, context.dataStatus, this.source(context, 'current reading'), this.followups('current_aqi'));
  }

  private forecast(context: AssistantContext, horizon: 'tomorrow' | 'dayAfter'): ChatReply {
    const value = horizon === 'tomorrow' ? context.tomorrow?.value : context.dayAfter?.value;
    const date = horizon === 'tomorrow' ? context.tomorrow?.date : context.dayAfter?.date;
    const endpoint = horizon === 'tomorrow' ? 'forecast_1d' : 'forecast_2d';
    if (value === null || value === undefined) return this.unavailable(context, `${horizon === 'tomorrow' ? 'Tomorrow’s' : 'The day-after'} forecast is unavailable. Retry or load the city again.`, endpoint, context.forecastStatus);
    return this.reply(`${horizon === 'tomorrow' ? 'Tomorrow’s' : 'The day-after'} forecast for ${context.city} is AQI ${value}${date ? ` for ${date}` : ''}.`, context.forecastStatus, this.source(context, endpoint, context.forecastStatus), this.followups(horizon === 'tomorrow' ? 'forecast_tomorrow' : 'forecast_two_day'));
  }

  private trend(context: AssistantContext): ChatReply {
    if (context.currentAqi === null || context.tomorrow?.value === null || context.tomorrow?.value === undefined) return this.unavailable(context, 'The current reading or tomorrow’s forecast is unavailable, so I cannot compare the trend. Retry or load the city again.', 'forecast_1d');
    const tomorrow = context.tomorrow.value;
    const delta = tomorrow - context.currentAqi;
    const change = delta > 0 ? `higher by ${delta}` : delta < 0 ? `lower by ${Math.abs(delta)}` : 'unchanged';
    return this.reply(`Tomorrow’s forecast is ${change} than the current AQI (${context.currentAqi} to ${tomorrow}).`, context.forecastStatus, this.source(context, 'forecast_1d', context.forecastStatus), this.followups('trend'));
  }

  private safeOutside(context: AssistantContext): ChatReply {
    const band = context.band?.toLowerCase();
    const profile = this.profileType(context.savedProfile?.sensitivity);
    if (!band) return this.unavailable(context, 'The current AQI band is unavailable, so I cannot choose the matching guidance. Retry or load the city again. Rule-based guidance, not medical advice.', 'current reading');
    const rule: Record<string, Record<string, string>> = {
      good: { general: 'Everyone can go about usual outdoor activities.', worker: 'Everyone can go about usual outdoor activities.', asthma: 'Everyone can go about usual outdoor activities.', elderly: 'Everyone can go about usual outdoor activities.' },
      satisfactory: { general: 'General profile: usual outdoor activity is fine.', worker: 'Outdoor Worker profile: usual outdoor activity is fine.', asthma: 'Asthma profile: take care during outdoor activity.', elderly: 'Elderly profile: take care during outdoor activity.' },
      moderate: { general: 'General profile: take care during outdoor activity.', worker: 'Outdoor Worker profile: take care and consider a mask.', asthma: 'Asthma profile: limit outdoor time.', elderly: 'Elderly profile: limit outdoor time.' },
      poor: { general: 'General profile: limit outdoor time.', worker: 'Outdoor Worker profile: limit outdoor time and use a mask.', asthma: 'Asthma profile: stay indoors.', elderly: 'Elderly profile: stay indoors.' },
      'very poor': { general: 'Stay indoors where possible.', worker: 'Stay indoors where possible.', asthma: 'Stay indoors where possible.', elderly: 'Stay indoors where possible.' },
      severe: { general: 'Stay indoors where possible.', worker: 'Stay indoors where possible.', asthma: 'Stay indoors where possible.', elderly: 'Stay indoors where possible.' }
    };
    const guidance = rule[band]?.[profile];
    if (!guidance) return this.unavailable(context, `Guidance for the current band (${context.band}) is unavailable. Retry or load the city again. Rule-based guidance, not medical advice.`, 'current reading');
    const forecastNote = context.currentAqi !== null && context.tomorrow?.value !== null && context.tomorrow?.value !== undefined && context.tomorrow.value > context.currentAqi
      ? ` Tomorrow’s forecast is higher (${context.currentAqi} to ${context.tomorrow.value}).` : '';
    return this.reply(`${guidance}${forecastNote} Rule-based guidance, not medical advice.`, context.dataStatus, this.source(context, context.tomorrow?.value !== null && context.tomorrow?.value !== undefined ? 'current reading, forecast_1d' : 'current reading'), this.followups('safe_outside'));
  }

  private mask(context: AssistantContext): ChatReply {
    const result = this.safeOutside(context);
    return this.reply(`The dashboard’s rule for the current band and profile is: ${result.text}`, result.dataStatus, result.sources, this.followups('mask'));
  }

  private dominantPollutant(context: AssistantContext, whyHigh: boolean): ChatReply {
    const available = Object.entries(context.pollutants || {}).filter(([key, value]) => this.scales[key] && value !== null && value !== undefined && Number.isFinite(value));
    if (!available.length) return this.unavailable(context, 'Pollutant readings are unavailable, so I cannot identify the highest pollutant against the display scale. Retry or load the city again.', 'current reading');
    const [key, value] = available.sort((a, b) => b[1]! / this.scales[b[0]].max - a[1]! / this.scales[a[0]].max)[0];
    const label = this.scales[key].label;
    const text = whyHigh
      ? `${label} is highest against the display scale in the available pollutant readings. This comparison does not establish a cause for the AQI.`
      : `${label} is highest against the display scale (${value} of ${this.scales[key].max}) in the available pollutant readings.`;
    return this.reply(text, context.dataStatus, this.source(context, 'pollutants'), this.followups(whyHigh ? 'why_high' : 'dominant_pollutant'));
  }

  private pollutantExplanation(question: string, context: AssistantContext): ChatReply {
    const definitions: Array<[RegExp, string]> = [
      [/pm2\.?5/, 'PM2.5 means particulate matter with an aerodynamic diameter of 2.5 micrometres or less. It is one of the pollutant measures used in air-quality reporting.'],
      [/pm10/, 'PM10 means particulate matter with an aerodynamic diameter of 10 micrometres or less. It is one of the pollutant measures used in air-quality reporting.'],
      [/no2/, 'NO₂ is nitrogen dioxide, a gas included among common air-pollution measurements.'],
      [/so2/, 'SO₂ is sulfur dioxide, a gas included among common air-pollution measurements.'],
      [/(^|\W)co($|\W)/, 'CO is carbon monoxide, a gas included among common air-pollution measurements.'],
      [/o3/, 'O₃ is ozone; ground-level ozone is included in air-quality monitoring.']
    ];
    const explanation = definitions.find(([pattern]) => pattern.test(question))?.[1]
      || 'PM2.5 and PM10 are particle measures, while NO₂, SO₂, CO and O₃ are gases monitored as air pollutants. Their measured values are separate from the overall AQI.';
    return this.generalKnowledge(explanation, context, 'pollutant_explain');
  }

  private aqiScale(context: AssistantContext): ChatReply {
    return this.generalKnowledge('On the CPCB scale, Moderate is AQI 101–200 and Poor is 201–300. These are category bands for the reported index, not an individual health assessment.', context, 'aqi_scale');
  }

  private compareCities(context: AssistantContext): ChatReply {
    const loaded = (context.otherCities || []).map(snapshot => this.contextForSnapshot(snapshot, context))
      .filter(city => city.currentAqi !== null);
    if (!loaded.some(city => city.city === context.city) && context.currentAqi !== null) loaded.push(context);
    if (loaded.length < 2) return this.unavailable(context, 'Fewer than two cities have loaded AQI values to compare. Load more cities on the Compare page.', 'loaded city data');
    const ordered = loaded.sort((a, b) => (b.currentAqi || 0) - (a.currentAqi || 0));
    return this.reply(`Among the loaded readings, ${ordered[0].city} is highest at AQI ${ordered[0].currentAqi}; ${ordered[ordered.length - 1].city} is lowest at AQI ${ordered[ordered.length - 1].currentAqi}.`, context.dataStatus, ['Loaded city readings', ...ordered.map(item => `${item.city}: ${this.statusSource(item.dataStatus)}`)], this.followups('compare_cities'));
  }

  private profileAdvice(context: AssistantContext): ChatReply {
    if (!context.savedProfile) return this.unavailable(context, 'No saved guidance profile is available. Set one in Edit profile, then retry.', 'saved profile');
    if (!context.tomorrow?.advisory) return this.unavailable(context, 'Profile-specific forecast guidance is unavailable. Retry or load the city again.', 'forecast_1d.advisory');
    return this.reply(`For the saved ${this.backendProfile(context.savedProfile.sensitivity)} profile, the available forecast guidance says: ${context.tomorrow.advisory}`, context.forecastStatus, this.source(context, 'forecast_1d.advisory', context.forecastStatus), this.followups('profile_advice'));
  }

  private dataSource(context: AssistantContext): ChatReply {
    return this.reply(`The current ${context.city} data status is ${this.statusSource(context.dataStatus)}. Forecast status is ${this.statusSource(context.forecastStatus)}.`, context.dataStatus, this.source(context, 'current reading, forecast', context.dataStatus), this.followups('data_source'));
  }

  private generalKnowledge(text: string, context: AssistantContext, intent: IntentName): ChatReply {
    return this.reply(`${text} General knowledge, not live data.`, context.dataStatus, ['General knowledge'], this.followups(intent), 'GENERAL KNOWLEDGE · NOT LIVE DATA');
  }

  private unavailable(context: AssistantContext, text: string, source = 'current reading', status: DataStatus = 'unavailable'): ChatReply {
    return this.reply(text, status, [`${context.city}`, `${source} unavailable`], this.followups('missing_data'));
  }

  private clarify(context: AssistantContext): ChatReply {
    return this.reply('Could you clarify what you want to know about air quality?', context.dataStatus, this.source(context), [
      { label: 'Current AQI', question: 'What is today’s AQI?' },
      { label: 'Tomorrow’s forecast', question: 'What is tomorrow’s forecast?' },
      { label: 'Outdoor guidance', question: 'Is it okay to go out today?' }
    ]);
  }

  private outOfScope(context: AssistantContext): ChatReply {
    return this.reply('I can help with air quality, pollutants, forecasts, exposure reduction, health guidance, and reading this dashboard. Try one of these air-quality questions:', context.dataStatus, ['No dashboard data used'], [
      { label: 'Today’s AQI', question: 'What is today’s AQI?' },
      { label: 'Highest pollutant', question: 'Which pollutant is highest?' },
      { label: 'Tomorrow’s forecast', question: 'What is tomorrow’s forecast?' }
    ]);
  }

  private followups(intent: string): ChatChip[] {
    const suggestions: Record<string, ChatChip[]> = {
      greeting: [{ label: 'Today’s AQI', question: 'What is today’s AQI?' }, { label: 'Tomorrow', question: 'What is tomorrow’s forecast?' }, { label: 'Highest pollutant', question: 'Which pollutant is highest?' }],
      current_aqi: [{ label: 'Tomorrow’s forecast', question: 'What is tomorrow’s forecast?' }, { label: 'Why high?', question: 'Why is the AQI high?' }, { label: 'Data source', question: 'Is this live?' }],
      forecast_tomorrow: [{ label: 'Day after', question: 'What is the day-after forecast?' }, { label: 'Trend', question: 'Is the AQI improving or worsening?' }, { label: 'Outdoor guidance', question: 'Is it okay to go out today?' }],
      forecast_two_day: [{ label: 'Tomorrow', question: 'What is tomorrow’s forecast?' }, { label: 'Trend', question: 'Is the AQI improving or worsening?' }, { label: 'Outdoor guidance', question: 'Is it okay to go out today?' }],
      trend: [{ label: 'Tomorrow’s forecast', question: 'What is tomorrow’s forecast?' }, { label: 'Day after', question: 'What is the day-after forecast?' }, { label: 'Outdoor guidance', question: 'Is it okay to go out today?' }],
      safe_outside: [{ label: 'Mask guidance', question: 'Should I wear a mask?' }, { label: 'Tomorrow’s forecast', question: 'What is tomorrow’s forecast?' }, { label: 'Edit profile', question: 'What profile is selected?' }],
      mask: [{ label: 'Outdoor guidance', question: 'Is it okay to go out today?' }, { label: 'Current AQI', question: 'What is today’s AQI?' }, { label: 'Tomorrow', question: 'What is tomorrow’s forecast?' }],
      dominant_pollutant: [{ label: 'What is PM2.5?', question: 'What is PM2.5?' }, { label: 'Why high?', question: 'Why is the AQI high?' }, { label: 'Current AQI', question: 'What is today’s AQI?' }],
      why_high: [{ label: 'Highest pollutant', question: 'Which pollutant is highest?' }, { label: 'AQI scale', question: 'What does Moderate mean?' }, { label: 'Data source', question: 'Is this live?' }],
      pollutant_explain: [{ label: 'Highest pollutant', question: 'Which pollutant is highest?' }, { label: 'What is PM10?', question: 'What is PM10?' }, { label: 'AQI scale', question: 'What does Moderate mean?' }],
      aqi_scale: [{ label: 'Current AQI', question: 'What is today’s AQI?' }, { label: 'Tomorrow', question: 'What is tomorrow’s forecast?' }, { label: 'Outdoor guidance', question: 'Is it okay to go out today?' }],
      compare_cities: [{ label: 'Compare cities', question: 'Compare loaded cities' }, { label: 'Current AQI', question: 'What is today’s AQI?' }, { label: 'Data source', question: 'Is this live?' }],
      profile_advice: [{ label: 'Outdoor guidance', question: 'Is it okay to go out today?' }, { label: 'Edit profile', question: 'What profile is selected?' }, { label: 'Tomorrow', question: 'What is tomorrow’s forecast?' }],
      how_forecast_works: [{ label: 'Tomorrow’s forecast', question: 'What is tomorrow’s forecast?' }, { label: 'Data source', question: 'Is this live?' }, { label: 'AQI scale', question: 'What does Moderate mean?' }],
      data_source: [{ label: 'Current AQI', question: 'What is today’s AQI?' }, { label: 'Tomorrow', question: 'What is tomorrow’s forecast?' }, { label: 'Compare cities', question: 'Compare loaded cities' }],
      alerts_help: [{ label: 'Threshold', question: 'How do alerts work?' }, { label: 'Current AQI', question: 'What is today’s AQI?' }, { label: 'Data source', question: 'Is this live?' }],
      missing_data: [{ label: 'Retry current AQI', question: 'What is today’s AQI?' }, { label: 'Retry forecast', question: 'What is tomorrow’s forecast?' }, { label: 'Compare cities', question: 'Compare loaded cities' }]
    };
    return suggestions[intent] || suggestions['missing_data'];
  }

  private profileType(value: UserProfile['sensitivity'] | undefined): 'general' | 'asthma' | 'elderly' | 'worker' {
    switch (value) {
      case 'asthma': case 'child': return 'asthma';
      case 'elderly': return 'elderly';
      case 'outdoor worker': return 'worker';
      default: return 'general';
    }
  }

  private backendProfile(value: UserProfile['sensitivity']): string {
    switch (value) {
      case 'asthma': case 'child': return 'Asthma';
      case 'elderly': return 'Elderly';
      case 'outdoor worker': return 'Outdoor Worker';
      default: return 'General Public';
    }
  }

  private source(context: AssistantContext, endpoint?: string, status: DataStatus = context.dataStatus): string[] {
    return [`${context.city}`, this.statusSource(status), ...(endpoint ? [endpoint] : [])];
  }

  private statusSource(status: DataStatus): string {
    switch (status) {
      case 'live': return 'live reading';
      case 'stored': return 'last stored reading';
      case 'backend': return 'backend data';
      case 'demo': return 'DEMO DATA';
      case 'loading': return 'data loading';
      default: return 'data unavailable';
    }
  }

  private statusLabel(status: DataStatus): string {
    switch (status) {
      case 'live': return 'LIVE';
      case 'stored': return 'LAST STORED READING';
      case 'backend': return 'BACKEND DATA';
      case 'demo': return 'DEMO DATA';
      case 'loading': return 'LOADING';
      default: return 'UNAVAILABLE';
    }
  }

  private reply(text: string, dataStatus: DataStatus, sources: string[], chips: ChatChip[], dataStatusLabel = this.statusLabel(dataStatus)): ChatReply {
    return {
      text,
      sources,
      sourceLine: sources[0] === 'General knowledge' ? 'General knowledge' : `Based on: ${sources.join(', ')}`,
      dataStatus,
      dataStatusLabel,
      chips: chips.slice(0, 3)
    };
  }
}
