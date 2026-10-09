import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

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

  username = signal<string>('');
  email = signal<string>('');
  password = signal<string>('');
  errorMessage = signal<string | null>(null);

  onRegister() {
    if (!this.username().trim()) {
      this.username.set('DemoUser');
    }
    const success = this.authService.register(this.username(), this.email(), this.password());
    if (success) {
      this.router.navigate(['/app/dashboard']);
    } else {
      this.errorMessage.set('Registration failed. Please try again.');
    }
  }
}
