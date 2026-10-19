import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AqiService } from './aqi.service';

describe('AqiService existing API routes', () => {
  let service: AqiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(AqiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('requests and returns a forecast response from the existing URL', () => {
    const payload = { city: 'Delhi', forecast_1d: { value: 120 } };
    let received: unknown;
    service.getForecast('Delhi', 'General Public').subscribe(value => received = value);
    const request = http.expectOne('http://127.0.0.1:8000/api/forecast/?city=Delhi&profile=General%20Public');
    expect(request.request.method).toBe('GET');
    request.flush(payload);
    expect(received).toEqual(payload);
  });

  it('passes through an empty live response without synthesizing readings', () => {
    let received: unknown;
    service.getLiveAqi('Delhi').subscribe(value => received = value);
    const request = http.expectOne('http://127.0.0.1:8000/api/live-aqi/?city=Delhi');
    expect(request.request.method).toBe('GET');
    request.flush({});
    expect(received).toEqual({});
  });

  it('surfaces request failures to the caller', () => {
    let failure: Error | undefined;
    service.getLiveAqi('Delhi').subscribe({ error: error => failure = error });
    const request = http.expectOne('http://127.0.0.1:8000/api/live-aqi/?city=Delhi');
    request.flush({ detail: 'unavailable' }, { status: 503, statusText: 'Service Unavailable' });
    expect(failure?.message).toContain('503');
  });

  it('surfaces forecast endpoint failures without a local fallback value', () => {
    let failure: Error | undefined;
    service.getForecast('Delhi', 'Asthma').subscribe({ error: error => failure = error });
    const request = http.expectOne('http://127.0.0.1:8000/api/forecast/?city=Delhi&profile=Asthma');
    request.flush({ error: 'unavailable' }, { status: 500, statusText: 'Server Error' });
    expect(failure?.message).toContain('500');
  });
});
