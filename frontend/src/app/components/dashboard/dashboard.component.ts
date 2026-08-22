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

  // Map variables
  private map: any;
  private markers: { [key: string]: any } = {};

  // Form Signals
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


  // Selector Lists
  cities = ['Delhi', 'Mumbai', 'Bengaluru', 'Chennai', 'Hyderabad', 'Ahmedabad', 'Kolkata'];
  profiles = ['General Public', 'Asthma', 'Elderly', 'Outdoor Worker'];

  // Coordinates of the 7 pilot cities
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
    if (isPlatformBrowser(this.platformId)) {
      this.initMap();
    }
  }

  private async initMap() {
    try {
      const L = await import('leaflet');
      
      // Initialize map centered on India with zoom level 5
      this.map = L.map('aqi-leaflet-map', {
        center: [20.5937, 78.9629],
        zoom: 4,
        zoomControl: true,
        scrollWheelZoom: false
      });

      // Fetch open street map tiles (Requires no API token keys)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      }).addTo(this.map);

      // Create pilot city markers
      Object.keys(this.cityCoords).forEach((city) => {
        const coords = this.cityCoords[city];

        // Unique clinical indicator marker pin for map representation
        const clinicalIcon = L.divIcon({
          className: 'clinical-marker-element',
          html: `<div class="clinical-pulse-dot" id="dot-${city.toLowerCase()}"></div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        });

        const marker = L.marker(coords, { icon: clinicalIcon })
          .addTo(this.map)
          .bindTooltip(`<b>${city}</b>`, { permanent: false, direction: 'top' });

        marker.on('click', () => {
          this.onCityChange(city);
        });

        this.markers[city] = marker;
      });

      // Load initial forecast
      this.fetchForecast();
    } catch (err) {
      console.error('Failed loading Leaflet mapping dependencies:', err);
    }
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

  private focusCityMap(city: string) {
    if (this.map && this.cityCoords[city]) {
      this.map.setView(this.cityCoords[city], 5, { animate: true });
      
      // Stylize active vs inactive DOM items
      Object.keys(this.markers).forEach((name) => {
        const dot = document.getElementById(`dot-${name.toLowerCase()}`);
        if (dot) {
          if (name === city) {
            dot.classList.add('active-pulse');
          } else {
            dot.classList.remove('active-pulse');
          }
        }
      });
    }
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

    // Immediately clear markers and live details before beginning new request
    if (this.map) {
      this.stationMarkers.forEach(m => this.map.removeLayer(m));
      this.stationMarkers = [];
    }
    this.liveAqiData.set(null);

    // 1. Fetch live telemetry data from CPCB data.gov.in (Delhi only, fallback databases for others)
    this.liveSub = this.aqiService.getLiveAqi(city).subscribe({
      next: (liveRes) => {
        this.liveAqiData.set(liveRes);
        this.plotStationMarkers(liveRes);
      },
      error: (err) => {
        console.warn("Failed fetching live telemetry, relying on forecast load fallback:", err);
        // Clear station data on telemetry error
        this.liveAqiData.set(null);
        if (this.map) {
          this.stationMarkers.forEach(m => this.map.removeLayer(m));
          this.stationMarkers = [];
        }
      }
    });

    // 2. Fetch ML modeling forecasts
    this.forecastSub = this.aqiService.getForecast(city, this.selectedProfile()).subscribe({
      next: (response) => {
        this.forecastData.set(response);
        this.isLoading.set(false);
        // Highlight corresponding map marker once fetched
        setTimeout(() => this.focusCityMap(city), 50);
      },
      error: (err) => {
        this.errorMessage.set(err.message || 'Error occurred connecting to forecasting server.');
        this.forecastData.set(null);
        this.isLoading.set(false);
      }
    });
  }

  private async plotStationMarkers(liveData: LiveAqiResponse) {
    if (!this.map) return;
    try {
      const L = await import('leaflet');
      
      // Clear old dynamic station markers inside map layers
      this.stationMarkers.forEach(m => this.map.removeLayer(m));
      this.stationMarkers = [];

      if (!liveData.stations || liveData.stations.length === 0) return;

      liveData.stations.forEach(st => {
        try {
          if (st.latitude === null || st.latitude === undefined ||
              st.longitude === null || st.longitude === undefined) {
            return;
          }

          const lat = Number(st.latitude);
          const lng = Number(st.longitude);

          if (isNaN(lat) || isNaN(lng)) {
            return;
          }

          // Valid Leaflet geographic limits: lat [-90, 90], lng [-180, 180]
          if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            return;
          }

          const aqiVal = st.aqi !== null ? st.aqi : "NA";
          
          // Choose pin colors based on station AQI values matching CPCB bands
          let pinColor = '#9e9e9e'; // Gray fallback
          if (st.aqi !== null) {
            if (st.aqi <= 50) pinColor = '#2e7d32'; // Good - dark green
            else if (st.aqi <= 100) pinColor = '#558b2f'; // Satisfactory - light green
            else if (st.aqi <= 200) pinColor = '#f9a825'; // Moderate - yellow/amber
            else if (st.aqi <= 300) pinColor = '#ef6c00'; // Poor - orange
            else if (st.aqi <= 400) pinColor = '#c62828'; // Very Poor - red
            else pinColor = '#6a1b9a'; // Severe - purple
          }

          const stationIcon = L.divIcon({
            className: 'cpcb-station-marker',
            html: `<div style="background-color: ${pinColor}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7]
          });

          const m = L.marker([lat, lng], { icon: stationIcon })
            .addTo(this.map)
            .bindPopup(`
              <div style="font-family: 'Inter', sans-serif; font-size: 13px; line-height: 1.4; padding: 5px;">
                <h5 style="margin: 0 0 5px 0; color: #333; font-weight: 600; font-size: 14px;">${st.name}</h5>
                <div style="margin-bottom: 5px;"><b>Station AQI:</b> <span style="color: ${pinColor}; font-weight: bold;">${aqiVal}</span></div>
                <div style="font-size: 11px; color: #666;">
                  PM2.5: ${st.pollutants?.pm25 !== undefined && st.pollutants?.pm25 !== null ? st.pollutants.pm25 : 'NA'} | PM10: ${st.pollutants?.pm10 !== undefined && st.pollutants?.pm10 !== null ? st.pollutants.pm10 : 'NA'}<br/>
                  NO2: ${st.pollutants?.no2 !== undefined && st.pollutants?.no2 !== null ? st.pollutants.no2 : 'NA'} | SO2: ${st.pollutants?.so2 !== undefined && st.pollutants?.so2 !== null ? st.pollutants.so2 : 'NA'}<br/>
                  CO: ${st.pollutants?.co !== undefined && st.pollutants?.co !== null ? st.pollutants.co : 'NA'} | O3: ${st.pollutants?.o3 !== undefined && st.pollutants?.o3 !== null ? st.pollutants.o3 : 'NA'}<br/>
                  NH3: ${st.pollutants?.nh3 !== undefined && st.pollutants?.nh3 !== null ? st.pollutants.nh3 : 'NA'}
                </div>
              </div>
            `);
            
          this.stationMarkers.push(m);
        } catch (innerErr) {
          console.error('Error plotting individual station marker:', innerErr, st);
        }
      });
    } catch (err) {
      console.error('Failed drawing station markers:', err);
    }
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
}
