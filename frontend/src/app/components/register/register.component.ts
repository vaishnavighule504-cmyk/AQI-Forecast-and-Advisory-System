import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ProfileService } from '../../services/profile.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css'
})
export class RegisterComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  private profileService = inject(ProfileService);

  username = signal<string>('');
  email = signal<string>('');
  password = signal<string>('');
  errorMessage = signal<string | null>(null);

  onRegister() {
    const success = this.authService.register(this.username(), this.email(), this.password());
    if (success) {
      this.router.navigate([this.profileService.hasProfile() ? '/app/dashboard' : '/onboarding']);
    } else {
      this.errorMessage.set('Registration failed. Please try again.');
    }
  }
}
