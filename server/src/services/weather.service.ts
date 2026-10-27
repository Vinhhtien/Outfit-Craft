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

const CITY_ALIASES: Record<string, string> = {
  'hồ chí minh': 'Ho Chi Minh',
  'ho chi minh': 'Ho Chi Minh',
  'thành phố hồ chí minh': 'Ho Chi Minh',
  'tp.hcm': 'Ho Chi Minh',
  'tp hcm': 'Ho Chi Minh',
  'tphcm': 'Ho Chi Minh',
  'sài gòn': 'Ho Chi Minh',
  'saigon': 'Ho Chi Minh',
  'hà nội': 'Hanoi',
  'ha noi': 'Hanoi',
  'hanoi': 'Hanoi',
  'đà nẵng': 'Da Nang',
  'da nang': 'Da Nang',
  'hải phòng': 'Hải Phòng',
  'hai phong': 'Hải Phòng',
  'cần thơ': 'Can Tho',
  'can tho': 'Can Tho',
  'huế': 'Hue',
  'hue': 'Hue',
  'nha trang': 'Nha Trang',
  'vũng tàu': 'Vung Tau',
  'vung tau': 'Vung Tau',
  'đà lạt': 'Da Lat',
  'da lat': 'Da Lat',
  'quy nhơn': 'Quy Nhon',
  'buôn ma thuột': 'Buon Ma Thuot',
};

function removeDiacritics(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
}

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

async function fetchFromOpenWeather(query: string, apiKey: string) {
  const url = `${BASE}?q=${encodeURIComponent(query)}&units=metric&lang=vi&appid=${apiKey}`;
  return fetch(url, { signal: AbortSignal.timeout(10000) });
}

export async function getWeather(city: string): Promise<WeatherInfo> {
  const apiKey = env.openWeatherKey || process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    console.warn('[weather] Chưa cấu hình OPENWEATHER_API_KEY trong .env, dùng dữ liệu mặc định.');
    return getFallbackWeather(city);
  }

  const rawCity = city?.trim() || 'Hà Nội';
  const lower = rawCity.toLowerCase();
  const primaryQuery = CITY_ALIASES[lower] || rawCity;

  try {
    let res = await fetchFromOpenWeather(primaryQuery, apiKey);

    // Thu khong dau neu tra ve 404
    if (res.status === 404) {
      const stripped = removeDiacritics(rawCity);
      if (stripped !== primaryQuery) {
        res = await fetchFromOpenWeather(stripped, apiKey);
      }
    }

    // Thu them ma quoc gia ,VN neu van 404
    if (res.status === 404) {
      res = await fetchFromOpenWeather(`${primaryQuery},VN`, apiKey);
    }

    if (!res.ok) {
      console.warn(`[weather] OpenWeather trả về lỗi ${res.status} với "${rawCity}", chuyển sang dữ liệu mặc định.`);
      return getFallbackWeather(rawCity);
    }

    const data = (await res.json()) as {
      name: string;
      main: { temp: number; feels_like: number; humidity: number };
      weather: { main: string; description: string; icon: string }[];
    };

    const w = data.weather[0] || { main: 'Clear', description: 'Trời quang', icon: '01d' };
    const result: WeatherInfo = {
      city: data.name || rawCity,
      temp: Math.round(data.main.temp),
      feelsLike: Math.round(data.main.feels_like),
      humidity: data.main.humidity,
      condition: w.main,
      description: w.description,
      icon: w.icon,
      isRaining: ['Rain', 'Drizzle', 'Thunderstorm'].includes(w.main),
    };

    console.log(`[weather] Đã lấy thời tiết thật cho "${rawCity}" (${result.city}): ${result.temp}°C, ${result.description}`);
    return result;
  } catch (err) {
    console.warn('[weather] Không thể kết nối OpenWeather, dùng dữ liệu mặc định:', err);
    return getFallbackWeather(rawCity);
  }
}
