import { Injectable, inject, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private platformId = inject(PLATFORM_ID);
  private readonly SESSION_KEY = 'saanscast_auth_user';
  private readonly LEGACY_USERS_KEY = 'saanscast_registered_users_v2';
  // Demo-only credentials live for this page session; no password is persisted and no backend auth exists.
  private readonly sessionCredentials = new Map<string, string>();

  currentUser = signal<string | null>(null);

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      // Remove previously persisted plaintext demo passwords from older frontend builds.
      localStorage.removeItem(this.LEGACY_USERS_KEY);
      const storedUser = localStorage.getItem(this.SESSION_KEY);
      if (storedUser) this.currentUser.set(storedUser);
    } catch { /* Browser storage may be unavailable. */ }
  }

  isLoggedIn(): boolean {
    if (!isPlatformBrowser(this.platformId)) return false;
    try { return !!this.currentUser() || !!localStorage.getItem(this.SESSION_KEY); }
    catch { return !!this.currentUser(); }
  }

  login(identifier: string, password?: string): boolean {
    const query = identifier?.trim().toLowerCase() || '';
    if (!query || !password || this.sessionCredentials.get(query) !== password) return false;
    const displayName = this.sessionCredentials.get(`${query}:name`) || query;
    this.setSession(displayName);
    return true;
  }

  register(usernameOrPayload: string | any, email?: string, password?: string): boolean {
    if (!isPlatformBrowser(this.platformId)) return false;
    let username = '';
    let userEmail = '';
    let pass = '';
    if (typeof usernameOrPayload === 'object' && usernameOrPayload !== null) {
      username = usernameOrPayload.username || '';
      userEmail = usernameOrPayload.email || '';
      pass = usernameOrPayload.password || '';
    } else {
      username = usernameOrPayload || '';
      userEmail = email || '';
      pass = password || '';
    }

    const displayName = username.trim();
    const normalizedUsername = displayName.toLowerCase();
    const normalizedEmail = userEmail.trim().toLowerCase();
    if (!normalizedUsername || !pass) return false;

    // This retains the existing local demo navigation without persisting credentials or impersonating backend auth.
    for (const alias of [normalizedUsername, normalizedEmail].filter(Boolean)) {
      this.sessionCredentials.set(alias, pass);
      this.sessionCredentials.set(`${alias}:name`, displayName);
    }
    this.setSession(displayName);
    return true;
  }

  logout(): void {
    if (isPlatformBrowser(this.platformId)) {
      try { localStorage.removeItem(this.SESSION_KEY); } catch { /* Browser storage may be unavailable. */ }
    }
    this.currentUser.set(null);
  }

  private setSession(username: string): void {
    if (isPlatformBrowser(this.platformId)) {
      try { localStorage.setItem(this.SESSION_KEY, username); } catch { /* Keep this tab's demo session usable. */ }
    }
    this.currentUser.set(username);
  }
}
