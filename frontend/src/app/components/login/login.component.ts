import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ProfileService } from '../../services/profile.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  private profileService = inject(ProfileService);

  username = signal<string>('');
  password = signal<string>('');
  errorMessage = signal<string | null>(null);

  onLogin() {
    const success = this.authService.login(this.username(), this.password());
    if (success) {
      this.router.navigate([this.profileService.hasProfile() ? '/app/dashboard' : '/onboarding']);
    } else {
      this.errorMessage.set('Invalid credentials. Please try again.');
    }
  }
}
