import { Injectable } from '@angular/core';
import { DataStatus } from './aqi-view-models';
import { UserProfile } from './profile.service';

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
}

export interface ChatReply { text: string; sources: string[]; dataStatus: DataStatus; }

export interface ChatProvider {
  answer(question: string, context: AssistantContext): ChatReply;
}

// A future HTTP-backed ChatProvider can be substituted here; this implementation makes no network or LLM calls.
@Injectable({ providedIn: 'root' })
export class RuleBasedChatProvider implements ChatProvider {
  private readonly scales: Record<string, { label: string; max: number }> = {
    pm25: { label: 'PM2.5', max: 250 }, pm10: { label: 'PM10', max: 400 }, no2: { label: 'NO₂', max: 200 },
    so2: { label: 'SO₂', max: 100 }, co: { label: 'CO', max: 10 }, o3: { label: 'O₃', max: 150 }
  };

  answer(question: string, context: AssistantContext): ChatReply {
    const q = question.toLowerCase();
    const sources = this.sources(context);
    const reply = (text: string, used: string[] = sources, status: DataStatus = context.dataStatus): ChatReply => ({ text, sources: used, dataStatus: status });
    const inScope = /\b(air quality|aqi|pollut|forecast|tomorrow|day after|exposure|outdoor|precaution|health|guidance|advisory|dashboard|reading|category|band|improve|worsen|current|should i|what should|reduce exposure)\b/i.test(q);
    if (!inScope) return reply('I can help with air quality, pollutants, forecasts, exposure reduction, health guidance, and reading this dashboard. Try “What is today’s AQI?” or “Which pollutant is highest?”', ['No dashboard data used']);

    if (/pollut|dominant|highest pollutant/i.test(q)) {
      const available = Object.entries(context.pollutants || {}).filter(([key, value]) => this.scales[key] && value !== null && value !== undefined && Number.isFinite(value));
      if (!available.length) return reply(`Pollutant readings are unavailable for ${context.city}.`, [`${context.city}`, this.statusSource(context.dataStatus)]);
      const [key, value] = available.sort((a, b) => (b[1]! / this.scales[b[0]].max) - (a[1]! / this.scales[a[0]].max))[0];
      if (/which pollutants|pollutants available|list pollutants/i.test(q)) {
        return reply(`Available readings: ${available.map(([name, reading]) => `${this.scales[name].label} ${reading}`).join(', ')}.`);
      }
      return reply(`The highest pollutant relative to the displayed scales is ${this.scales[key].label} at ${value} (scale ${this.scales[key].max}).`);
    }

    if (/forecast|tomorrow|day after|improve|worsen|48.?hour/i.test(q)) {
      if (/day after|48.?hour/i.test(q)) {
        if (context.dayAfter?.value === null || context.dayAfter?.value === undefined) return reply('The day-after forecast is unavailable.', [`${context.city}`, 'forecast_2d unavailable'], context.forecastStatus);
        return reply(`The day-after forecast for ${context.city} is ${context.dayAfter.value}${context.dayAfter.date ? ` for ${context.dayAfter.date}` : ''}.`, [`${context.city}`, this.statusSource(context.forecastStatus), 'forecast_2d'], context.forecastStatus);
      }
      if (context.tomorrow?.value === null || context.tomorrow?.value === undefined) return reply('Tomorrow’s forecast is unavailable.', [`${context.city}`, 'forecast_1d unavailable'], context.forecastStatus);
      const forecast = context.tomorrow.value;
      if (context.currentAqi === null) return reply(`Tomorrow’s forecast for ${context.city} is ${forecast}; the current AQI reading is unavailable for comparison.`, [`${context.city}`, this.statusSource(context.forecastStatus), 'forecast_1d', 'current reading unavailable'], context.forecastStatus);
      const delta = forecast - context.currentAqi;
      const comparison = delta > 0 ? `higher by ${delta}` : delta < 0 ? `lower by ${Math.abs(delta)}` : 'unchanged';
      return reply(`Tomorrow’s forecast for ${context.city} is ${forecast}, ${comparison} than the current AQI of ${context.currentAqi}.`, [`${context.city}`, this.statusSource(context.forecastStatus), 'forecast_1d', `current: ${this.statusSource(context.dataStatus)}`], context.forecastStatus);
    }

    if (/advis|health|guidance|exposure|precaution|should i|what should|reduce exposure/i.test(q)) {
      if (context.dataStatus === 'demo') return reply('Profile-specific guidance is unavailable from live or stored dashboard data.');
      const advisory = context.tomorrow?.advisory?.trim();
      return advisory
        ? reply(`The dashboard’s selected-profile guidance says: ${advisory}`, [`${context.city}`, 'forecast_1d.advisory', `profile: ${context.savedProfile?.sensitivity || 'not saved'}`], context.forecastStatus)
        : reply('Profile-specific guidance is unavailable in the current dashboard data.', [`${context.city}`, 'forecast_1d.advisory unavailable'], context.forecastStatus);
    }

    if (/dashboard|read this|how.*reading|what.*band|meaning/i.test(q)) {
      return reply('The dashboard shows the current AQI and band, a data-status label (live, stored, or demo), and separate forecast values. A forecast is not a current reading.');
    }

    if (context.currentAqi === null) return reply(`The current AQI reading is unavailable for ${context.city}.`);
    return reply(`${context.city} is showing AQI ${context.currentAqi}${context.band ? ` (${context.band})` : ''}. The reading status is ${context.dataStatus}.`);
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

  private sources(context: AssistantContext): string[] {
    const sources = [context.city || 'selected city'];
    if (context.currentAqi !== null) sources.push(this.statusSource(context.dataStatus));
    return sources;
  }
}
