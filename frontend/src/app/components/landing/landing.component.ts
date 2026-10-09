import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css'
})
export class LandingComponent {
  cities = [
    { name: 'Delhi', state: 'NCR', sampleAqi: 245, status: 'Poor', colorClass: 'aqi-poor' },
    { name: 'Mumbai', state: 'Maharashtra', sampleAqi: 112, status: 'Moderate', colorClass: 'aqi-moderate' },
    { name: 'Bengaluru', state: 'Karnataka', sampleAqi: 68, status: 'Satisfactory', colorClass: 'aqi-satisfactory' },
    { name: 'Chennai', state: 'Tamil Nadu', sampleAqi: 74, status: 'Satisfactory', colorClass: 'aqi-satisfactory' },
    { name: 'Hyderabad', state: 'Telangana', sampleAqi: 95, status: 'Satisfactory', colorClass: 'aqi-satisfactory' },
    { name: 'Ahmedabad', state: 'Gujarat', sampleAqi: 158, status: 'Moderate', colorClass: 'aqi-moderate' },
    { name: 'Kolkata', state: 'West Bengal', sampleAqi: 182, status: 'Moderate', colorClass: 'aqi-moderate' }
  ];

  features = [
    {
      icon: '📡',
      title: 'Live AQI Telemetry',
      description: 'Real-time station monitoring from CPCB sub-index streams with derived city-level breakpoint calculation.'
    },
    {
      icon: '📈',
      title: '1–2 Day ML Forecast',
      description: 'Advanced Ridge and Random Forest predictive models delivering 24h & 48h forward-looking AQI trajectory.'
    },
    {
      icon: '🗺️',
      title: 'City/Hotspot Intelligence',
      description: 'Geographic spatial analysis across major metropolitan centers and localized station sensor networks.'
    },
    {
      icon: '🩺',
      title: 'Clinical Health Advisories',
      description: 'Vulnerability-tailored outpatient health guidance for Asthma patients, Elderly, Outdoor Workers, and General Public.'
    }
  ];

  productSteps = [
    {
      step: '01',
      action: 'MONITOR',
      title: 'Ingest Multi-Station Telemetry',
      desc: 'Aggregate PM2.5, PM10, NO2, and SO2 data directly from active CPCB sensors.'
    },
    {
      step: '02',
      action: 'PREDICT',
      title: 'ML Forecasting Engine',
      desc: 'Process historical trends and meteorology to output accurate 1-day and 2-day predictions.'
    },
    {
      step: '03',
      action: 'UNDERSTAND',
      title: 'Hotspot & Pattern Analytics',
      desc: 'Map spatial pollution distributions across metropolitan sectors and pilot cities.'
    },
    {
      step: '04',
      action: 'ACT',
      title: 'Targeted Health Prescriptions',
      desc: 'Deliver actionable, profile-specific medical advisories to minimize respiratory exposure.'
    }
  ];
}
