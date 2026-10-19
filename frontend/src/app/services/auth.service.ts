import { Injectable, inject, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';


@Injectable({ providedIn: 'root' })
export class AuthService {
  private platformId = inject(PLATFORM_ID);
  private http = inject(HttpClient);
   private readonly registerUrl = 'http://127.0.0.1:8000/api/register/';
   private readonly loginUrl = 'http://127.0.0.1:8000/api/login/';       // <-- Add this
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

  login(username: string, password: string): Observable<any> {
    return this.http.post<any>(this.loginUrl, { username, password }).pipe(
      tap((res) => {
        this.setSession(res.username || username);
      })
    );
  }


    register(username: string, email: string, password: string): Observable<any> {
    return this.http.post<any>(this.registerUrl, { username, email, password }).pipe(
      tap((res) => {
        this.setSession(res.username || username);
      })
    );
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
