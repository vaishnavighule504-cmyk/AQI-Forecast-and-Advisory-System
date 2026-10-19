import { computed, Injectable, inject, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AuthService } from './auth.service';
import { DataStatus } from './aqi-view-models';

export type AlertSeverity = 'Good' | 'Satisfactory' | 'Moderate' | 'Poor' | 'Very Poor' | 'Severe';
export interface AlertPreferences { city: string; threshold: 100 | 150 | 200 | 300; forecastEnabled: boolean; }
export interface UserAlert {
  id: string;
  severity: AlertSeverity;
  city: string;
  reason: string;
  timestamp: string;
  sourceStatus: DataStatus;
  kind: 'threshold' | 'forecast' | 'demo';
  isRead: boolean;
  isDismissed: boolean;
}

@Injectable({ providedIn: 'root' })
export class AlertsService {
  private platformId = inject(PLATFORM_ID);
  private authService = inject(AuthService);
  private loadedUser = '';
  private readonly cities = ['Delhi', 'Mumbai', 'Bengaluru', 'Chennai', 'Hyderabad', 'Ahmedabad', 'Kolkata'];

  alerts = signal<UserAlert[]>([]);
  preferences = signal<AlertPreferences>({ city: 'Delhi', threshold: 150, forecastEnabled: true });
  unreadCount = computed(() => this.alerts().filter(alert => !alert.isRead && !alert.isDismissed).length);

  loadPreferences(defaults: AlertPreferences): AlertPreferences {
    this.ensureUser(defaults);
    return this.preferences();
  }

  savePreferences(preferences: AlertPreferences): void {
    const valid = { ...preferences, threshold: this.normalizeThreshold(preferences.threshold) };
    this.preferences.set(valid);
    this.write(this.preferencesKey(), valid);
  }

  evaluate(city: string, threshold: AlertPreferences['threshold'], currentAqi: number | null, status: DataStatus,
    tomorrow: number | null, dayAfter: number | null, forecastStatus: DataStatus, forecastEnabled: boolean): UserAlert[] {
    this.ensureUser();
    if ((status !== 'live' && status !== 'stored') || currentAqi === null || !Number.isFinite(currentAqi)) return [];
    const newAlerts: UserAlert[] = [];
    const today = this.localDate();
    if (currentAqi >= threshold) {
      const id = `${city}|${today}|threshold|${threshold}`;
      this.addIfNew(newAlerts, { id, severity: this.band(currentAqi), city,
        reason: `Current AQI ${currentAqi} is at or above your threshold of ${threshold}.`, timestamp: new Date().toISOString(), sourceStatus: status, kind: 'threshold', isRead: false, isDismissed: false });
    }
    if (forecastEnabled && forecastStatus === 'backend') {
      this.addForecastIfCrossed(newAlerts, city, today, threshold, currentAqi, tomorrow, forecastStatus, 'tomorrow');
      const baseline = tomorrow ?? currentAqi;
      this.addForecastIfCrossed(newAlerts, city, today, threshold, baseline, dayAfter, forecastStatus, 'day-after');
    }
    if (newAlerts.length) {
      this.alerts.update(existing => [...newAlerts, ...existing]);
      this.persistAlerts();
    }
    return newAlerts;
  }

  createDemoAlert(city: string, threshold: AlertPreferences['threshold']): UserAlert {
    this.ensureUser();
    const today = this.localDate();
    const id = `${city}|${today}|demo|${threshold}|${Date.now()}`;
    const alert: UserAlert = { id, severity: this.band(threshold), city,
      reason: `Demo alert preview at AQI ${threshold}; this is not a live or stored reading.`, timestamp: new Date().toISOString(),
      sourceStatus: 'demo', kind: 'demo', isRead: false, isDismissed: false };
    this.alerts.update(existing => [alert, ...existing]);
    this.persistAlerts();
    return alert;
  }

  markRead(id: string): void { this.updateAlert(id, alert => ({ ...alert, isRead: true })); }
  dismiss(id: string): void { this.updateAlert(id, alert => ({ ...alert, isDismissed: true })); }

  visibleAlerts(city: string): UserAlert[] { this.ensureUser(); return this.alerts().filter(alert => alert.city === city && !alert.isDismissed); }

  private addForecastIfCrossed(output: UserAlert[], city: string, date: string, threshold: number, from: number, to: number | null, status: DataStatus, period: string): void {
    if (to === null || !Number.isFinite(to)) return;
    const crossed = (from < threshold && to >= threshold) || (from >= threshold && to < threshold);
    if (!crossed) return;
    const id = `${city}|${date}|forecast|${period}|${threshold}`;
    this.addIfNew(output, { id, severity: this.band(to), city,
      reason: `Forecast AQI ${to} for ${period} crosses your threshold of ${threshold} from ${from}.`, timestamp: new Date().toISOString(), sourceStatus: status, kind: 'forecast', isRead: false, isDismissed: false });
  }

  private addIfNew(output: UserAlert[], alert: UserAlert): void {
    if (this.alerts().some(existing => existing.id === alert.id) || output.some(existing => existing.id === alert.id)) return;
    output.push(alert);
  }

  private updateAlert(id: string, update: (alert: UserAlert) => UserAlert): void {
    this.ensureUser();
    this.alerts.update(items => items.map(alert => alert.id === id ? update(alert) : alert));
    this.persistAlerts();
  }

  private band(aqi: number): AlertSeverity {
    if (aqi <= 50) return 'Good'; if (aqi <= 100) return 'Satisfactory'; if (aqi <= 200) return 'Moderate';
    if (aqi <= 300) return 'Poor'; if (aqi <= 400) return 'Very Poor'; return 'Severe';
  }
  private normalizeThreshold(value: number): AlertPreferences['threshold'] { return ([100, 150, 200, 300].includes(value) ? value : 150) as AlertPreferences['threshold']; }
  private userId(): string { return this.authService.currentUser()?.trim() || 'guest'; }
  private alertsKey(): string { return `saanscast_alerts_${encodeURIComponent(this.userId())}`; }
  private preferencesKey(): string { return `saanscast_alert_preferences_${encodeURIComponent(this.userId())}`; }

  private ensureUser(defaults: AlertPreferences = { city: 'Delhi', threshold: 150, forecastEnabled: true }): void {
    const user = this.userId();
    if (user === this.loadedUser) return;
    this.loadedUser = user;
    const savedAlerts = this.read<UserAlert[]>(this.alertsKey(), []);
    this.alerts.set(Array.isArray(savedAlerts) ? savedAlerts : []);
    const savedPrefs = this.read<Partial<AlertPreferences>>(this.preferencesKey(), {});
    const city = savedPrefs.city && this.cities.includes(savedPrefs.city) ? savedPrefs.city : defaults.city;
    this.preferences.set({ city, threshold: this.normalizeThreshold(savedPrefs.threshold ?? defaults.threshold), forecastEnabled: savedPrefs.forecastEnabled ?? defaults.forecastEnabled });
    if (!Object.keys(savedPrefs).length) this.write(this.preferencesKey(), this.preferences());
  }

  private read<T>(key: string, fallback: T): T {
    if (!isPlatformBrowser(this.platformId)) return fallback;
    try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback; }
    catch { return fallback; }
  }
  private write(key: string, value: unknown): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Device storage may be unavailable. */ }
  }
  private persistAlerts(): void { this.write(this.alertsKey(), this.alerts()); }
  private localDate(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
}
