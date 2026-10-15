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
    { name: 'Delhi', state: 'NCR' },
    { name: 'Mumbai', state: 'Maharashtra' },
    { name: 'Bengaluru', state: 'Karnataka' },
    { name: 'Chennai', state: 'Tamil Nadu' },
    { name: 'Hyderabad', state: 'Telangana' },
    { name: 'Ahmedabad', state: 'Gujarat' },
    { name: 'Kolkata', state: 'West Bengal' }
  ];

  features = [
    {
      icon: '📡',
      title: 'AQI Telemetry',
      description: 'Requests selected-city readings from the configured backend and reports when data is unavailable.'
    },
    {
      icon: '📈',
      title: '1–2 Day Forecast',
      description: 'Shows one-day and two-day values when the forecast endpoint returns them.'
    },
    {
      icon: '🗺️',
      title: 'Pilot-City Map',
      description: 'Browse the pilot cities; readings and station details appear only when returned by the backend.'
    },
    {
      icon: '🩺',
      title: 'Personalized Air Quality Guidance',
      description: 'Displays available forecast guidance for an optional profile. It is not professional medical advice.'
    }
  ];

  productSteps = [
    {
      step: '01',
      action: 'MONITOR',
      title: 'Request City Readings',
      desc: 'The frontend requests AQI, pollutant, and station fields from the configured live-data endpoint.'
    },
    {
      step: '02',
      action: 'PREDICT',
      title: 'Display Available Forecasts',
      desc: 'The dashboard shows forecast values returned by the configured forecast endpoint.'
    },
    {
      step: '03',
      action: 'UNDERSTAND',
      title: 'Browse Pilot Cities',
      desc: 'Select a supported pilot city and view only the readings and stations returned for it.'
    },
    {
      step: '04',
      action: 'ACT',
      title: 'Show Suggested Actions',
      desc: 'Available forecast advisories can inform general guidance; they do not diagnose or prescribe.'
    }
  ];
}
