import { Component, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { catchError, firstValueFrom, of } from 'rxjs';
import { AqiService } from '../../services/aqi.service';
import { toForecastVM, toLiveVM } from '../../services/aqi-view-models';
import { CityDataResult, CityDataService, PilotCity } from '../../services/city-data.service';
import { DataStatusBadgeComponent } from '../data-status-badge/data-status-badge.component';

@Component({
  selector: 'app-compare',
  standalone: true,
  imports: [CommonModule, DataStatusBadgeComponent],
  template: `
    <main class="compare-page" aria-labelledby="compare-title">
      <header class="page-header">
        <div><p class="eyebrow">PILOT CITY OVERVIEW</p><h1 id="compare-title">Compare city air quality</h1>
          <p>Load current readings and available forecasts for the seven pilot cities. Only returned values are shown.</p></div>
        <button type="button" class="load-button" [disabled]="isLoadingAll()" (click)="loadAllCities()">
          {{ isLoadingAll() ? 'Loading cities…' : 'Load all 7 cities' }}
        </button>
      </header>

      @if (hasStarted()) {
        <div class="progress-line" role="status" aria-live="polite">
          <span>{{ loadedCount() }} of 7 loaded</span>
          @if (isLoadingAll()) { <span class="progress-hint">Requests run one city at a time.</span> }
        </div>
        @if (summary(); as summaryText) { <p class="summary-line">{{ summaryText }}</p> }

        <div class="table-scroll" role="region" aria-label="Pilot city AQI comparison table" tabindex="0">
          <table>
            <caption>Current AQI and next-day forecast for each pilot city. Select a row to open its dashboard.</caption>
            <thead><tr>
              <th scope="col">Rank</th><th scope="col">City</th><th scope="col">Current AQI</th>
              <th scope="col">CPCB band</th><th scope="col">Tomorrow</th><th scope="col">Status</th>
            </tr></thead>
            <tbody>
              @for (row of orderedRows(); track row.city; let index = $index) {
                @if (row.status === 'loading') {
                  <tr class="loading-row" aria-label="Loading {{ row.city }}">
                    <td colspan="6"><span class="skeleton" aria-hidden="true"></span><span class="sr-only">Loading {{ row.city }} data</span></td>
                  </tr>
                } @else {
                  <tr class="city-row" tabindex="0" [attr.aria-label]="'Open dashboard for ' + row.city" (click)="openDashboard(row.city)" (keydown.enter)="openDashboard(row.city)">
                    <td class="rank-cell">{{ rankFor(row) || '—' }}</td>
                    <th scope="row">{{ row.city }}</th>
                    <td>
                      @if (currentAqi(row) !== null) {
                        <div class="aqi-cell"><span class="aqi-value">{{ currentAqi(row) }}</span><span class="aqi-unit">AQI</span>
                          <div class="aqi-bar" aria-hidden="true"><span [ngClass]="bandClass(currentAqi(row))" [style.width.%]="barPercent(currentAqi(row))"></span></div>
                        </div>
                      } @else if (row.status === 'idle') { <span class="muted">Not loaded</span> }
                      @else { <span class="muted">Unavailable</span> }
                      @if (needsRetry(row)) { <button type="button" class="retry-button" [disabled]="isLoadingAll()" (click)="$event.stopPropagation(); retryCity(row.city)">Retry</button> }
                    </td>
                    <td>@if (currentAqi(row) !== null) { <span class="band-chip" [ngClass]="bandClass(currentAqi(row))">{{ band(currentAqi(row)) }}</span> } @else { <span class="muted">—</span> }</td>
                    <td class="forecast-cell">{{ tomorrow(row) }}</td>
                    <td><app-data-status-badge [status]="readingStatus(row)"></app-data-status-badge></td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
      } @else {
        <section class="empty-state" aria-labelledby="empty-title">
          <span class="empty-mark" aria-hidden="true">↗</span>
          <h2 id="empty-title">No city data loaded yet</h2>
          <p>Load the pilot cities to compare readings returned by the API. Unavailable values stay blank rather than being estimated.</p>
        </section>
      }
    </main>
  `,
  styles: [`
    :host{display:block;min-width:0;color:var(--ui-text)}
    .compare-page{width:min(100% - 2rem,1160px);margin:0 auto;padding:clamp(1.25rem,3vw,2.5rem) 0 4rem}
    .page-header{display:flex;align-items:flex-end;justify-content:space-between;gap:1rem;margin-bottom:1.4rem}
    .eyebrow{margin:0 0 .45rem;color:var(--ui-accent-strong);font-size:var(--ui-font-xs);font-weight:800;letter-spacing:.1em}
    h1{margin:0;color:var(--ui-text);font-size:clamp(1.7rem,4vw,2.4rem);line-height:1.12;letter-spacing:-.04em}
    .page-header p:not(.eyebrow){max-width:66ch;margin:.55rem 0 0;color:var(--ui-text-muted);font-size:var(--ui-font-sm);line-height:1.55}
    .load-button{flex:0 0 auto;padding:.7rem 1rem;border:1px solid var(--ui-accent);border-radius:var(--ui-radius);background:var(--ui-accent);color:#fff;font-weight:750;cursor:pointer}
    .load-button:hover:not(:disabled){background:var(--ui-accent-strong)}button:disabled{opacity:.6;cursor:wait}
    .progress-line{display:flex;align-items:center;gap:.75rem;margin:.7rem 0;color:var(--ui-text);font-size:var(--ui-font-sm);font-weight:750}
    .progress-hint{color:var(--ui-text-muted);font-size:var(--ui-font-xs);font-weight:500}.summary-line{margin:.75rem 0;padding:.8rem 1rem;border-left:3px solid var(--ui-accent);border-radius:var(--ui-radius);background:#eff8f6;color:#24494a;font-weight:700;font-size:var(--ui-font-sm)}
    .table-scroll{max-width:100%;overflow:auto;border:var(--ui-hairline);border-radius:var(--ui-radius-large);background:var(--ui-surface);overscroll-behavior-x:contain}
    table{width:100%;min-width:790px;border-collapse:collapse;text-align:left;font-size:var(--ui-font-sm)}caption{padding:.75rem 1rem;text-align:left;color:var(--ui-text-muted);font-size:var(--ui-font-xs)}
    thead{background:var(--ui-surface-muted)}th,td{padding:.8rem .85rem;border-top:var(--ui-hairline);vertical-align:middle;white-space:nowrap}thead th{color:var(--ui-text-muted);font-size:var(--ui-font-xs);font-weight:800;letter-spacing:.06em;text-transform:uppercase}tbody th{color:var(--ui-text);font-weight:750}.city-row{cursor:pointer}.city-row:hover{background:#f4f9f8}.city-row:focus-visible{outline:3px solid var(--ui-accent);outline-offset:-3px;background:#f0f8f6}.rank-cell{color:var(--ui-text-muted);font-variant-numeric:tabular-nums}
    .aqi-cell{display:grid;grid-template-columns:auto auto;align-items:baseline;justify-content:start;column-gap:.35rem;row-gap:.35rem}.aqi-value{color:var(--ui-text);font-size:1.1rem;font-weight:800;font-variant-numeric:tabular-nums}.aqi-unit{color:var(--ui-text-muted);font-size:.68rem}.aqi-bar{grid-column:1/-1;width:130px;height:7px;overflow:hidden;border-radius:99px;background:#e7ecef}.aqi-bar span{display:block;height:100%;min-width:3px;border-radius:inherit}.aqi-bar .band-good{background:var(--cpcb-good)}.aqi-bar .band-satisfactory{background:var(--cpcb-satisfactory)}.aqi-bar .band-moderate{background:var(--cpcb-moderate)}.aqi-bar .band-poor{background:var(--cpcb-poor)}.aqi-bar .band-very-poor{background:var(--cpcb-very-poor)}.aqi-bar .band-severe{background:var(--cpcb-severe)}
    .band-chip{display:inline-block;padding:.25rem .5rem;border:1px solid currentColor;border-radius:var(--ui-radius);font-size:var(--ui-font-xs);font-weight:750}.band-chip.band-good{color:var(--cpcb-good);background:#eff8f1}.band-chip.band-satisfactory{color:var(--cpcb-satisfactory);background:#f4f8e9}.band-chip.band-moderate{color:var(--cpcb-moderate);background:#fff8e8}.band-chip.band-poor{color:var(--cpcb-poor);background:#fff1e9}.band-chip.band-very-poor{color:var(--cpcb-very-poor);background:#fff0f0}.band-chip.band-severe{color:var(--cpcb-severe);background:#fff0f5}.muted{color:var(--ui-text-muted)}.forecast-cell{font-variant-numeric:tabular-nums;font-weight:700}.retry-button{display:block;margin-top:.35rem;padding:.3rem .5rem;border:var(--ui-hairline);border-radius:var(--ui-radius);background:var(--ui-surface);color:var(--ui-accent-strong);font-size:var(--ui-font-xs);font-weight:700;cursor:pointer}.retry-button:hover:not(:disabled){background:#edf7f5}
    .loading-row td{padding:1rem}.skeleton{display:block;width:100%;height:1.1rem;border-radius:var(--ui-radius);background:linear-gradient(90deg,#eef2f3,#e3e9eb,#eef2f3);background-size:200% 100%;animation:shimmer 1.4s ease-in-out infinite}@keyframes shimmer{to{background-position:-200% 0}}
    .empty-state{display:grid;justify-items:center;gap:.45rem;padding:clamp(2rem,7vw,4rem) 1rem;border:var(--ui-hairline);border-radius:var(--ui-radius-large);background:var(--ui-surface);text-align:center}.empty-mark{color:var(--ui-accent);font-size:2rem}.empty-state h2{margin:.25rem 0;color:var(--ui-text);font-size:var(--ui-font-xl)}.empty-state p{max-width:60ch;margin:0;color:var(--ui-text-muted);font-size:var(--ui-font-sm);line-height:1.6}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
    :host-context(.dark-theme) .table-scroll,:host-context(.dark-theme) .empty-state{background:#1e293b;border-color:#475569}:host-context(.dark-theme) h1,:host-context(.dark-theme) tbody th,:host-context(.dark-theme) .aqi-value,:host-context(.dark-theme) .empty-state h2{color:#f8fafc}:host-context(.dark-theme) thead{background:#0f172a}:host-context(.dark-theme) thead th,:host-context(.dark-theme) .muted,:host-context(.dark-theme) .empty-state p{color:#cbd5e1}:host-context(.dark-theme) .city-row:hover,:host-context(.dark-theme) .city-row:focus-visible{background:#263c43}:host-context(.dark-theme) .summary-line{background:#163936;color:#d9f3ee}
    @media(max-width:767px){.page-header{align-items:flex-start;flex-direction:column}.load-button{width:100%}.progress-line{align-items:flex-start;flex-direction:column;gap:.2rem}}
    @media(prefers-reduced-motion:reduce){.skeleton{animation:none;background:#e8edef}}
  `]
})
export class CompareComponent {
  private readonly aqiService = inject(AqiService);
  private readonly cityData = inject(CityDataService);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);

  readonly results = this.cityData.results;
  readonly isLoadingAll = signal(false);
  readonly hasStarted = computed(() => this.results().some(result => result.status !== 'idle'));
  readonly loadedCount = computed(() => this.results().filter(result => result.status === 'ready').length);
  readonly orderedRows = computed(() => [...this.results()].sort((a, b) => {
    const aqiA = this.currentAqi(a), aqiB = this.currentAqi(b);
    if (aqiA === null && aqiB === null) return this.cityData.cities.indexOf(a.city) - this.cityData.cities.indexOf(b.city);
    if (aqiA === null) return 1;
    if (aqiB === null) return -1;
    return aqiB - aqiA;
  }));
  readonly summary = computed(() => {
    const loaded = this.results().filter(row => this.currentAqi(row) !== null);
    if (loaded.length < 2) return null;
    const sorted = [...loaded].sort((a, b) => this.currentAqi(a)! - this.currentAqi(b)!);
    const lowest = sorted[0], highest = sorted[sorted.length - 1];
    return `Highest right now: ${highest.city} (AQI ${this.currentAqi(highest)}). Lowest: ${lowest.city} (AQI ${this.currentAqi(lowest)}).`;
  });

  async loadAllCities(): Promise<void> {
    if (!isPlatformBrowser(this.platformId) || this.isLoadingAll()) return;
    this.isLoadingAll.set(true);
    try {
      for (const city of this.cityData.cities) await this.loadCity(city);
    } finally {
      this.isLoadingAll.set(false);
    }
  }

  async retryCity(city: PilotCity): Promise<void> {
    if (!isPlatformBrowser(this.platformId) || this.isLoadingAll()) return;
    await this.loadCity(city);
  }

  private async loadCity(city: PilotCity): Promise<void> {
    this.cityData.beginLoad(city);
    try {
      const liveResponse = await firstValueFrom(this.aqiService.getLiveAqi(city).pipe(catchError(() => of(null))));
      if (liveResponse) this.cityData.storeLive(city, toLiveVM(liveResponse));

      const forecastResponse = await firstValueFrom(this.aqiService.getForecast(city, 'General Public').pipe(catchError(() => of(null))));
      if (forecastResponse) this.cityData.storeForecast(city, toForecastVM(forecastResponse, 'backend'));

      this.cityData.finishLoad(city, 'AQI and forecast data are unavailable. Retry this city to try again.');
    } catch {
      this.cityData.failLoad(city, 'AQI or forecast data could not be loaded. Retry this city to try again.');
    }
  }

  currentAqi(result: CityDataResult): number | null { return result.live?.aqi ?? null; }
  readingStatus(result: CityDataResult) {
    return this.currentAqi(result) === null ? 'unavailable' : result.live?.dataStatus ?? 'unavailable';
  }

  band(aqi: number | null): string { return aqi === null ? 'Unavailable' : this.aqiCategory(aqi); }
  bandClass(aqi: number | null): string {
    if (aqi === null) return '';
    if (aqi <= 50) return 'band-good';
    if (aqi <= 100) return 'band-satisfactory';
    if (aqi <= 200) return 'band-moderate';
    if (aqi <= 300) return 'band-poor';
    if (aqi <= 400) return 'band-very-poor';
    return 'band-severe';
  }
  barPercent(aqi: number | null): number { return aqi === null ? 0 : Math.min(100, Math.max(0, (aqi / 500) * 100)); }

  tomorrow(result: CityDataResult): string {
    const current = this.currentAqi(result), forecast = result.forecast?.day1?.value;
    if (forecast === null || forecast === undefined) return '—';
    if (current === null) return `${forecast} · trend unavailable`;
    const arrow = forecast > current ? '↑' : forecast < current ? '↓' : '→';
    return `${arrow} ${forecast}`;
  }

  rankFor(result: CityDataResult): number | null {
    const rankIndex = this.orderedRows().filter(row => this.currentAqi(row) !== null).findIndex(row => row.city === result.city);
    return rankIndex < 0 ? null : rankIndex + 1;
  }
  needsRetry(result: CityDataResult): boolean {
    return result.status === 'error' || (result.status === 'ready' &&
      (this.currentAqi(result) === null || result.forecast?.day1?.value === null || result.forecast?.day1?.value === undefined));
  }

  openDashboard(city: PilotCity): void {
    this.cityData.setSelectedCity(city);
    void this.router.navigate(['/app/dashboard']);
  }

  private aqiCategory(aqi: number): string {
    if (aqi <= 50) return 'Good';
    if (aqi <= 100) return 'Satisfactory';
    if (aqi <= 200) return 'Moderate';
    if (aqi <= 300) return 'Poor';
    if (aqi <= 400) return 'Very Poor';
    return 'Severe';
  }
}
