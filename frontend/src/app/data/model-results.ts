export type ForecastHorizon = '1-day' | '2-day';

export interface ModelResult {
  readonly city: string;
  readonly horizon: ForecastHorizon;
  readonly model: string;
  readonly mae: number;
  readonly rmse: number;
  readonly r2: number;
}

export const MODEL_RESULTS = {
  '1-day': [
    { city: 'Delhi', horizon: '1-day', model: 'Linear Regression', mae: 28.30, rmse: 36.95, r2: 0.83 },
    { city: 'Mumbai', horizon: '1-day', model: 'Linear Regression', mae: 13.85, rmse: 22.07, r2: 0.83 },
    { city: 'Kolkata', horizon: '1-day', model: 'Ridge (alpha = 1)', mae: 19.00, rmse: 29.20, r2: 0.86 },
    { city: 'Ahmedabad', horizon: '1-day', model: 'Persistence', mae: 44.64, rmse: 76.03, r2: 0.70 },
    { city: 'Bengaluru', horizon: '1-day', model: 'Persistence', mae: 7.78, rmse: 10.45, r2: 0.71 },
    { city: 'Chennai', horizon: '1-day', model: 'Persistence', mae: 10.86, rmse: 17.73, r2: 0.41 },
    { city: 'Hyderabad', horizon: '1-day', model: 'Persistence', mae: 9.09, rmse: 12.48, r2: 0.78 }
  ],
  '2-day': [
    { city: 'Delhi', horizon: '2-day', model: 'Ridge (alpha = 50)', mae: 38.14, rmse: 51.43, r2: 0.66 },
    { city: 'Mumbai', horizon: '2-day', model: 'Linear Regression', mae: 19.92, rmse: 29.71, r2: 0.69 },
    { city: 'Kolkata', horizon: '2-day', model: 'Ridge (alpha = 50)', mae: 24.48, rmse: 37.32, r2: 0.76 },
    { city: 'Ahmedabad', horizon: '2-day', model: 'Persistence', mae: 63.43, rmse: 104.81, r2: 0.44 },
    { city: 'Bengaluru', horizon: '2-day', model: 'Persistence', mae: 10.94, rmse: 14.63, r2: 0.44 },
    { city: 'Chennai', horizon: '2-day', model: 'Persistence', mae: 14.77, rmse: 25.83, r2: -0.24 },
    { city: 'Hyderabad', horizon: '2-day', model: 'Persistence', mae: 14.26, rmse: 19.15, r2: 0.47 }
  ]
} as const satisfies Record<ForecastHorizon, readonly ModelResult[]>;
