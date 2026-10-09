import { Component, signal, inject, PLATFORM_ID, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AqiService, ForecastResponse, LiveAqiResponse, StationDetails } from '../../services/aqi.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements AfterViewInit, OnDestroy {
  private aqiService = inject(AqiService);
  private platformId = inject(PLATFORM_ID);

  // UI Signals
  selectedCity = signal<string>('Delhi');
  selectedProfile = signal<string>('General Public');

  // UI Signals
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  forecastData = signal<ForecastResponse | null>(null);
  liveAqiData = signal<LiveAqiResponse | null>(null);

  private stationMarkers: any[] = [];
  private forecastSub: any;
  private liveSub: any;


  cities = ['Delhi', 'Mumbai', 'Bengaluru', 'Chennai', 'Hyderabad', 'Ahmedabad', 'Kolkata'];
  profiles = ['General Public', 'Asthma', 'Elderly', 'Outdoor Worker'];

  // Map variables
  private map: any;
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

  // Chatbot State
  isChatOpen = signal<boolean>(false);
  chatMessages = signal<{role: string, text: string}[]>([]);
  chatInput = signal<string>('');

  ngAfterViewInit() {
    this.fetchForecast();
    if (isPlatformBrowser(this.platformId)) {
      this.initMap();
    }
  }

  private async initMap() {
    try {
      const L = await import('leaflet');
      
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

        let aqiVal = 0;
        let colorClass = 'aqi-moderate';
        const allCities = this.getRankedCities();
        const cityData = allCities.find(c => c.name === city);
        if (cityData) {
          aqiVal = cityData.aqi;
          colorClass = cityData.colorClass;
        }

        const icon = L.divIcon({
          className: 'custom-map-marker',
          html: `<div class="city-marker-badge ${colorClass}" id="marker-${city.toLowerCase()}">${aqiVal}</div>`,
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

  toggleChat() {
    this.isChatOpen.update(v => !v);
    if (this.isChatOpen() && this.chatMessages().length === 0) {
      this.chatMessages.set([
        { role: 'bot', text: 'Hi! I am the SaansCast Assistant. How can I help you regarding air quality today?' }
      ]);
    }
  }

  sendChatMessage(message: string) {
    if (!message.trim()) return;
    
    // Add user message
    this.chatMessages.update(msgs => [...msgs, { role: 'user', text: message }]);
    
    const contextCity = this.selectedCity();
    const contextAqi = this.getCurrentAQI();
    
    setTimeout(() => {
      let reply = "I'm not sure about that.";
      const lower = message.toLowerCase();
      if (lower.includes('aqi') || lower.includes('today')) {
        reply = `Today's AQI in ${contextCity} is ${contextAqi}.`;
      } else if (lower.includes('improve') || lower.includes('tomorrow')) {
        const trend = this.getTrendInfo();
        reply = trend.isWorse ? `Unfortunately, it is worsening. The forecasted AQI is ${trend.tomorrowAqi}.` : `Yes! The forecast looks better at ${trend.tomorrowAqi} AQI.`;
      } else if (lower.includes('pollutant') || lower.includes('dominant')) {
         const p = this.getPollutants().find(x => x.isDominant);
         reply = `The dominant pollutant currently is ${p?.name || 'PM2.5'}.`;
      } else if (lower.includes('do today') || lower.includes('should i do')) {
         reply = `Given the ${this.getAQICategory(contextAqi)} air, we suggest taking precautions. Check the Clinical Advisory tab!`;
      } else {
         reply = "Currently, I can answer basic questions about today's AQI, forecasts, distinct pollutants, and health advisory tips based on our data.";
      }
      
      this.chatMessages.update(msgs => [...msgs, { role: 'bot', text: reply }]);
    }, 600);
  }

  onCityChange(city: string) {
    this.selectedCity.set(city);
    this.fetchForecast();
    this.focusCityMap(city);
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

    const city = this.selectedCity();

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
        this.liveAqiData.set(liveRes);
      },
      error: (err) => {
        console.warn("Failed fetching live telemetry, relying on local mock fallback.");
        this.liveAqiData.set(this.generateMockLiveAqi(city));
      }
    });

    // 2. Fetch ML modeling forecasts
    this.forecastSub = this.aqiService.getForecast(city, this.selectedProfile()).subscribe({
      next: (response) => {
        this.forecastData.set(response);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.warn("Forecasting API unavailable. Initializing mock fallback.");
        this.forecastData.set(this.generateMockForecast(city, this.selectedProfile()));
        this.isLoading.set(false);
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
      stations: [
        { name: 'City Center Monitor', latitude: 0, longitude: 0, aqi: aqi + 15, pollutants: {} },
        { name: 'Industrial Hub', latitude: 0, longitude: 0, aqi: Math.min(aqi + 42, 500), pollutants: {} },
        { name: 'Residential South', latitude: 0, longitude: 0, aqi: Math.max(aqi - 25, 0), pollutants: {} },
        { name: 'Highway Junction', latitude: 0, longitude: 0, aqi: Math.min(aqi + 60, 500), pollutants: {} }
      ]
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

  getAQICategory(aqi: number): string {
    if (aqi <= 50) return 'Good';
    if (aqi <= 100) return 'Satisfactory';
    if (aqi <= 200) return 'Moderate';
    if (aqi <= 300) return 'Poor';
    if (aqi <= 400) return 'Very Poor';
    return 'Severe';
  }

  getAQIClass(aqi: number): string {
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
  mockWeather = {
    temp: '28°C',
    humidity: '62%',
    wind: '12 km/h NW',
    uvIndex: '5 Moderate'
  };

  aqiScaleBands = [
    { name: 'Good', min: 0, max: 50, key: 'good' },
    { name: 'Satisfactory', min: 51, max: 100, key: 'satisfactory' },
    { name: 'Moderate', min: 101, max: 200, key: 'moderate' },
    { name: 'Poor', min: 201, max: 300, key: 'poor' },
    { name: 'Very Poor', min: 301, max: 400, key: 'very-poor' },
    { name: 'Severe', min: 401, max: 999, key: 'severe' }
  ];

  getCurrentAQI(): number {
    const live = this.liveAqiData();
    if (live && live.aqi !== null && live.aqi !== undefined) {
      return live.aqi;
    }
    const fc = this.forecastData();
    if (fc && fc.latest_reading_aqi !== null && fc.latest_reading_aqi !== undefined) {
      return fc.latest_reading_aqi;
    }
    return 184; // Demo fallback AQI
  }

  getTrendInfo(): { arrow: string; text: string; isWorse: boolean; tomorrowAqi: number; dayAfterAqi: number } {
    const current = this.getCurrentAQI();
    const fc = this.forecastData();
    const tomorrowAqi = fc?.forecast_1d?.value ?? (current + 8);
    const dayAfterAqi = fc?.forecast_2d?.value ?? (current - 6);
    const diff = Math.abs(tomorrowAqi - current);

    if (tomorrowAqi > current) {
      return { arrow: '↑', text: `+${diff} Worsening`, isWorse: true, tomorrowAqi, dayAfterAqi };
    } else if (tomorrowAqi < current) {
      return { arrow: '↓', text: `-${diff} Improving`, isWorse: false, tomorrowAqi, dayAfterAqi };
    } else {
      return { arrow: '→', text: `Steady`, isWorse: false, tomorrowAqi, dayAfterAqi };
    }
  }

  getAtmosphericClass(aqi: number): string {
    if (aqi <= 100) return 'atmo-good';
    if (aqi <= 200) return 'atmo-moderate';
    return 'atmo-severe';
  }

  isCategoryActive(band: { min: number; max: number }, currentAqi: number): boolean {
    return currentAqi >= band.min && currentAqi <= band.max;
  }

  // Phase 2B Helpers
  getPollutants() {
    const defaultData = [
      { name: 'PM2.5', value: 85, unit: 'µg/m³', max: 250 },
      { name: 'PM10', value: 165, unit: 'µg/m³', max: 400 },
      { name: 'NO2', value: 42, unit: 'ppb', max: 200 },
      { name: 'SO2', value: 12, unit: 'ppb', max: 100 },
      { name: 'CO', value: 0.8, unit: 'ppm', max: 10 },
      { name: 'O3', value: 55, unit: 'ppb', max: 150 }
    ];

    const live = this.liveAqiData();
    if (live && live.pollutants && live.pollutants.pm25 !== null) {
      const p = live.pollutants;
      return [
        { name: 'PM2.5', value: Math.round(p.pm25 || 0), unit: 'µg/m³', max: 250 },
        { name: 'PM10', value: Math.round(p.pm10 || 0), unit: 'µg/m³', max: 400 },
        { name: 'NO2', value: Math.round(p.no2 || 0), unit: 'ppb', max: 200 },
        { name: 'SO2', value: Math.round(p.so2 || 0), unit: 'ppb', max: 100 },
        { name: 'CO', value: Math.round(p.co || 0), unit: 'ppm', max: 10 },
        { name: 'O3', value: Math.round(p.o3 || 0), unit: 'ppb', max: 150 }
      ].map(item => ({...item, isDominant: item.name === 'PM2.5'}));
    }
    
    // Find dominant in mock
    let dominantIndex = 0;
    let maxRatio = 0;
    defaultData.forEach((d, i) => {
      const ratio = d.value / d.max;
      if (ratio > maxRatio) {
        maxRatio = ratio;
        dominantIndex = i;
      }
    });

    return defaultData.map((d, i) => ({
      ...d,
      isDominant: i === dominantIndex
    }));
  }

  getRankedCities() {
    const mocks: Record<string, { aqi: number, trend: string }> = {
      'Delhi': { aqi: 245, trend: '↑' },
      'Mumbai': { aqi: 112, trend: '↓' },
      'Bengaluru': { aqi: 68, trend: '→' },
      'Chennai': { aqi: 74, trend: '→' },
      'Hyderabad': { aqi: 95, trend: '↓' },
      'Ahmedabad': { aqi: 158, trend: '↑' },
      'Kolkata': { aqi: 182, trend: '↑' }
    };
    
    // Inject current active city
    mocks[this.selectedCity()] = { aqi: this.getCurrentAQI(), trend: this.getTrendInfo().arrow };

    return this.cities.map(name => ({
      name,
      aqi: mocks[name].aqi,
      trend: mocks[name].trend,
      category: this.getAQICategory(mocks[name].aqi),
      colorClass: this.getAQIClass(mocks[name].aqi)
    })).sort((a, b) => b.aqi - a.aqi); // High to low
  }

  getActiveStations() {
    const live = this.liveAqiData();
    if (live && live.stations && live.stations.length > 0) {
      return live.stations
        .filter(s => s.aqi !== null)
        .map(s => ({ ...s, aqi: s.aqi as number }))
        .slice(0, 5);
    }
    return [
      { name: 'City Center Monitor', aqi: this.getCurrentAQI() + 15 },
      { name: 'Industrial Hub', aqi: this.getCurrentAQI() + 42 },
      { name: 'Residential South', aqi: Math.max(0, this.getCurrentAQI() - 25) },
      { name: 'Highway Junction', aqi: this.getCurrentAQI() + 60 }
    ];
  }
}

