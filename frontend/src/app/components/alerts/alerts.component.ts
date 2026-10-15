import { Component, OnDestroy, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of, Subscription } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AqiService, ForecastResponse, LiveAqiResponse } from '../../services/aqi.service';
import { toForecastVM, toLiveVM } from '../../services/aqi-view-models';
import { AlertsService, AlertPreferences, UserAlert } from '../../services/alerts.service';
import { ProfileService } from '../../services/profile.service';
import { DataStatusBadgeComponent } from '../data-status-badge/data-status-badge.component';

@Component({
  selector: 'app-alerts', standalone: true,
  imports: [CommonModule, FormsModule, DataStatusBadgeComponent],
  template: `
    <div class="alerts-page">
      <header class="page-header"><div><p class="eyebrow">PERSONALISED AQI NOTICES</p><h1>Air Quality Alerts</h1>
        <p>Threshold notices based on readings and forecasts loaded from the AQI service.</p></div>
        <span class="unread-count">{{ alertsService.unreadCount() }} unread</span>
      </header>

      <section class="settings-card" aria-label="Alert preferences">
        <label>City
          <select [ngModel]="city()" (ngModelChange)="onCityChange($event)">
            @for (item of cities; track item) { <option [value]="item">{{ item }}</option> }
          </select>
        </label>
        <label>Alert threshold
          <select [ngModel]="threshold()" (ngModelChange)="onThresholdChange($event)">
            @for (value of thresholds; track value) { <option [ngValue]="value">AQI {{ value }}</option> }
          </select>
        </label>
        <label class="toggle"><input type="checkbox" [ngModel]="forecastEnabled()" (ngModelChange)="onForecastToggle($event)"> Include forecast alerts</label>
        <button type="button" class="secondary" (click)="createDemoAlert()">Create demo alert</button>
        <button type="button" (click)="enableNotifications()">Enable browser notifications</button>
      </section>
      <p class="note">Alerts work only while this app is open. Background push is not enabled.</p>
      @if (notificationMessage()) { <p class="inline-message" role="status">{{ notificationMessage() }}</p> }

      @if (isLoading()) { <section class="state-card alert-loading" role="status" aria-label="Loading AQI alerts">
        <span class="alert-skeleton skeleton-heading"></span><span class="alert-skeleton"></span><span class="alert-skeleton"></span>
      </section> }
      @if (errorMessage()) { <div class="error-card" role="alert"><span>{{ errorMessage() }}</span><button type="button" class="secondary" (click)="loadData()">Retry</button></div> }
      @if (!isLoading() && !errorMessage() && liveStatus() && !forecastAvailable()) { <p class="note">Forecast data is unavailable. Current-reading threshold alerts can still be evaluated.</p> }

      <section class="alert-list" aria-label="Alert list">
        @for (alert of visibleAlerts(); track alert.id) {
          <article class="alert-card" [class.unread]="!alert.isRead">
            <div class="alert-top"><div><span class="severity" [attr.data-severity]="alert.severity">{{ alert.severity }}</span>
              <span class="alert-city">{{ alert.city }}</span></div>
              @if (alert.kind === 'demo') { <span class="demo-badge">DEMO DATA</span> }
              @else { <app-data-status-badge [status]="alert.sourceStatus"></app-data-status-badge> }
            </div>
            <p>{{ alert.reason }}</p>
            <small>{{ alert.timestamp | date:'medium' }} · {{ alert.kind === 'forecast' ? 'Forecast alert' : alert.kind === 'demo' ? 'Demo alert' : 'Threshold alert' }}</small>
            <div class="alert-actions">
              @if (!alert.isRead) { <button type="button" class="secondary" (click)="markRead(alert)">Mark read</button> }
              @else { <span class="read-label">Read</span> }
              <button type="button" class="dismiss" (click)="dismiss(alert)">Dismiss</button>
            </div>
          </article>
        } @empty {
          @if (!isLoading()) { <div class="empty-state"><span>🔔</span><h2>No alerts for {{ city() }}</h2><p>When loaded AQI data meets your threshold, alerts will appear here. You can also create a clearly labelled demo alert.</p></div> }
        }
      </section>
    </div>
  `,
  styles: [`
    .alerts-page{max-width:1100px;margin:0 auto;padding:2rem 1.5rem;color:#1e293b;font-family:'Outfit','Inter',system-ui,sans-serif}.page-header{display:flex;justify-content:space-between;align-items:center;gap:1rem;margin-bottom:1.5rem}.eyebrow{margin:0;color:#047857;font-size:.72rem;font-weight:800;letter-spacing:.09em}h1{margin:.25rem 0;font-size:2rem}.page-header p:not(.eyebrow){color:#64748b}.unread-count{white-space:nowrap;padding:.45rem .7rem;border-radius:999px;background:#fee2e2;color:#991b1b;font-weight:750}.settings-card{display:flex;align-items:end;flex-wrap:wrap;gap:1rem;padding:1rem;background:#fff;border:1px solid #e2e8f0;border-radius:14px}.settings-card label{display:grid;gap:.35rem;color:#334155;font-size:.85rem;font-weight:700}.settings-card select{min-width:145px;padding:.65rem;border:1px solid #cbd5e1;border-radius:8px;background:#fff}.settings-card .toggle{display:flex;align-items:center;gap:.5rem;min-height:40px}.settings-card button,.alert-actions button,.error-card button{border:0;border-radius:8px;padding:.65rem .85rem;background:#047857;color:#fff;font-weight:700;cursor:pointer}.settings-card button.secondary,.alert-actions button.secondary,.error-card button.secondary{background:#e2e8f0;color:#334155}.note{font-size:.84rem;color:#64748b;margin:.7rem 0 1.2rem}.inline-message{color:#166534}.state-card,.error-card,.empty-state{padding:1.2rem;background:#fff;border:1px solid #e2e8f0;border-radius:14px}.error-card{display:flex;justify-content:space-between;align-items:center;gap:1rem;border-color:#fecaca;background:#fef2f2;color:#991b1b}.alert-list{display:grid;gap:.85rem;margin-top:1rem}.alert-card{padding:1rem 1.1rem;background:#fff;border:1px solid #e2e8f0;border-left:4px solid #94a3b8;border-radius:12px}.alert-card.unread{border-left-color:#dc2626}.alert-top{display:flex;align-items:center;justify-content:space-between;gap:.75rem}.alert-top>div{display:flex;align-items:center;gap:.6rem}.severity{padding:.25rem .55rem;border-radius:999px;background:#e2e8f0;color:#334155;font-size:.75rem;font-weight:800}.severity[data-severity="Moderate"]{background:#fef3c7;color:#92400e}.severity[data-severity="Poor"],.severity[data-severity="Very Poor"],.severity[data-severity="Severe"]{background:#fee2e2;color:#991b1b}.alert-city{font-weight:800}.demo-badge{padding:.25rem .55rem;border-radius:999px;background:#fef3c7;color:#92400e;font-size:.72rem;font-weight:850}.alert-card p{margin:.75rem 0;color:#334155}.alert-card small,.read-label{color:#64748b}.alert-actions{display:flex;justify-content:flex-end;align-items:center;gap:.5rem;margin-top:.8rem}.alert-actions button{padding:.45rem .7rem}.alert-actions button.dismiss{background:#fff;color:#991b1b;border:1px solid #fecaca}.empty-state{text-align:center;padding:3rem 1rem;color:#64748b}.empty-state>span{font-size:2rem}.empty-state h2{color:#0f172a}.shell-wrapper.dark-theme .settings-card,.shell-wrapper.dark-theme .alert-card,.shell-wrapper.dark-theme .state-card,.shell-wrapper.dark-theme .empty-state{background:#1e293b;border-color:#475569;color:#f8fafc}.shell-wrapper.dark-theme .alert-card p,.shell-wrapper.dark-theme .empty-state h2{color:#f8fafc}@media(max-width:650px){.page-header{align-items:flex-start;flex-direction:column}.settings-card{align-items:stretch;flex-direction:column}.settings-card select{width:100%}}
  `, `
    .alert-loading { display:grid; gap:.65rem; }
    .alert-skeleton { display:block; width:min(100%, 34rem); height:1rem; border-radius:var(--ui-radius); background:linear-gradient(90deg,#e9eef0 25%,#f4f6f7 50%,#e9eef0 75%); background-size:200% 100%; animation:alert-shimmer 1.4s ease-in-out infinite; }
    .alert-skeleton.skeleton-heading { width:min(100%, 18rem); height:1.4rem; }
    @keyframes alert-shimmer { to { background-position:-200% 0; } }
    @media(prefers-reduced-motion:reduce) { .alert-skeleton { animation:none; background:#e9eef0; } }
  `]
})
export class AlertsComponent implements OnInit, OnDestroy {
  private aqiService = inject(AqiService);
  private profileService = inject(ProfileService);
  private platformId = inject(PLATFORM_ID);
  private dataSubscription?: Subscription;
  private latest: { currentAqi: number | null; status: 'live' | 'stored' | null; tomorrow: number | null; dayAfter: number | null; forecastStatus: 'backend' | null } = { currentAqi: null, status: null, tomorrow: null, dayAfter: null, forecastStatus: null };
  private notificationsEnabled = false;

  readonly alertsService = inject(AlertsService);
  cities = ['Delhi', 'Mumbai', 'Bengaluru', 'Chennai', 'Hyderabad', 'Ahmedabad', 'Kolkata'];
  thresholds: Array<100 | 150 | 200 | 300> = [100, 150, 200, 300];
  city = signal('Delhi');
  threshold = signal<100 | 150 | 200 | 300>(150);
  forecastEnabled = signal(true);
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  notificationMessage = signal<string | null>(null);
  forecastAvailable = signal(false);
  liveStatus = signal<'live' | 'stored' | null>(null);

  ngOnInit(): void {
    const profile = this.profileService.load();
    const preferences = this.alertsService.loadPreferences({ city: profile?.city || 'Delhi', threshold: profile?.alertThreshold || 150, forecastEnabled: true });
    this.city.set(preferences.city);
    this.threshold.set(preferences.threshold);
    this.forecastEnabled.set(preferences.forecastEnabled);
    this.loadData();
  }

  ngOnDestroy(): void { this.dataSubscription?.unsubscribe(); }
  visibleAlerts(): UserAlert[] { return this.alertsService.visibleAlerts(this.city()); }

  onCityChange(city: string): void { this.city.set(city); this.savePreferences(); this.loadData(); }
  onThresholdChange(value: number): void { this.threshold.set(value as 100 | 150 | 200 | 300); this.savePreferences(); this.evaluateLoadedData(); }
  onForecastToggle(enabled: boolean): void { this.forecastEnabled.set(enabled); this.savePreferences(); this.evaluateLoadedData(); }

  private savePreferences(): void {
    const preferences: AlertPreferences = { city: this.city(), threshold: this.threshold(), forecastEnabled: this.forecastEnabled() };
    this.alertsService.savePreferences(preferences);
  }

  loadData(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.dataSubscription?.unsubscribe();
    this.isLoading.set(true); this.errorMessage.set(null); this.forecastAvailable.set(false); this.liveStatus.set(null);
    const city = this.city();
    const profile = this.profileService.load();
    const apiProfile = this.profileService.backendProfile(profile?.sensitivity || 'general');
    this.dataSubscription = forkJoin({
      live: this.aqiService.getLiveAqi(city).pipe(catchError(() => of(null))),
      forecast: this.aqiService.getForecast(city, apiProfile).pipe(catchError(() => of(null)))
    }).subscribe(({ live, forecast }) => {
      this.isLoading.set(false);
      const liveVM = live ? toLiveVM(live as LiveAqiResponse) : null;
      const forecastVM = forecast ? toForecastVM(forecast as ForecastResponse) : null;
      const usableStatus = liveVM?.dataStatus === 'live' || liveVM?.dataStatus === 'stored' ? liveVM.dataStatus : null;
      this.latest = {
        currentAqi: usableStatus ? liveVM?.aqi ?? null : null,
        status: usableStatus,
        tomorrow: forecastVM?.day1?.value ?? null,
        dayAfter: forecastVM?.day2?.value ?? null,
        forecastStatus: forecastVM?.dataStatus === 'backend' && (forecastVM.day1?.value !== null && forecastVM.day1?.value !== undefined || forecastVM.day2?.value !== null && forecastVM.day2?.value !== undefined)
          ? 'backend' : null
      };
      this.liveStatus.set(this.latest.status);
      this.forecastAvailable.set(this.latest.tomorrow !== null || this.latest.dayAfter !== null);
      if (!live && !forecast) this.errorMessage.set('Current and forecast data are unavailable. Retry to load them again.');
      else if (!live && forecast) this.errorMessage.set('The current AQI reading is unavailable, so threshold crossings cannot be evaluated.');
      this.evaluateLoadedData();
    });
  }

  private evaluateLoadedData(): void {
    if (!this.latest.status) return;
    const added = this.alertsService.evaluate(this.city(), this.threshold(), this.latest.currentAqi, this.latest.status,
      this.latest.tomorrow, this.latest.dayAfter, this.latest.forecastStatus || 'unavailable', this.forecastEnabled());
    if (this.notificationsEnabled && added.length) this.notify(added);
  }

  createDemoAlert(): void { this.alertsService.createDemoAlert(this.city(), this.threshold()); }
  markRead(alert: UserAlert): void { this.alertsService.markRead(alert.id); }
  dismiss(alert: UserAlert): void { this.alertsService.dismiss(alert.id); }

  async enableNotifications(): Promise<void> {
    if (!isPlatformBrowser(this.platformId) || !('Notification' in window)) {
      this.notificationMessage.set('Browser notifications are not available here.'); return;
    }
    try {
      const permission = await Notification.requestPermission();
      this.notificationsEnabled = permission === 'granted';
      this.notificationMessage.set(permission === 'granted' ? 'Browser notifications enabled for new alerts while this app is open.' : 'Notification permission was not granted.');
    } catch { this.notificationMessage.set('Could not request browser notification permission.'); }
  }

  private notify(alerts: UserAlert[]): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      if (Notification.permission !== 'granted') return;
      for (const alert of alerts) new Notification(`${alert.city} AQI alert · ${alert.severity}`, { body: alert.reason });
    } catch { /* Notifications may be disabled by browser or system settings. */ }
  }
}
