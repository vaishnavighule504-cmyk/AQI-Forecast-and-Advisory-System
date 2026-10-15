import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ForecastHorizon, MODEL_RESULTS } from '../../data/model-results';

@Component({
  selector: 'app-model',
  standalone: true,
  imports: [CommonModule],
  template: `
    <main class="model-page" aria-labelledby="model-page-title">
      <header class="page-heading">
        <p class="eyebrow">METHOD & EVALUATION</p>
        <h1 id="model-page-title">How SaansCast forecasts</h1>
        <p>A concise view of the data, features, validation approach, and offline model results behind the AQI forecast.</p>
      </header>

      <section class="panel pipeline-panel" aria-labelledby="pipeline-title">
        <div class="section-heading"><p class="eyebrow">FROM OBSERVATIONS TO GUIDANCE</p><h2 id="pipeline-title">Forecast pipeline</h2></div>
        <ol class="pipeline">
          <li><span class="step-index">01</span><h3>Data</h3><p>Clean daily city-level CPCB AQI records form the input series.</p></li>
          <li><span class="step-index">02</span><h3>Features</h3><p>Trailing AQI history and calendar fields describe recent conditions.</p></li>
          <li><span class="step-index">03</span><h3>Models</h3><p>City-specific candidates are compared with a persistence baseline.</p></li>
          <li><span class="step-index">04</span><h3>Forecast</h3><p>The selected model estimates AQI one or two days ahead.</p></li>
          <li><span class="step-index">05</span><h3>Advisory</h3><p>Available forecasts and optional profiles inform general guidance.</p></li>
        </ol>
      </section>

      <section class="panel" aria-labelledby="data-title">
        <div class="section-heading"><p class="eyebrow">SOURCE DATA</p><h2 id="data-title">Data</h2></div>
        <div class="data-facts">
          <div><span class="fact-value">7</span><span class="fact-label">pilot cities</span></div>
          <div><span class="fact-value">10,487</span><span class="fact-label">rows after cleaning</span></div>
          <div><span class="fact-value">2015-01-08 — 2020-07-01</span><span class="fact-label">CPCB daily city-level data</span></div>
        </div>
      </section>

      <section class="panel" aria-labelledby="features-title">
        <div class="section-heading"><p class="eyebrow">INPUTS</p><h2 id="features-title">Features</h2></div>
        <ul class="feature-list">
          <li>AQI lag 1 day</li><li>AQI lag 3 days</li><li>AQI lag 7 days</li>
          <li>3-day rolling mean</li><li>7-day rolling mean</li><li>7-day rolling standard deviation</li>
          <li>Day of week</li><li>Month</li>
        </ul>
        <p class="callout"><strong>Leakage control:</strong> all rolling windows are trailing windows and use no future values.</p>
      </section>

      <section class="panel" aria-labelledby="validation-title">
        <div class="section-heading"><p class="eyebrow">TIME-ORDERED EVALUATION</p><h2 id="validation-title">Validation</h2></div>
        <div class="validation-grid">
          <div><span class="fact-label">Training period</span><strong>2015-01-08 to 2019-12-31</strong></div>
          <div><span class="fact-label">Test period</span><strong>2020-01-01 to 2020-07-01</strong></div>
          <div><span class="fact-label">Test duration</span><strong>183 days per city</strong></div>
        </div>
        <p>The split is chronological. The 2-day model is trained directly on the t+2 target (direct multi-step); it does not feed the day-1 prediction forward.</p>
      </section>

      <section class="panel" aria-labelledby="selection-title">
        <div class="section-heading"><p class="eyebrow">CITY-SPECIFIC SELECTION</p><h2 id="selection-title">Model selection rule</h2></div>
        <p>A city uses an ML model only when it beats the persistence baseline (tomorrow = today) on the test set; otherwise, it keeps persistence.</p>
        <p class="secondary-note">An extended Random Forest model is under validation and is not used for the reported results.</p>
      </section>

      <section class="panel results-panel" aria-labelledby="results-title">
        <div class="section-heading"><p class="eyebrow">OFFLINE EVALUATION</p><h2 id="results-title">Reported results</h2></div>
        <p class="offline-note">Offline evaluation results from the ML team's report. These are not live metrics.</p>
        <div class="horizon-toggle" role="group" aria-label="Choose forecast horizon">
          <button type="button" [attr.aria-pressed]="activeHorizon() === '1-day'" (click)="setHorizon('1-day')">1-day</button>
          <button type="button" [attr.aria-pressed]="activeHorizon() === '2-day'" (click)="setHorizon('2-day')">2-day</button>
        </div>
        <div class="table-scroll" tabindex="0" aria-label="Scrollable model evaluation results">
          <table>
            <caption>{{ activeHorizon() === '1-day' ? 'One-day' : 'Two-day' }} offline evaluation results by city. AQI error metrics are in AQI points.</caption>
            <thead><tr>
              <th scope="col">City</th><th scope="col">Horizon</th><th scope="col">Model</th>
              <th scope="col">MAE</th><th scope="col">RMSE</th><th scope="col">R2</th>
            </tr></thead>
            <tbody>
              @for (result of selectedResults; track result.city) {
                <tr>
                  <th scope="row">{{ result.city }}</th><td>{{ result.horizon }}</td><td>{{ result.model }}</td>
                  <td class="numeric">{{ result.mae | number:'1.2-2' }}</td>
                  <td class="numeric">{{ result.rmse | number:'1.2-2' }}</td>
                  <td class="numeric">{{ result.r2 | number:'1.2-2' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>

      <section class="panel" aria-labelledby="aqi-title">
        <div class="section-heading"><p class="eyebrow">READING THE INDEX</p><h2 id="aqi-title">How AQI is calculated</h2></div>
        <p class="formula">Sub-index = ((I_hi - I_lo) / (BP_hi - BP_lo)) * (C - BP_lo) + I_lo</p>
        <p>Overall AQI is the highest sub-index. At least 3 pollutants, including PM2.5 or PM10, are required.</p>
        <div class="table-scroll category-table-scroll" tabindex="0" aria-label="Scrollable CPCB AQI categories">
          <table class="category-table">
            <caption>CPCB AQI category ranges</caption>
            <thead><tr><th scope="col">Category</th><th scope="col">AQI range</th></tr></thead>
            <tbody>
              <tr><th scope="row">Good</th><td>0–50</td></tr>
              <tr><th scope="row">Satisfactory</th><td>51–100</td></tr>
              <tr><th scope="row">Moderate</th><td>101–200</td></tr>
              <tr><th scope="row">Poor</th><td>201–300</td></tr>
              <tr><th scope="row">Very Poor</th><td>301–400</td></tr>
              <tr><th scope="row">Severe</th><td>401–500</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="panel" aria-labelledby="metrics-title">
        <div class="section-heading"><p class="eyebrow">ERROR MEASURES</p><h2 id="metrics-title">Metric definitions</h2></div>
        <ul class="metric-definitions">
          <li><strong>MAE:</strong> mean absolute difference between predicted and observed AQI.</li>
          <li><strong>RMSE:</strong> square root of the mean squared prediction error; larger errors contribute more.</li>
          <li><strong>R2:</strong> variance explained relative to the mean baseline; a negative value is worse than that baseline.</li>
        </ul>
      </section>

      <section class="panel limitations" aria-labelledby="limitations-title">
        <div class="section-heading"><p class="eyebrow">SCOPE & CAVEATS</p><h2 id="limitations-title">Limitations</h2></div>
        <ul>
          <li>No weather inputs yet.</li>
          <li>The short 183-day test window was used both for model selection and reporting.</li>
          <li>Four cities use the persistence baseline because no model beat it.</li>
          <li>Chennai's 2-day R2 is negative.</li>
          <li>Prediction intervals are not available.</li>
          <li>Model selection and reported metrics use the same test window.</li>
        </ul>
      </section>
    </main>
  `,
  styles: [`
    :host{display:block;min-width:0;color:var(--ui-text)}
    .model-page{width:min(100% - 2rem,1100px);margin:0 auto;padding:clamp(1.25rem,3vw,2.5rem) 0 4rem;display:grid;gap:var(--ui-space-4)}
    .page-heading{padding:.5rem 0 1rem}.eyebrow{margin:0 0 .45rem;color:var(--ui-accent-strong);font-size:var(--ui-font-xs);font-weight:800;letter-spacing:.1em}
    h1,h2,h3,p{margin-top:0}.page-heading h1{margin-bottom:.55rem;color:var(--ui-text);font-size:clamp(1.8rem,4vw,2.6rem);line-height:1.1;letter-spacing:-.045em}
    .page-heading>p:last-child{max-width:70ch;margin:0;color:var(--ui-text-muted);line-height:1.6}
    .panel{min-width:0;padding:clamp(1rem,2.5vw,1.5rem);background:var(--ui-surface);border:var(--ui-hairline);border-radius:var(--ui-radius-large);box-shadow:var(--ui-shadow)}
    .section-heading{margin-bottom:1rem}.section-heading h2{margin:0;color:var(--ui-text);font-size:var(--ui-font-xl);line-height:1.25;letter-spacing:-.025em}
    .pipeline{list-style:none;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:.75rem;margin:0;padding:0}
    .pipeline li{min-width:0;padding:.9rem;border-left:2px solid var(--ui-accent);background:var(--ui-surface-muted);border-radius:var(--ui-radius)}
    .step-index{color:var(--ui-accent-strong);font-size:var(--ui-font-xs);font-weight:800;letter-spacing:.08em}.pipeline h3{margin:.55rem 0 .3rem;color:var(--ui-text);font-size:var(--ui-font-base)}
    .pipeline p,.panel>p{margin-bottom:0;color:var(--ui-text-muted);font-size:var(--ui-font-sm);line-height:1.6}
    .data-facts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.75rem}.data-facts>div,.validation-grid>div{display:grid;gap:.3rem;padding:.85rem;background:var(--ui-surface-muted);border-radius:var(--ui-radius)}
    .fact-value{color:var(--ui-accent-strong);font-size:clamp(1.05rem,2.5vw,1.35rem);font-weight:800;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}.fact-label{color:var(--ui-text-muted);font-size:var(--ui-font-xs)}
    .feature-list{list-style:none;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.5rem;margin:0;padding:0}.feature-list li{padding:.65rem .75rem;border:var(--ui-hairline);border-radius:var(--ui-radius);color:var(--ui-text);font-size:var(--ui-font-sm)}
    .callout{margin-top:1rem!important;padding:.8rem 1rem;border-left:3px solid var(--ui-accent);background:#f0f8f6;border-radius:var(--ui-radius);color:#25454a!important}
    .validation-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.75rem;margin-bottom:1rem}.validation-grid strong{color:var(--ui-text);font-size:var(--ui-font-sm)}
    .secondary-note{margin-top:.75rem!important;padding:.75rem 1rem;border-radius:var(--ui-radius);background:var(--ui-surface-muted);font-size:var(--ui-font-xs)!important}
    .offline-note{display:inline-block;margin:0 0 1rem;padding:.5rem .75rem;border-radius:var(--ui-radius);background:#f0f8f6;color:#25454a;font-size:var(--ui-font-sm);font-weight:700}
    .horizon-toggle{display:flex;gap:.35rem;margin-bottom:.8rem}.horizon-toggle button{min-width:5.25rem;padding:.5rem .8rem;border:var(--ui-hairline);border-radius:var(--ui-radius);background:var(--ui-surface);color:var(--ui-text-muted);font-weight:700;cursor:pointer}
    .horizon-toggle button[aria-pressed=true]{border-color:var(--ui-accent);background:var(--ui-accent);color:#fff}
    .table-scroll{max-width:100%;overflow:auto;border:var(--ui-hairline);border-radius:var(--ui-radius)}table{width:100%;border-collapse:collapse;text-align:left;font-size:var(--ui-font-sm)}
    caption{padding:.7rem .8rem;text-align:left;color:var(--ui-text-muted);font-size:var(--ui-font-xs)}th,td{padding:.7rem .8rem;border-top:var(--ui-hairline);white-space:nowrap}thead th{background:var(--ui-surface-muted);color:var(--ui-text);font-size:var(--ui-font-xs);letter-spacing:.04em;text-transform:uppercase}tbody th{color:var(--ui-text);font-weight:700}tbody td{color:var(--ui-text-muted)}.numeric{font-variant-numeric:tabular-nums;text-align:right}
    .formula{overflow-wrap:anywhere;padding:.8rem 1rem;background:var(--ui-surface-muted);border:var(--ui-hairline);border-radius:var(--ui-radius);font-family:ui-monospace,SFMono-Regular,Consolas,monospace;color:var(--ui-text)!important}
    .category-table{max-width:460px}.category-table th,.category-table td{padding:.55rem .75rem}.metric-definitions,.limitations ul{display:grid;gap:.55rem;margin:0;padding-left:1.25rem;color:var(--ui-text-muted);font-size:var(--ui-font-sm);line-height:1.55}.metric-definitions strong{color:var(--ui-text)}.limitations{border-inline-start:3px solid #b78033}
    :host-context(.dark-theme) .panel{background:#1e293b;border-color:#475569}:host-context(.dark-theme) .page-heading h1,:host-context(.dark-theme) .section-heading h2,:host-context(.dark-theme) .pipeline h3,:host-context(.dark-theme) tbody th,:host-context(.dark-theme) thead th,:host-context(.dark-theme) .validation-grid strong,:host-context(.dark-theme) .formula,:host-context(.dark-theme) .metric-definitions strong{color:#f8fafc}
    :host-context(.dark-theme) .pipeline li,:host-context(.dark-theme) .data-facts>div,:host-context(.dark-theme) .validation-grid>div,:host-context(.dark-theme) .feature-list li,:host-context(.dark-theme) .secondary-note,:host-context(.dark-theme) .formula,:host-context(.dark-theme) thead th{background:#0f172a;border-color:#475569}
    :host-context(.dark-theme) .panel>p,:host-context(.dark-theme) .pipeline p,:host-context(.dark-theme) tbody td,:host-context(.dark-theme) .metric-definitions,:host-context(.dark-theme) .limitations ul{color:#cbd5e1}
    @media(max-width:767px){.pipeline{grid-template-columns:repeat(2,minmax(0,1fr))}.pipeline li:last-child{grid-column:1/-1}.feature-list{grid-template-columns:repeat(2,minmax(0,1fr))}.data-facts{grid-template-columns:1fr}}
    @media(max-width:480px){.model-page{width:min(100% - 1.25rem,1100px)}.pipeline{grid-template-columns:1fr}.pipeline li:last-child{grid-column:auto}.validation-grid{grid-template-columns:1fr}.panel{padding:1rem}.table-scroll{overscroll-behavior-x:contain}}
  `]
})
export class ModelComponent {
  activeHorizon = signal<ForecastHorizon>('1-day');
  readonly results = MODEL_RESULTS;

  get selectedResults() { return this.results[this.activeHorizon()]; }
  setHorizon(horizon: ForecastHorizon): void { this.activeHorizon.set(horizon); }
}
