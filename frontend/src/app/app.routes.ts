import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { LandingComponent } from './components/landing/landing.component';
import { LoginComponent } from './components/login/login.component';
import { RegisterComponent } from './components/register/register.component';
import { LayoutComponent } from './components/layout/layout.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { CompareComponent } from './components/compare/compare.component';
import { AlertsComponent } from './components/alerts/alerts.component';
import { ModelComponent } from './components/model/model.component';
import { OnboardingComponent } from './components/onboarding/onboarding.component';

export const routes: Routes = [
  { path: '', component: LandingComponent, pathMatch: 'full', title: 'SaansCast | Air Quality Forecasts' },
  { path: 'login', component: LoginComponent, title: 'Sign in | SaansCast' },
  { path: 'register', component: RegisterComponent, title: 'Register | SaansCast' },
  { path: 'onboarding', component: OnboardingComponent, canActivate: [authGuard], title: 'Edit profile | SaansCast' },
  {
    path: 'app',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: DashboardComponent, title: 'Dashboard | SaansCast' },
      { path: 'compare', component: CompareComponent, title: 'Compare cities | SaansCast' },
      { path: 'alerts', component: AlertsComponent, title: 'Alerts | SaansCast' },
      { path: 'model', component: ModelComponent, title: 'Forecast method | SaansCast' }
    ]
  },
  { path: '**', redirectTo: '' }
];
