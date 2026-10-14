import { Injectable, inject, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private platformId = inject(PLATFORM_ID);
  private readonly TOKEN_KEY = 'saanscast_auth_user';
  private readonly USERS_KEY = 'saanscast_registered_users_v2';

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

  login(identifier: string, password?: string): boolean {
    const query = identifier?.trim().toLowerCase() || '';
    const trimmedPass = password?.trim() || '';

    // 1. Check default evaluation credentials
    const validCredentials: Record<string, { pass: string, name: string }> = {
      'admin': { pass: 'admin123', name: 'Admin' },
      'faculty': { pass: 'eval2026', name: 'Faculty' },
      'demouser': { pass: 'password', name: 'DemoUser' },
      'demouser@saanscast.org': { pass: 'password', name: 'DemoUser' }
    };

    if (validCredentials[query] && validCredentials[query].pass === trimmedPass) {
      this.setSession(validCredentials[query].name);
      return true;
    }

    // 2. Check accounts created via Register page (matches by username OR email)
    if (isPlatformBrowser(this.platformId)) {
      const users = this.getStoredUsers();
      const matchedUser = users.find(u => 
        (u.username === query || u.email === query) && u.password === trimmedPass
      );

      if (matchedUser) {
        this.setSession(matchedUser.username);
        return true;
      }
    }

    return false;
  }

  register(usernameOrPayload: string | any, email?: string, password?: string): boolean {
    let username = '';
    let userEmail = '';
    let pass = '';

    // Handle both object payload or direct arguments from different component versions
    if (typeof usernameOrPayload === 'object' && usernameOrPayload !== null) {
      username = usernameOrPayload.username || '';
      userEmail = usernameOrPayload.email || '';
      pass = usernameOrPayload.password || '';
    } else {
      username = usernameOrPayload || '';
      userEmail = email || '';
      pass = password || '';
    }

    const trimmedUser = username.trim();
    const trimmedEmail = userEmail.trim().toLowerCase();
    const trimmedPass = pass.trim();

    if (!trimmedUser || !trimmedPass) {
      return false;
    }

    if (isPlatformBrowser(this.platformId)) {
      const users = this.getStoredUsers();
      
      // Remove existing entry if updating, then push new record
      const filtered = users.filter(u => u.username !== trimmedUser.toLowerCase() && u.email !== trimmedEmail);
      filtered.push({
        username: trimmedUser.toLowerCase(),
        email: trimmedEmail,
        password: trimmedPass,
        displayName: trimmedUser
      });

      localStorage.setItem(this.USERS_KEY, JSON.stringify(filtered));
      this.setSession(trimmedUser);
      return true;
    }
    return false;
  }

  private getStoredUsers(): Array<{username: string, email: string, password: string, displayName: string}> {
    try {
      const data = localStorage.getItem(this.USERS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  private setSession(username: string) {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(this.TOKEN_KEY, username);
      this.currentUser.set(username);
    }
  }

  logout(): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem(this.TOKEN_KEY);
    }
    this.currentUser.set(null);
  }
}