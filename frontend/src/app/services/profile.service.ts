import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AuthService } from './auth.service';

export type Purpose = 'personal health' | 'family safety' | 'outdoor exercise' | 'commuting' | 'work or school' | 'general awareness';
export type Sensitivity = 'general' | 'asthma' | 'child' | 'elderly' | 'outdoor worker';

export interface UserProfile {
  city: string;
  purpose: Purpose;
  sensitivity: Sensitivity;
  outdoorTimes: Array<'morning' | 'afternoon' | 'evening'>;
  alertThreshold: 100 | 150 | 200 | 300;
}

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private platformId = inject(PLATFORM_ID);
  private authService = inject(AuthService);
  private readonly cities = ['Delhi', 'Mumbai', 'Bengaluru', 'Chennai', 'Hyderabad', 'Ahmedabad', 'Kolkata'];

  userIdentifier(): string {
    return this.authService.currentUser()?.trim() || 'guest';
  }

  private storageKey(): string { return `saanscast_profile_${encodeURIComponent(this.userIdentifier())}`; }

  load(): UserProfile | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    try {
      const raw = localStorage.getItem(this.storageKey());
      if (!raw) return null;
      const value = JSON.parse(raw) as UserProfile;
      if (!value || !this.cities.includes(value.city) || !Array.isArray(value.outdoorTimes)) return null;
      return value;
    } catch { return null; }
  }

  save(profile: UserProfile): boolean {
    if (!isPlatformBrowser(this.platformId)) return false;
    try {
      localStorage.setItem(this.storageKey(), JSON.stringify(profile));
      return true;
    } catch { return false; }
  }

  backendProfile(sensitivity: Sensitivity): string {
    switch (sensitivity) {
      case 'asthma': case 'child': return 'Asthma';
      case 'elderly': return 'Elderly';
      case 'outdoor worker': return 'Outdoor Worker';
      default: return 'General Public';
    }
  }

  hasProfile(): boolean { return this.load() !== null; }
}
