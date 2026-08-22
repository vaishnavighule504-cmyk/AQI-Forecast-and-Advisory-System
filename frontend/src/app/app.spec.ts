import '@angular/compiler';
import { App } from './app';
import { describe, it, expect } from 'vitest';

describe('App', () => {
  it('should create the app', () => {
    const app = new App();
    expect(app).toBeTruthy();
  });

  it('should have the title signal equal to "frontend"', () => {
    const app = new App();
    expect(app.title()).toEqual('frontend');
  });
});
