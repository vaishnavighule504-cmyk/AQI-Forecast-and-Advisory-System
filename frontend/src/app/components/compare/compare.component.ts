import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-compare',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="placeholder-container">
      <div class="placeholder-card">
        <div class="icon">⚖️</div>
        <h2>Multi-City AQI Compare</h2>
        <p class="subtitle">Side-by-side air quality index and pollutant analytics across pilot cities.</p>
        <div class="status-badge">Compare Module</div>
        <h2>Regional Analysis</h2>
        <p>Compare AQI, dominant pollutants, and model forecasts across multiple cities in real-time.</p>
      </div>
    </div>
  `,
  styles: [`
    .placeholder-container {
      padding: 3rem 1.5rem;
      display: flex;
      justify-content: center;
    }
    .placeholder-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 3rem 2rem;
      text-align: center;
      max-width: 500px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.03);
    }
    .icon { font-size: 3rem; margin-bottom: 1rem; }
    h2 { font-size: 1.5rem; color: #0f172a; margin: 0 0 0.5rem; font-weight: 800; }
    .subtitle { color: #64748b; font-size: 0.95rem; margin-bottom: 1.5rem; }
    .status-badge {
      display: inline-block;
      background-color: #ecfdf5;
      color: #059669;
      padding: 0.35rem 0.85rem;
      border-radius: 99px;
      font-size: 0.8rem;
      font-weight: 700;
    }
  `]
})
export class CompareComponent {}
