import { describe, expect, it } from 'vitest';
import { AssistantContext, RuleBasedChatProvider } from './chat-provider';

const provider = new RuleBasedChatProvider();

const context = (overrides: Partial<AssistantContext> = {}): AssistantContext => ({
  city: 'Delhi',
  currentAqi: 180,
  band: 'Moderate',
  dataStatus: 'stored',
  forecastStatus: 'backend',
  pollutants: null,
  tomorrow: { value: 190, date: '2026-10-16', advisory: null },
  dayAfter: { value: null, date: null },
  savedProfile: {
    city: 'Delhi', purpose: 'general awareness', sensitivity: 'general', outdoorTimes: [], alertThreshold: 150
  },
  otherCities: [],
  ...overrides
});

describe('RuleBasedChatProvider', () => {
  it('redirects unrelated questions to air-quality topics', () => {
    const reply = provider.answer('Who won the football match?', context());
    expect(reply.text).toContain('I can help with air quality');
    expect(reply.chips).toHaveLength(3);
    expect(reply.sourceLine).toBe('Based on: No dashboard data used');
  });

  it('states that missing pollutant readings are unavailable', () => {
    const reply = provider.answer('Which pollutant is highest?', context({ pollutants: null }));
    expect(reply.text).toContain('Pollutant readings are unavailable');
    expect(reply.text).not.toContain('0');
  });

  it('offers a switch chip when a named city is not loaded', () => {
    const reply = provider.answer('What is the AQI in Mumbai?', context());
    expect(reply.text).toBe("I don't have Mumbai loaded yet. Switch to that city on the dashboard to load its data.");
    expect(reply.chips[0]).toMatchObject({ label: 'Switch to Mumbai', city: 'Mumbai' });
  });

  it('uses the Moderate guidance for the general profile', () => {
    const reply = provider.answer('Is it safe to go outside?', context());
    expect(reply.text).toContain('General profile: take care');
    expect(reply.text.endsWith('Rule-based guidance, not medical advice.')).toBe(true);
  });

  it('uses the Moderate guidance for the asthma profile', () => {
    const reply = provider.answer('Can I go out for a walk?', context({
      savedProfile: {
        city: 'Delhi', purpose: 'personal health', sensitivity: 'asthma', outdoorTimes: [], alertThreshold: 150
      }
    }));
    expect(reply.text).toContain('Asthma profile: limit outdoor time.');
    expect(reply.text.endsWith('Rule-based guidance, not medical advice.')).toBe(true);
  });

  it('does not treat “what should I do today” as a current AQI request', () => {
    const reply = provider.answer('What should I do today?', context());
    expect(reply.text).toContain('Could you clarify');
    expect(reply.text).not.toContain('AQI 180');
  });
});
