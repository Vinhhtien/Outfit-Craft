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
    throw ApiError.badRequest('Chua cau hinh OPENWEATHER_API_KEY trong .env');
  }

  const url = `${BASE}?q=${encodeURIComponent(city)}&units=metric&lang=vi&appid=${env.openWeatherKey}`;
  const res = await fetch(url);

  if (!res.ok) {
    if (res.status === 404) throw ApiError.notFound(`Khong tim thay thanh pho: ${city}`);
    throw ApiError.badRequest('Khong lay duoc du lieu thoi tiet');
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
