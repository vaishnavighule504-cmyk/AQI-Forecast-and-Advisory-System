import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

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

  username = signal<string>('');
  password = signal<string>('');
  errorMessage = signal<string | null>(null);

  onLogin() {
    if (!this.username().trim()) {
      this.username.set('DemoUser');
    }
    const success = this.authService.login(this.username(), this.password());
    if (success) {
      this.router.navigate(['/app/dashboard']);
    } else {
      this.errorMessage.set('Invalid credentials. Please try again.');
    }
  }
}
