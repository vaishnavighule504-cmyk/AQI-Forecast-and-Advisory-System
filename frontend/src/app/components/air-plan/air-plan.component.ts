import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, Input, OnChanges, PLATFORM_ID, SimpleChanges, inject } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { DataStatus, ForecastDayVM } from '../../services/aqi-view-models';
import { UserProfile } from '../../services/profile.service';
import { DataStatusBadgeComponent } from '../data-status-badge/data-status-badge.component';

type ActionState = 'done' | 'dismissed';
interface PlanAction { id: string; text: string; state: ActionState | null; }

@Component({
  selector: 'app-air-plan', standalone: true, imports: [CommonModule, DataStatusBadgeComponent],
  template: `
    <section class="air-plan" aria-labelledby="air-plan-title">
      <header class="plan-header">
        <div><p class="eyebrow">PERSONALISED DAILY OUTLOOK</p><h2 id="air-plan-title">Today's Air Plan</h2></div>
        <app-data-status-badge [status]="dataStatus"></app-data-status-badge>
      </header>
      <p class="guidance-label">General air-quality guidance; not professional medical advice.</p>

      <div class="plan-grid">
        <section class="plan-section"><h3>Do now</h3>
          @if (!advisoryLines.length) { <p class="guidance-label">General guidance</p> }
          @else if (!doNow.length) { <p>No separate action listed.</p> }
          @for (action of doNow; track action.id) { <div class="action-row" [class.completed]="action.state">
            <span>{{ action.text }}</span><span class="controls"><button type="button" [attr.aria-pressed]="action.state === 'done'" (click)="setState(action, 'done')">Done</button><button type="button" [attr.aria-pressed]="action.state === 'dismissed'" (click)="setState(action, 'dismissed')">Dismiss</button></span>
            @if (action.state) { <small>{{ action.state === 'done' ? 'Done' : 'Dismissed' }}</small> }
          </div> }
        </section>

        <section class="plan-section"><h3>Avoid or reduce</h3>
          @if (!advisoryLines.length) { <p class="guidance-label">General guidance</p> }
          @else if (!avoid.length) { <p>No separate action listed.</p> }
          @for (action of avoid; track action.id) { <div class="action-row" [class.completed]="action.state">
            <span>{{ action.text }}</span><span class="controls"><button type="button" [attr.aria-pressed]="action.state === 'done'" (click)="setState(action, 'done')">Done</button><button type="button" [attr.aria-pressed]="action.state === 'dismissed'" (click)="setState(action, 'dismissed')">Dismiss</button></span>
            @if (action.state) { <small>{{ action.state === 'done' ? 'Done' : 'Dismissed' }}</small> }
          </div> }
        </section>
      </div>

      <section class="plan-section"><h3>Heads-up</h3><app-data-status-badge [status]="forecastStatus"></app-data-status-badge><p>{{ headsUp }}</p></section>
      @if (typicalTimes.length) { <p class="outdoor-note">You usually go out in {{ typicalTimes.join(', ') }}; check the forecast before leaving.</p> }
      <p class="reason">{{ reason }}</p>

      <details class="why"><summary>Why this recommendation?</summary>
        <ul>
          <li>AQI: {{ currentAqi === null ? 'Unavailable' : currentAqi }} · {{ band || 'band unavailable' }}</li>
          <li>Data status: {{ dataStatus }}</li>
          <li>Selected profile: {{ profile || 'not selected' }}</li>
          <li>Tomorrow's change: {{ tomorrowChange }}</li>
          <li>Day-after forecast: {{ day2?.value ?? 'Unavailable' }}</li>
          <li>Highest pollutant against its scale: {{ highestPollutant }}</li>
          <li>Saved preference: {{ preferenceSummary }}</li>
        </ul>
      </details>
    </section>
  `,
  styles: [`
    :host{display:block}.air-plan{margin:1.25rem 0;padding:clamp(1rem,2.5vw,1.6rem);background:linear-gradient(115deg,#fff 0%,#f6faf9 100%);border:1px solid #d8e5e2;border-inline-start:4px solid #147d75;border-radius:8px;box-shadow:0 5px 16px rgb(18 52 52 / 6%);color:#18323a}.plan-header{display:flex;justify-content:space-between;align-items:flex-start;gap:1rem}.eyebrow{margin:0;color:#0f766e;font-size:.7rem;font-weight:800;letter-spacing:.1em}h2{margin:.2rem 0 .7rem;font-size:clamp(1.35rem,2.5vw,1.65rem);letter-spacing:-.035em}.demo-label{padding:.3rem .6rem;border-radius:999px;background:#fef3c7;color:#92400e;font-size:.72rem;font-weight:850}.plan-grid{display:grid;grid-template-columns:1fr 1fr;gap:clamp(.75rem,2vw,1.25rem)}.plan-section{padding:.8rem 0}h3{margin:.2rem 0 .55rem;font-size:.94rem;letter-spacing:.01em;color:#31535a}.plan-section p,.reason,.outdoor-note{margin:.25rem 0;color:#475b62;line-height:1.55}.guidance-label{font-size:.7rem!important;font-weight:850;color:#8b5a16!important;text-transform:uppercase;letter-spacing:.05em}.action-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:.5rem;align-items:center;padding:.7rem 0;border-bottom:1px solid #e1eae8}.action-row.completed>span:first-child{text-decoration:line-through;color:#64748b}.action-row small{grid-column:1/-1;color:#64748b}.controls{display:flex;gap:.35rem}.controls button{padding:.35rem .55rem;border:1px solid #c7d5d5;border-radius:6px;background:#fff;color:#29444a;font-size:.75rem;cursor:pointer}.controls button[aria-pressed=true]{background:#e7f4ef;border-color:#9fc9b9;color:#16634f}.reason{font-weight:650}.why{margin-top:.75rem;border-top:1px solid #dfe8e6;padding-top:.8rem}.why summary{cursor:pointer;font-weight:750;color:#0f625c}.why li{margin:.35rem 0;color:#475b62}@media(max-width:680px){.plan-grid{grid-template-columns:1fr}.air-plan{padding:1rem}}    :host-context(.dark-theme) .air-plan {
      background: #1e293b !important;
      border-color: #334155 !important;
      border-inline-start-color: #10b981 !important;
      color: #f8fafc !important;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3) !important;
    }
    :host-context(.dark-theme) .eyebrow {
      color: #34d399 !important;
    }
    :host-context(.dark-theme) h2,
    :host-context(.dark-theme) h3 {
      color: #f8fafc !important;
    }
    :host-context(.dark-theme) .plan-section p,
    :host-context(.dark-theme) .reason,
    :host-context(.dark-theme) .outdoor-note {
      color: #cbd5e1 !important;
    }
    :host-context(.dark-theme) .action-row {
      border-bottom-color: #334155 !important;
      color: #e2e8f0 !important;
    }
    :host-context(.dark-theme) .controls button {
      background: #334155 !important;
      border-color: #475569 !important;
      color: #e2e8f0 !important;
    }
    :host-context(.dark-theme) .controls button[aria-pressed=true] {
      background: #064e3b !important;
      border-color: #059669 !important;
      color: #34d399 !important;
    }
    :host-context(.dark-theme) .action-row.completed > span:first-child {
      color: #64748b !important;
    }
    :host-context(.dark-theme) .guidance-label {
      color: #fbbf24 !important;
    }
    :host-context(.dark-theme) .why {
      border-top-color: #334155 !important;
    }
    :host-context(.dark-theme) .why summary { 
      color: #34d399 !important;
    }
    :host-context(.dark-theme) .why li {
      color: #94a3b8 !important;
    }

  `]
})
export class AirPlanComponent implements OnChanges {
  @Input() city = '';
  @Input() currentAqi: number | null = null;
  @Input() band: string | null = null;
  @Input() dataStatus: DataStatus = 'unavailable';
  @Input() forecastStatus: DataStatus = 'unavailable';
  @Input() day1: ForecastDayVM | null = null;
  @Input() day2: ForecastDayVM | null = null;
  @Input() forecastIsDemo = false;
  @Input() pollutants: Record<string, number | null> | null = null;
  @Input() profile = '';
  @Input() savedPreference: UserProfile | null = null;

  private platformId = inject(PLATFORM_ID);
  private authService = inject(AuthService);
  private actionStates: Record<string, ActionState> = {};
  private readonly scales: Record<string, { label: string; max: number }> = {
    pm25: { label: 'PM2.5', max: 250 }, pm10: { label: 'PM10', max: 400 }, no2: { label: 'NO₂', max: 200 },
    so2: { label: 'SO₂', max: 100 }, co: { label: 'CO', max: 10 }, o3: { label: 'O₃', max: 150 }
  };
  private dateKey = this.localDate();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['city']) this.loadActionStates();
  }

  get advisoryLines(): string[] {
    if (this.forecastIsDemo) return [];
    const text = this.day1?.advisory?.trim();
    return text ? text.split(/\r?\n/).map(line => line.replace(/^[-*•\s]+/, '').trim()).filter(Boolean) : [];
  }
  private isAvoid(line: string): boolean { return /\b(avoid|limit|reduce|cut back|stay (?:indoors|inside)|do not|don't|refrain)\b/i.test(line); }
  private actionsFor(avoid: boolean): PlanAction[] {
    if (!this.advisoryLines.length) {
      const text = avoid ? 'Consider reducing prolonged outdoor activity when AQI is elevated.' : 'Check the latest AQI before planning extended outdoor activity.';
      const id = `general:${avoid ? 'avoid' : 'do'}:${text.toLowerCase()}`;
      return [{ id: `${id}:0`, text, state: this.actionStates[id] || null }];
    }
    return this.advisoryLines.filter(line => this.isAvoid(line) === avoid).map((text, index) => {
      const id = `${avoid ? 'avoid' : 'do'}:${text.toLowerCase()}`;
      return { id: `${id}:${index}`, text, state: this.actionStates[id] || null };
    });
  }
  get doNow(): PlanAction[] { return this.actionsFor(false); }
  get avoid(): PlanAction[] { return this.actionsFor(true); }

  setState(action: PlanAction, state: ActionState): void {
    const stateKey = action.id.replace(/:\d+$/, '');
    if (this.actionStates[stateKey] === state) delete this.actionStates[stateKey];
    else this.actionStates[stateKey] = state;
    this.saveActionStates();
  }

  get headsUp(): string {
    if (this.currentAqi === null || this.day1?.value === null || this.day1?.value === undefined) return 'Forecast unavailable';
    if (this.day1.value > this.currentAqi) return `Forecast to rise from ${this.currentAqi} to ${this.day1.value}; plan outdoor activity earlier.`;
    if (this.day1.value < this.currentAqi) return `Forecast to fall from ${this.currentAqi} to ${this.day1.value}.`;
    return `Forecast to remain at ${this.currentAqi}.`;
  }
  get tomorrowChange(): string {
    return this.currentAqi === null || this.day1?.value === null || this.day1?.value === undefined
      ? 'Forecast unavailable' : `${this.currentAqi} to ${this.day1.value} (${this.day1.value - this.currentAqi >= 0 ? '+' : ''}${this.day1.value - this.currentAqi})`;
  }
  get reason(): string {
    const category = this.band || 'unavailable';
    const source = this.dataStatus === 'live' ? 'live data'
      : this.dataStatus === 'stored' ? 'a last stored reading'
        : this.dataStatus === 'backend' ? 'backend-returned data'
          : this.dataStatus === 'demo' ? 'demo data'
            : this.dataStatus === 'loading' ? 'data currently loading' : 'unavailable data';
    return this.currentAqi === null
      ? `${this.city || 'This city'}'s AQI and band are unavailable, from ${source}.`
      : `${this.city || 'This city'}'s AQI is ${category} (CPCB scale), from ${source}.`;
  }
  get highestPollutant(): string {
    const values = Object.entries(this.pollutants || {}).filter(([key, value]) => this.scales[key] && value !== null && value !== undefined && Number.isFinite(value));
    if (!values.length) return 'No pollutant reading available';
    const [key, value] = values.sort((a, b) => (b[1]! / this.scales[b[0]].max) - (a[1]! / this.scales[a[0]].max))[0];
    return `${this.scales[key].label}: ${value} / ${this.scales[key].max} scale`;
  }
  get typicalTimes(): string[] { return this.savedPreference?.outdoorTimes || []; }
  get preferenceSummary(): string {
    if (!this.savedPreference) return 'No saved profile preference';
    const sensitivity = this.savedPreference.sensitivity === 'child' ? 'Sensitive-group guidance' : this.savedPreference.sensitivity;
    return `${this.savedPreference.city}, ${sensitivity}, ${this.savedPreference.purpose}, AQI ${this.savedPreference.alertThreshold} alert`;
  }

  private localDate(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  private storageKey(): string {
    const user = this.authService.currentUser()?.trim() || 'guest';
    return `saanscast_air_plan_${encodeURIComponent(user)}_${encodeURIComponent(this.city || 'unknown')}_${this.dateKey}`;
  }
  private loadActionStates(): void {
    this.dateKey = this.localDate();
    this.actionStates = {};
    if (!isPlatformBrowser(this.platformId)) return;
    try { this.actionStates = JSON.parse(localStorage.getItem(this.storageKey()) || '{}') || {}; }
    catch { this.actionStates = {}; }
  }
  private saveActionStates(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try { localStorage.setItem(this.storageKey(), JSON.stringify(this.actionStates)); }
    catch { /* Device storage may be unavailable. */ }
  }
}
