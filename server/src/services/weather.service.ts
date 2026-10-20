import { env } from '../config/env.js';

export interface WeatherInfo {
  city: string;
  temp: number; // nhiet do hien tai (C)
  feelsLike: number;
  humidity: number;
  /** Rain, Clouds, Clear... */
  condition: string;
  description: string;
  icon: string;
  isRaining: boolean;
}

const BASE = 'https://api.openweathermap.org/data/2.5/weather';

function getFallbackWeather(city: string): WeatherInfo {
  const normalizedCity = city?.trim() || 'Hà Nội';
  return {
    city: normalizedCity,
    temp: 26,
    feelsLike: 27,
    humidity: 65,
    condition: 'Clouds',
    description: 'Trời nhiều mây, thời tiết mát mẻ',
    icon: '03d',
    isRaining: false,
  };
}

export async function getWeather(city: string): Promise<WeatherInfo> {
  if (!env.openWeatherKey) {
    // Neu chua co OPENWEATHER_API_KEY thi dung fallback de he thong van chay binh thuong
    return getFallbackWeather(city);
  }

  try {
    const url = `${BASE}?q=${encodeURIComponent(city)}&units=metric&lang=vi&appid=${env.openWeatherKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });

    if (!res.ok) {
      console.warn(`[weather] OpenWeather loi ${res.status} voi thanh pho "${city}", dung du lieu mac dinh.`);
      return getFallbackWeather(city);
    }

    const data = (await res.json()) as {
      name: string;
      main: { temp: number; feels_like: number; humidity: number };
      weather: { main: string; description: string; icon: string }[];
    };

    const w = data.weather[0] || { main: 'Clear', description: 'Trời quang', icon: '01d' };
    return {
      city: data.name || city,
      temp: Math.round(data.main.temp),
      feelsLike: Math.round(data.main.feels_like),
      humidity: data.main.humidity,
      condition: w.main,
      description: w.description,
      icon: w.icon,
      isRaining: ['Rain', 'Drizzle', 'Thunderstorm'].includes(w.main),
    };
  } catch (err) {
    console.warn('[weather] Khong the ket noi OpenWeather, dung du lieu mac dinh:', err);
    return getFallbackWeather(city);
  }
}
