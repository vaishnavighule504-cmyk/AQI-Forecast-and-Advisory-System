import { Injectable, inject, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private platformId = inject(PLATFORM_ID);
  private readonly TOKEN_KEY = 'saanscast_auth_user';

  currentUser = signal<string | null>(null);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      const storedUser = localStorage.getItem(this.TOKEN_KEY);
      if (storedUser) {
        this.currentUser.set(storedUser);
      }
    }
  }

  isLoggedIn(): boolean {
    if (isPlatformBrowser(this.platformId)) {
      return !!localStorage.getItem(this.TOKEN_KEY) || !!this.currentUser();
    }
    return false;
  }

  login(username: string, password?: string): boolean {
    if (isPlatformBrowser(this.platformId)) {
      const user = username.trim() || 'DemoUser';
      localStorage.setItem(this.TOKEN_KEY, user);
      this.currentUser.set(user);
    }
    return true;
  }

  register(username: string, email?: string, password?: string): boolean {
    if (isPlatformBrowser(this.platformId)) {
      const user = username.trim() || 'DemoUser';
      localStorage.setItem(this.TOKEN_KEY, user);
      this.currentUser.set(user);
    }
    return true;
  }

  logout(): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem(this.TOKEN_KEY);
    }
    this.currentUser.set(null);
  }
}
