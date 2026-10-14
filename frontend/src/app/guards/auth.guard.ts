import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Safely check for localStorage so it doesn't crash server-side or during compilation
  const hasLocalStorageToken = typeof window !== 'undefined' && !!localStorage.getItem('token');

  // Check if user is authenticated via AuthService or localStorage
  if (authService.isLoggedIn() || hasLocalStorageToken) {
    return true;
  }

  // If not logged in, redirect them to the login page
  router.navigate(['/login']);
  return false;
};