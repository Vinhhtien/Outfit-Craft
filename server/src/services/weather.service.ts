import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

export interface WeatherInfo {
  city: string;
  temp: number;        // nhiet do hien tai (C)
  feelsLike: number;
  humidity: number;
  /** Rain, Clouds, Clear... */
  condition: string;
  description: string;
  icon: string;
  isRaining: boolean;
}

const BASE = 'https://api.openweathermap.org/data/2.5/weather';

export async function getWeather(city: string): Promise<WeatherInfo> {
  if (!env.openWeatherKey) {
    throw new ApiError(503, 'Dịch vụ thời tiết chưa sẵn sàng. Vui lòng thử lại sau.');
  }

  const url = `${BASE}?q=${encodeURIComponent(city)}&units=metric&lang=vi&appid=${env.openWeatherKey}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) }).catch(() => { throw new ApiError(502, 'Không thể kết nối dịch vụ thời tiết. Vui lòng thử lại.'); });

  if (!res.ok) {
    if (res.status === 404) throw ApiError.notFound(`Khong tim thay thanh pho: ${city}`);
    throw ApiError.badRequest('Không lấy được dữ liệu thời tiết. Vui lòng thử lại.');
  }

  const data = await res.json() as {
    name: string;
    main: { temp: number; feels_like: number; humidity: number };
    weather: { main: string; description: string; icon: string }[];
  };

  const w = data.weather[0];
  return {
    city: data.name,
    temp: Math.round(data.main.temp),
    feelsLike: Math.round(data.main.feels_like),
    humidity: data.main.humidity,
    condition: w.main,
    description: w.description,
    icon: w.icon,
    isRaining: ['Rain', 'Drizzle', 'Thunderstorm'].includes(w.main),
  };
}
