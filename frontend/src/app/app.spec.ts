import '@angular/compiler';
import { App } from './app';
import { describe, it, expect } from 'vitest';

describe('App', () => {
  it('should create the app', () => {
    const app = new App();
    expect(app).toBeTruthy();
  });

  it('should have the title signal equal to "SaansCast"', () => {
    const app = new App();
    const title = (app as unknown as { title: () => string }).title;
    expect(title()).toEqual('SaansCast');
  });
});
