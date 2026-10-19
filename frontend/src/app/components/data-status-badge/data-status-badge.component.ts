import { Component, Input } from '@angular/core';
import { DataStatus } from '../../services/aqi-view-models';

@Component({
  selector: 'app-data-status-badge', standalone: true,
  template: `<span class="data-status" [class.live]="status === 'live'" [class.demo]="status === 'demo'" [class.unavailable]="status === 'unavailable'">{{ label }}</span>`,
  styles: [`.data-status{display:inline-block;border-radius:999px;padding:.25rem .6rem;font-size:.72rem;font-weight:800;letter-spacing:.04em;background:#e2e8f0;color:#334155}.data-status.live{background:#dcfce7;color:#14532d}.data-status.demo{background:#fef3c7;color:#78350f}.data-status.unavailable{background:#f1f5f9;color:#475569}`]
})
export class DataStatusBadgeComponent {
  @Input({ required: true }) status: DataStatus = 'unavailable';
  get label(): string {
    switch (this.status) {
      case 'live': return 'LIVE';
      case 'stored': return 'LAST STORED READING';
      case 'backend': return 'BACKEND DATA';
      case 'demo': return 'DEMO DATA';
      case 'loading': return 'LOADING';
      default: return 'UNAVAILABLE';
    }
  }
}
