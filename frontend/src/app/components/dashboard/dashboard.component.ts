import { Component, signal, inject, PLATFORM_ID, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { AqiService, ForecastResponse, LiveAqiResponse, StationDetails } from '../../services/aqi.service';
import { ForecastVM, LiveVM, toForecastVM, toLiveVM, isExplicitDemoMode } from '../../services/aqi-view-models';
import { DataStatusBadgeComponent } from '../data-status-badge/data-status-badge.component';
import { ProfileService, UserProfile } from '../../services/profile.service';
import { Router } from '@angular/router';
import { AirPlanComponent } from '../air-plan/air-plan.component';
import { AssistantComponent } from '../assistant/assistant.component';
import { AssistantContext } from '../../services/chat-provider';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, DataStatusBadgeComponent, AirPlanComponent, AssistantComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements AfterViewInit, OnDestroy {
  private aqiService = inject(AqiService);
  private platformId = inject(PLATFORM_ID);
  private profileService = inject(ProfileService);
  private router = inject(Router);

  // UI Signals
  selectedCity = signal<string>(this.profileService.load()?.city || 'Delhi');
  selectedProfile = signal<string>(this.profileService.backendProfile(this.profileService.load()?.sensitivity || 'general'));
  savedProfile = signal<UserProfile | null>(this.profileService.load());

  // UI Signals
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  liveErrorMessage = signal<string | null>(null);
  liveStatus = signal<import('../../services/aqi-view-models').DataStatus>('loading');
  forecastStatus = signal<import('../../services/aqi-view-models').DataStatus>('loading');
  forecastVM = signal<ForecastVM | null>(null);
  liveVM = signal<LiveVM | null>(null);
  demoMode = signal<boolean>(false);
  forecastIsDemo = signal<boolean>(false);

  private stationMarkers: any[] = [];
  private forecastSub: any;
  private liveSub: any;


  cities = ['Delhi', 'Mumbai', 'Bengaluru', 'Chennai', 'Hyderabad', 'Ahmedabad', 'Kolkata'];
  profiles = ['General Public', 'Asthma', 'Elderly', 'Outdoor Worker'];

  // Map variables
  private map: any;
  private leaflet: any;
  private mapMarkers: { [key: string]: any } = {};
  
  private cityCoords: { [key: string]: [number, number] } = {
    'Delhi': [28.6139, 77.2090],
    'Mumbai': [19.0760, 72.8777],
    'Bengaluru': [12.9716, 77.5946],
    'Chennai': [13.0827, 80.2707],
    'Kolkata': [22.5726, 88.3639],
    'Hyderabad': [17.3850, 78.4867],
    'Ahmedabad': [23.0225, 72.5714]
  };

  ngAfterViewInit() {
    if (!isPlatformBrowser(this.platformId)) {
      this.liveStatus.set('unavailable');
      this.forecastStatus.set('unavailable');
      this.isLoading.set(false);
      return;
    }
    this.demoMode.set(isExplicitDemoMode(window.location.search));
    this.fetchForecast();
    this.initMap();
  }

  private async initMap() {
    try {
      const L = await import('leaflet');
      this.leaflet = L;
      
      this.map = L.map('aqi-phase3-map', {
        center: [20.5937, 78.9629],
        zoom: 4.5,
        zoomControl: true,
        scrollWheelZoom: false
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; OpenStreetMap'
      }).addTo(this.map);

      Object.keys(this.cityCoords).forEach((city) => {
        const coords = this.cityCoords[city];

        let aqiVal: number | null = null;
        let colorClass = 'aqi-unavailable';
        const allCities = this.getRankedCities();
        const cityData = allCities.find(c => c.name === city);
        if (cityData) {
          aqiVal = cityData.aqi;
          colorClass = cityData.colorClass;
        }

        const icon = L.divIcon({
          className: 'custom-map-marker',
          html: `<div class="city-marker-badge ${colorClass}" id="marker-${city.toLowerCase()}">${aqiVal === null ? '–' : aqiVal}</div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        });

        const marker = L.marker(coords, { icon })
          .addTo(this.map)
          .bindTooltip(`<b>${city}</b>`, { permanent: false, direction: 'top' });

        marker.on('click', () => {
          this.onCityChange(city);
        });

        this.mapMarkers[city] = marker;
      });
      
      // Auto-focus initial city
      setTimeout(() => {
        this.map.invalidateSize();
        this.updateMapMarkers();
        this.focusCityMap(this.selectedCity());
      }, 500);

    } catch (err) {
      console.warn('Leaflet map initialization skipped/failed:', err);
    }
  }

  private focusCityMap(city: string) {
    if (this.map && this.cityCoords[city]) {
      this.map.setView(this.cityCoords[city], 5, { animate: true });
      
      Object.keys(this.mapMarkers).forEach((name) => {
        const badge = document.getElementById(`marker-${name.toLowerCase()}`);
        if (badge) {
          if (name === city) {
            badge.classList.add('selected-city');
          } else {
            badge.classList.remove('selected-city');
          }
        }
      });
    }
  }

  private updateMapMarkers(): void {
    if (!this.leaflet) return;
    for (const city of Object.keys(this.mapMarkers)) {
      const cityData = this.getRankedCities().find(item => item.name === city);
      const value = cityData?.aqi ?? null;
      const icon = this.leaflet.divIcon({
        className: 'custom-map-marker',
        html: `<div class="city-marker-badge ${cityData?.colorClass || 'aqi-unavailable'}" id="marker-${city.toLowerCase()}">${value === null ? '–' : value}</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });
      this.mapMarkers[city].setIcon(icon);
    }
  }

  onCityChange(city: string) {
    this.selectedCity.set(city);
    this.fetchForecast();
    this.focusCityMap(city);
  }

  editProfile(): void { this.router.navigate(['/onboarding']); }

  get profileChipSensitivity(): string {
    return this.savedProfile()?.sensitivity === 'child' ? 'Sensitive-group guidance' : this.selectedProfile();
  }


  onProfileChange(profile: string) {
    this.selectedProfile.set(profile);
    this.fetchForecast();
  }

  ngOnDestroy() {
    if (this.forecastSub) {
      this.forecastSub.unsubscribe();
    }
    if (this.liveSub) {
      this.liveSub.unsubscribe();
    }
  }

  fetchForecast() {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.liveErrorMessage.set(null);
    this.liveStatus.set('loading');
    this.forecastStatus.set('loading');
    this.liveVM.set(null);
    this.forecastVM.set(null);
    this.forecastIsDemo.set(false);
    this.updateMapMarkers();

    const city = this.selectedCity();

    if (this.demoMode()) {
      const demoLive = this.generateMockLiveAqi(city);
      this.liveVM.set({ ...toLiveVM(demoLive), dataStatus: 'demo' });
      this.liveStatus.set('demo');
      const demoForecast = this.generateMockForecast(city, this.selectedProfile());
      this.forecastVM.set(toForecastVM(demoForecast, 'demo'));
      this.forecastStatus.set('demo');
      this.forecastIsDemo.set(true);
      this.isLoading.set(false);
      this.updateMapMarkers();
      return;
    }

    // Prevent race conditions and memory leaks by unsubscribing outdated active requests
    if (this.liveSub) {
      this.liveSub.unsubscribe();
    }
    if (this.forecastSub) {
      this.forecastSub.unsubscribe();
    }

    // 1. Fetch live telemetry data
    this.liveSub = this.aqiService.getLiveAqi(city).subscribe({
      next: (liveRes) => {
        const viewModel = toLiveVM(liveRes);
        this.liveStatus.set(viewModel.dataStatus);
        this.liveVM.set(viewModel);
        if (viewModel.dataStatus === 'unavailable') this.liveErrorMessage.set('No usable current AQI, pollutant, or station data was returned.');
        this.updateMapMarkers();
      },
      error: (err) => {
        console.warn('Failed fetching live telemetry.', err);
        this.liveStatus.set('unavailable');
        this.liveErrorMessage.set('Current AQI data is unavailable. Retry to try again.');
        this.updateMapMarkers();
      }
    });

    // 2. Fetch ML modeling forecasts
    this.forecastSub = this.aqiService.getForecast(city, this.selectedProfile()).subscribe({
      next: (response) => {
        const viewModel = toForecastVM(response, 'backend');
        this.forecastVM.set(viewModel);
        this.forecastStatus.set(viewModel.dataStatus);
        if (viewModel.dataStatus === 'unavailable') this.errorMessage.set('The forecast response contained no usable reading or forecast values.');
        this.isLoading.set(false);
        this.updateMapMarkers();
      },
      error: (err) => {
        console.warn('Forecasting API unavailable.', err);
        this.forecastStatus.set('unavailable');
        this.forecastVM.set(null);
        this.errorMessage.set('Forecast data is unavailable. Retry to try again.');
        this.isLoading.set(false);
        this.updateMapMarkers();
      }
    });
  }

  // --- FALLBACK GENERATORS ---
  private pseudorandomAqi(city: string): number {
    // Generate a consistent pseudo-random AQI based on city name length to simulate differences
    const base = city.length * 15;
    return Math.min(Math.max(base + 45, 50), 450);
  }

  private generateMockLiveAqi(city: string): LiveAqiResponse {
    const aqi = this.pseudorandomAqi(city);
    return {
      live: false,
      city: city,
      date: new Date().toISOString().split('T')[0],
      aqi: aqi,
      pollutants: {
        pm25: Math.floor(aqi * 0.4),
        pm10: Math.floor(aqi * 0.6),
        no2: 24,
        so2: 12,
        co: 3,
        o3: 45,
        nh3: 4
      },
      derived_method: 'Fallback Mock Data',
      stations: []
    };
  }

  private generateMockForecast(city: string, profile: string): ForecastResponse {
    const current = this.pseudorandomAqi(city);
    const tomorrowAqi = current + (city.length % 2 === 0 ? 15 : -10);
    const dayAfterAqi = tomorrowAqi + (city.length % 3 === 0 ? 20 : -15);
    
    return {
      city: city,
      latest_reading_date: new Date().toISOString().split('T')[0],
      latest_reading_aqi: current,
      forecast_1d: {
        date: 'Tomorrow',
        value: tomorrowAqi,
        method: 'Fallback RF Mock',
        category: this.getAQICategory(tomorrowAqi),
        color: '#eab308',
        static_advisory: 'Take basic precautions.',
        advisory: '- Limit heavy outdoor exertion in high traffic zones.\n- Wear preventative masks if susceptible.',
        profile: profile
      },
      forecast_2d: {
        date: 'Day After',
        value: dayAfterAqi,
        method: 'Fallback RF Mock',
        category: this.getAQICategory(dayAfterAqi),
        color: '#eab308',
        static_advisory: 'Normal conditions.',
        advisory: '- Maintain standard health tracking.',
        profile: profile
      },
      explanation: 'Demo fallback active.',
      predicted_aqi: tomorrowAqi,
      forecast_date: 'Tomorrow',
      category: this.getAQICategory(tomorrowAqi),
      color: '#eab308',
      advisory: 'Stay safe.',
      profile: profile
    };
  }

  getAQICategory(aqi: number | null): string {
    if (aqi === null) return 'Unavailable';
    if (aqi <= 50) return 'Good';
    if (aqi <= 100) return 'Satisfactory';
    if (aqi <= 200) return 'Moderate';
    if (aqi <= 300) return 'Poor';
    if (aqi <= 400) return 'Very Poor';
    return 'Severe';
  }

  getAQIClass(aqi: number | null): string {
    if (aqi === null) return 'aqi-unavailable';
    if (aqi <= 50) return 'aqi-good';
    if (aqi <= 100) return 'aqi-satisfactory';
    if (aqi <= 200) return 'aqi-moderate';
    if (aqi <= 300) return 'aqi-poor';
    if (aqi <= 400) return 'aqi-very-poor';
    return 'aqi-severe';
  }

  getAdvisoryBullets(text: string): string[] {
    if (!text) return [];
    return text.toString()
      .split('\n')
      .map(b => b.trim())
      .filter(b => b.length > 0)
      .map(b => {
        // Strip out existing dashes, stars or leading bullets
        return b.replace(/^[-*\u2022\s]+/g, '');
      })
      .filter(b => b.length > 0);
  }

  // Phase 2A Dashboard Hero Helper Methods
  aqiScaleBands = [
    { name: 'Good', min: 0, max: 50, key: 'good' },
    { name: 'Satisfactory', min: 51, max: 100, key: 'satisfactory' },
    { name: 'Moderate', min: 101, max: 200, key: 'moderate' },
    { name: 'Poor', min: 201, max: 300, key: 'poor' },
    { name: 'Very Poor', min: 301, max: 400, key: 'very-poor' },
    { name: 'Severe', min: 401, max: 999, key: 'severe' }
  ];

  getCurrentAQI(): number | null {
    return this.liveVM()?.aqi ?? this.forecastVM()?.latestReadingAqi ?? null;
  }

  getCurrentStatus(): import('../../services/aqi-view-models').DataStatus {
    const live = this.liveVM();
    if (live?.aqi !== null && live?.aqi !== undefined) return live.dataStatus;
    const forecast = this.forecastVM();
    if (forecast?.latestReadingAqi !== null && forecast?.latestReadingAqi !== undefined) return forecast.dataStatus;
    if (this.demoMode()) return 'demo';
    if (this.liveStatus() === 'loading' || this.forecastStatus() === 'loading') return 'loading';
    return 'unavailable';
  }

  getCurrentDate(): string | null {
    const live = this.liveVM();
    if (live?.aqi !== null && live?.aqi !== undefined) return live.updatedTime;
    const forecast = this.forecastVM();
    if (forecast?.latestReadingAqi !== null && forecast?.latestReadingAqi !== undefined) return forecast.latestReadingDate;
    return null;
  }

  getAirPlanAqi(): number | null {
    return this.liveVM()?.aqi ?? this.forecastVM()?.latestReadingAqi ?? null;
  }

  getAirPlanBand(): string | null {
    const aqi = this.getAirPlanAqi();
    return aqi === null ? null : this.liveVM()?.category || this.getAQICategory(aqi);
  }

  getAssistantContext(): AssistantContext {
    const forecast = this.forecastVM();
    return {
      city: this.selectedCity(),
      currentAqi: this.getAirPlanAqi(),
      band: this.getAirPlanBand(),
      dataStatus: this.getCurrentStatus(),
      forecastStatus: this.forecastStatus(),
      pollutants: this.liveVM()?.pollutants || null,
      tomorrow: forecast?.day1 ? {
        value: forecast.day1.value,
        date: forecast.day1.date,
        advisory: forecast.day1.advisory
      } : null,
      dayAfter: forecast?.day2 ? { value: forecast.day2.value, date: forecast.day2.date } : null,
      savedProfile: this.savedProfile()
    };
  }

  getTrendInfo(): { arrow: string; text: string; isWorse: boolean; tomorrowAqi: number | null; dayAfterAqi: number | null } {
    const current = this.getCurrentAQI();
    const tomorrowAqi = this.forecastVM()?.day1?.value ?? null;
    const dayAfterAqi = this.forecastVM()?.day2?.value ?? null;
    if (current === null || tomorrowAqi === null) {
      return { arrow: '—', text: 'Forecast unavailable', isWorse: false, tomorrowAqi, dayAfterAqi };
    }
    const diff = Math.abs(tomorrowAqi - current);

    if (tomorrowAqi > current) {
      return { arrow: '↑', text: `+${diff} Worsening`, isWorse: true, tomorrowAqi, dayAfterAqi };
    } else if (tomorrowAqi < current) {
      return { arrow: '↓', text: `-${diff} Improving`, isWorse: false, tomorrowAqi, dayAfterAqi };
    } else {
      return { arrow: '→', text: `Steady`, isWorse: false, tomorrowAqi, dayAfterAqi };
    }
  }

  getAtmosphericClass(aqi: number | null): string {
    if (aqi === null) return 'atmo-unavailable';
    if (aqi <= 100) return 'atmo-good';
    if (aqi <= 200) return 'atmo-moderate';
    return 'atmo-severe';
  }

  isCategoryActive(band: { min: number; max: number }, currentAqi: number | null): boolean {
    return currentAqi !== null && currentAqi >= band.min && currentAqi <= band.max;
  }

  chartY(aqi: number): number {
    return Math.max(20, Math.min(90, 90 - (Math.max(0, Math.min(500, aqi)) / 500) * 70));
  }

  // Phase 2B Helpers
  getPollutants(): Array<{ name: string; key: string; value: number | null; unit: string; max: number; isDominant: boolean }> {
    const specs = [
      { name: 'PM2.5', key: 'pm25', unit: 'µg/m³', max: 250 },
      { name: 'PM10', key: 'pm10', unit: 'µg/m³', max: 400 },
      { name: 'NO2', key: 'no2', unit: 'ppb', max: 200 },
      { name: 'SO2', key: 'so2', unit: 'ppb', max: 100 },
      { name: 'CO', key: 'co', unit: 'ppm', max: 10 },
      { name: 'O3', key: 'o3', unit: 'ppb', max: 150 }
    ];
    const values = this.liveVM()?.pollutants;
    if (!values || !Object.values(values).some(value => value !== null)) return [];
    const available = specs.filter(item => values[item.key] !== null && values[item.key] !== undefined);
    const dominant = available.sort((a, b) => (values[b.key]! / b.max) - (values[a.key]! / a.max))[0]?.key;
    return specs.map(item => ({
      ...item,
      value: values[item.key] === null || values[item.key] === undefined ? null : Math.round(values[item.key]!),
      isDominant: item.key === dominant
    }));
  }

  hasPollutants(): boolean {
    const p = this.liveVM()?.pollutants;
    return !!p && Object.values(p).some(value => value !== null && value !== undefined);
  }

  getRankedCities(): Array<{ name: string; aqi: number; trend: string; category: string; colorClass: string; status: import('../../services/aqi-view-models').DataStatus }> {
    const aqi = this.getCurrentAQI();
    if (aqi === null) return [];
    return [{ name: this.selectedCity(), aqi, trend: this.getTrendInfo().arrow,
      category: this.getAQICategory(aqi), colorClass: this.getAQIClass(aqi), status: this.getCurrentStatus() }];
  }

  getActiveStations(): StationDetails[] {
    return (this.liveVM()?.stations || []).slice(0, 5);
  }
}

