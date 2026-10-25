// Location and Live Weather Service for Sara AI

export interface WeatherInfo {
  temp: number;
  condition: string;
  windSpeed?: number;
  humidity?: number;
}

export interface UserLocationData {
  city: string;
  region: string;
  country: string;
  latitude: number;
  longitude: number;
  weather?: WeatherInfo;
}

const DEFAULT_LOCATION: UserLocationData = {
  city: 'Kalyan',
  region: 'Maharashtra',
  country: 'India',
  latitude: 19.2437,
  longitude: 73.1355,
  weather: {
    temp: 31,
    condition: 'Dhoop / Clear Sky',
    windSpeed: 8,
  },
};

const STORAGE_KEY = 'sara_user_location';

export function getCachedLocation(): UserLocationData {
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {}
  return DEFAULT_LOCATION;
}

export function saveCachedLocation(loc: UserLocationData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
  } catch (e) {}
}

// Convert Open-Meteo weather code to human-friendly Hindi/English text
function getWeatherDescription(code: number): string {
  switch (code) {
    case 0:
      return 'साफ़ धूप (Clear Sky)';
    case 1:
    case 2:
    case 3:
      return 'हल्के बादल (Partly Cloudy)';
    case 45:
    case 48:
      return 'कोहरा (Foggy)';
    case 51:
    case 53:
    case 55:
      return 'हल्की फुहार (Drizzle)';
    case 61:
    case 63:
    case 65:
      return 'बारिश (Rain)';
    case 80:
    case 81:
    case 82:
      return 'तेज़ बारिश की संभावना (Rain Showers)';
    case 95:
      return 'गरज के साथ बारिश (Thunderstorm)';
    default:
      return 'सुहावना मौसम (Pleasant Weather)';
  }
}

// Fetch live weather from free Open-Meteo API (No API key needed)
export async function fetchLiveWeather(lat: number, lon: number): Promise<WeatherInfo | null> {
  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`
    );
    if (!response.ok) return null;
    const data = await response.json();
    if (data.current_weather) {
      const temp = Math.round(data.current_weather.temperature);
      const condition = getWeatherDescription(data.current_weather.weathercode);
      return {
        temp,
        condition,
        windSpeed: data.current_weather.windspeed,
      };
    }
  } catch (err) {
    console.warn('Weather fetch notice:', err);
  }
  return null;
}

// Detect user's current city via browser Geolocation + reverse geocoding
export async function detectCurrentLocation(): Promise<UserLocationData> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(getCachedLocation());
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;

        let city = 'Kalyan';
        let region = 'Maharashtra';
        let country = 'India';

        try {
          // Free client-side reverse geocoding via OpenStreetMap BigDataCloud / Nominatim
          const geoRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`,
            { headers: { 'Accept-Language': 'hi,en' } }
          );
          if (geoRes.ok) {
            const geoData = await geoRes.json();
            const addr = geoData.address || {};
            city =
              addr.city ||
              addr.town ||
              addr.suburb ||
              addr.municipality ||
              addr.county ||
              addr.state_district ||
              'Kalyan';
            region = addr.state || 'Maharashtra';
            country = addr.country || 'India';
          }
        } catch (e) {
          console.warn('Reverse geocode notice:', e);
        }

        const weather = await fetchLiveWeather(lat, lon);

        const result: UserLocationData = {
          city,
          region,
          country,
          latitude: lat,
          longitude: lon,
          weather: weather || {
            temp: 31,
            condition: 'साफ़ धूप (Clear Sky)',
          },
        };

        saveCachedLocation(result);
        resolve(result);
      },
      (err) => {
        console.warn('Geolocation permission not granted or timeout:', err.message);
        resolve(getCachedLocation());
      },
      { timeout: 7000, maximumAge: 300000, enableHighAccuracy: false }
    );
  });
}
