import { Component, inject, signal, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ProfileService, Purpose, Sensitivity, UserProfile } from '../../services/profile.service';

@Component({
  selector: 'app-onboarding', standalone: true, imports: [CommonModule, FormsModule],
  template: `
    <main class="onboarding">
      <section class="card">
        <p class="eyebrow">PERSONALISE SAANSCAST · STEP {{ step() }} OF 4</p>
        <h1>{{ stepTitle }}</h1>
        <p class="storage-note">saved on this device (demo profile, not secure account storage)</p>

        @if (step() === 1) {
          <label for="city">Pilot city</label>
          <select id="city" [(ngModel)]="city">
            @for (item of cities; track item) { <option [value]="item">{{ item }}</option> }
          </select>
          <button type="button" class="secondary" (click)="useLocation()">Use my location</button>
          @if (locationMessage()) { <p role="status">{{ locationMessage() }}</p> }
        } @else if (step() === 2) {
          <label for="purpose">Main purpose</label>
          <select id="purpose" [(ngModel)]="purpose">
            @for (item of purposes; track item) { <option [value]="item">{{ item }}</option> }
          </select>
        } @else if (step() === 3) {
          <p>Optional. Used only to choose the guidance shown to you.</p>
          <label for="sensitivity">Sensitivity</label>
          <select id="sensitivity" [(ngModel)]="sensitivity">
            @for (item of sensitivities; track item.value) { <option [value]="item.value">{{ item.label }}</option> }
          </select>
          @if (sensitivity === 'child') { <p class="sensitive-label">Sensitive-group guidance</p> }
        } @else {
          <fieldset><legend>Typical outdoor times</legend>
            @for (time of times; track time) { <label class="check"><input type="checkbox" [checked]="outdoorTimes.includes(time)" (change)="toggleTime(time)"> {{ time | titlecase }}</label> }
          </fieldset>
          <label for="threshold">Alert threshold</label>
          <select id="threshold" [(ngModel)]="threshold">
            @for (value of thresholds; track value) { <option [ngValue]="value">AQI {{ value }}</option> }
          </select>
        }
        @if (errorMessage()) { <p class="error" role="alert">{{ errorMessage() }}</p> }
        <div class="actions">
          @if (step() > 1) { <button type="button" class="secondary" (click)="previous()">Back</button> }
          @if (step() < 4) { <button type="button" (click)="next()">Continue</button> }
          @else { <button type="button" (click)="save()">Save preferences</button> }
        </div>
      </section>
    </main>
  `,
  styles: [`
    .onboarding{min-height:78vh;display:grid;place-items:center;padding:clamp(1rem,4vw,3rem);background:radial-gradient(ellipse at 12% 16%,#d8eee8 0,transparent 35%),radial-gradient(ellipse at 90% 85%,#e4ecf1 0,transparent 35%),#f5f8f7;font-family:inherit;color:#17212f}
    .card{position:relative;width:min(100%,600px);padding:clamp(1.25rem,4vw,2.5rem);background:#fff;border:1px solid #dce6e3;border-radius:10px;box-shadow:0 16px 40px rgb(20 50 50 / 9%);overflow:hidden}
    .card::before{content:'';position:absolute;inset:0 0 auto;height:4px;background:linear-gradient(90deg,#0f766e,#73a99c,transparent)}
    .eyebrow{font-size:.72rem;font-weight:800;letter-spacing:.11em;color:#0f766e;margin:0 0 .65rem}
    .storage-note{font-size:.8rem;color:#586b72;padding:.65rem .8rem;background:#f3f7f6;border-radius:6px}
    h1{margin:.3rem 0 1.2rem;font-size:clamp(1.5rem,4vw,2rem);letter-spacing:-.04em;color:#18323a}
    select{display:block;width:100%;padding:.8rem;margin:.45rem 0 1rem;border:1px solid #c8d5d8;border-radius:7px;background:#fff;color:#17313a}
    label{font-weight:650}button{padding:.7rem 1rem;border:1px solid #0f766e;border-radius:7px;background:#0f766e;color:#fff;font-weight:700;cursor:pointer}
    button:hover{background:#115e59}.secondary{background:#fff;color:#0f766e}.secondary:hover{background:#edf7f5;color:#0f5b55}
    .actions{display:flex;justify-content:flex-end;gap:.6rem;margin-top:1.5rem;padding-top:1rem;border-top:1px solid #e8eeee}
    .check{display:flex;align-items:center;gap:.55rem;margin:.65rem 0}.check input{accent-color:#0f766e;width:1rem;height:1rem}
    .sensitive-label{font-weight:700;color:#426c66}.error{color:#a12828}fieldset{margin:0 0 1rem;padding:.75rem 1rem;border:1px solid #cbd8d8;border-radius:7px}
    :focus-visible{outline:3px solid #0f766e;outline-offset:2px}
    @media(max-width:420px){.onboarding{padding:.75rem}.card{padding:1.25rem}.actions{justify-content:stretch}.actions button{flex:1}}
  `]
})
export class OnboardingComponent {
  private profileService = inject(ProfileService);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);
  step = signal(1);
  locationMessage = signal('');
  errorMessage = signal('');
  cities = ['Delhi', 'Mumbai', 'Bengaluru', 'Chennai', 'Hyderabad', 'Ahmedabad', 'Kolkata'];
  purposes: Purpose[] = ['personal health', 'family safety', 'outdoor exercise', 'commuting', 'work or school', 'general awareness'];
  sensitivities: { value: Sensitivity; label: string }[] = [
    { value: 'general', label: 'General' }, { value: 'asthma', label: 'Asthma or respiratory sensitivity' },
    { value: 'child', label: 'Child in household' }, { value: 'elderly', label: 'Elderly family member' }, { value: 'outdoor worker', label: 'Outdoor worker' }
  ];
  times: Array<'morning' | 'afternoon' | 'evening'> = ['morning', 'afternoon', 'evening'];
  thresholds: Array<100 | 150 | 200 | 300> = [100, 150, 200, 300];
  city = 'Delhi'; purpose: Purpose = 'general awareness'; sensitivity: Sensitivity = 'general';
  outdoorTimes: Array<'morning' | 'afternoon' | 'evening'> = [];
  threshold: 100 | 150 | 200 | 300 = 150;

  constructor() {
    const existing = this.profileService.load();
    if (existing) {
      this.city = existing.city; this.purpose = existing.purpose; this.sensitivity = existing.sensitivity;
      this.outdoorTimes = existing.outdoorTimes; this.threshold = existing.alertThreshold;
    }
  }

  get stepTitle(): string { return ['Choose your city', 'What brings you here?', 'Optional sensitivity', 'When should we keep you informed?'][this.step() - 1]; }
  next(): void { this.errorMessage.set(''); this.step.update(value => Math.min(4, value + 1)); }
  previous(): void { this.step.update(value => Math.max(1, value - 1)); }
  toggleTime(time: 'morning' | 'afternoon' | 'evening'): void {
    this.outdoorTimes = this.outdoorTimes.includes(time) ? this.outdoorTimes.filter(value => value !== time) : [...this.outdoorTimes, time];
  }

  useLocation(): void {
    this.locationMessage.set('');
    if (!isPlatformBrowser(this.platformId)) { this.locationMessage.set('Location is available in a browser. Choose a city from the list.'); return; }
    try {
    if (!navigator.geolocation) { this.locationMessage.set('Location is unavailable. Choose a city from the list.'); return; }
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      const distances: Record<string, [number, number]> = {
        Delhi: [28.6139,77.2090], Mumbai: [19.0760,72.8777], Bengaluru: [12.9716,77.5946], Chennai: [13.0827,80.2707],
        Hyderabad: [17.3850,78.4867], Ahmedabad: [23.0225,72.5714], Kolkata: [22.5726,88.3639]
      };
      const nearest = Object.entries(distances).sort((a, b) => this.distance(coords.latitude, coords.longitude, a[1]) - this.distance(coords.latitude, coords.longitude, b[1]))[0];
      this.city = nearest[0]; this.locationMessage.set(`Nearest pilot city selected: ${this.city}.`);
    }, () => this.locationMessage.set('Location permission was not granted. Choose a city from the list.'), { enableHighAccuracy: false, timeout: 10000 });
    } catch { this.locationMessage.set('Location is unavailable. Choose a city from the list.'); }
  }

  private distance(lat: number, lon: number, point: [number, number]): number {
    const rad = (n: number) => n * Math.PI / 180;
    const dLat = rad(point[0] - lat), dLon = rad(point[1] - lon);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat)) * Math.cos(rad(point[0])) * Math.sin(dLon / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  save(): void {
    const profile: UserProfile = { city: this.city, purpose: this.purpose, sensitivity: this.sensitivity, outdoorTimes: this.outdoorTimes, alertThreshold: this.threshold };
    if (!this.profileService.save(profile)) { this.errorMessage.set('Could not save on this device. Check browser storage settings.'); return; }
    this.router.navigate(['/app/dashboard']);
  }
}
