export type ForecastApiHealth = {
  status: 'ready' | 'unavailable';
  modelId: string;
  modelStatus: string;
  promotionDecision: string;
  tensorflowVersion: string;
  unit: 'ton';
  lookbackMonths: number;
  error?: string | null;
};

export type ForecastApiResult = {
  modelId: string;
  modelStatus: string;
  unit: 'ton';
  historyCount: number;
  horizonMonths: number;
  predictionsTons: number[];
  productionApproved: boolean;
};

const baseUrl = () => (process.env.EXPO_PUBLIC_FORECAST_API_URL || '').trim().replace(/\/$/, '');

export function isForecastApiConfigured() {
  return baseUrl().length > 0;
}

export async function getForecastApiHealth(): Promise<ForecastApiHealth> {
  const url = baseUrl();
  if (!url) throw new Error('EXPO_PUBLIC_FORECAST_API_URL is not configured.');
  const response = await fetch(`${url}/health`);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'Forecast API is unavailable.');
  return payload as ForecastApiHealth;
}

export async function requestTensorFlowForecast(historyTons: number[], horizonMonths = 3): Promise<ForecastApiResult> {
  const url = baseUrl();
  if (!url) throw new Error('EXPO_PUBLIC_FORECAST_API_URL is not configured.');
  const response = await fetch(`${url}/forecast`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ historyTons, horizonMonths }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'TensorFlow inference failed.');
  return payload as ForecastApiResult;
}
