import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { AlertsService } from '../../services/alerts.service';
import { ProfileService } from '../../services/profile.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet, FormsModule],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.css'
})
export class LayoutComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  private alertsService = inject(AlertsService);
  private profileService = inject(ProfileService);

  constructor() {
    const profile = this.profileService.load();
    this.alertsService.loadPreferences({ city: profile?.city || 'Delhi', threshold: profile?.alertThreshold || 150, forecastEnabled: true });
  }

  get unreadAlerts(): number { return this.alertsService.unreadCount(); }

  cities = ['Delhi', 'Mumbai', 'Bengaluru', 'Chennai', 'Hyderabad', 'Ahmedabad', 'Kolkata'];
  selectedCity = signal<string>('Delhi');

  isDarkMode = signal<boolean>(false);
  mobileMenuOpen = signal<boolean>(false);

  toggleTheme() {
    this.isDarkMode.update(val => !val);
  }

  toggleMobileMenu() {
    this.mobileMenuOpen.update(val => !val);
  }

  onCityChange(event: Event) {
    const val = (event.target as HTMLSelectElement).value;
    this.selectedCity.set(val);
  }

  onLogout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  onEditProfile() { this.router.navigate(['/onboarding']); }
}
