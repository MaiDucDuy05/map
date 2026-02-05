import { LatLngBounds, LatLngBoundsExpression } from 'leaflet';
import { useState, useCallback } from 'react';

interface WeatherData {
  temperature: number;
  windSpeed: number;
  humidity: number;
  precipitation: number;
  weatherCode: number;
  time: string;
}

interface WeatherAreaData {
  avg: number;
  min: number;
  max: number;
  count: number;
  details?: WeatherData;
}

export function useWeatherData() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWeatherForPoint = useCallback(async (lat: number, lng: number): Promise<WeatherData | null> => {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m`;
      const res = await fetch(url);
      const data = await res.json();
      
      return {
        temperature: data.current.temperature_2m,
        windSpeed: data.current.wind_speed_10m,
        humidity: data.current.relative_humidity_2m,
        precipitation: data.current.precipitation,
        weatherCode: data.current.weather_code,
        time: data.current.time,
      };
    } catch (err) {
      console.error('Error fetching weather:', err);
      return null;
    }
  }, []);

   const fetchWeatherForArea = useCallback(async (boundsExpression: LatLngBoundsExpression): Promise<WeatherAreaData | null> => {
    setLoading(true);
    setError(null);

    try {
      let north: number, south: number, east: number, west: number;

      if (boundsExpression && typeof boundsExpression === 'object' && 'getNorth' in boundsExpression) {
        const bounds = boundsExpression as LatLngBounds;
        north = bounds.getNorth();
        south = bounds.getSouth();
        east = bounds.getEast();
        west = bounds.getWest();
      } 
      else if (Array.isArray(boundsExpression)) {
        if (boundsExpression.length === 2 && Array.isArray(boundsExpression[0]) && Array.isArray(boundsExpression[1])) {
          const [[lat1, lng1], [lat2, lng2]] = boundsExpression as [[number, number], [number, number]];
          north = Math.max(lat1, lat2);
          south = Math.min(lat1, lat2);
          east = Math.max(lng1, lng2);
          west = Math.min(lng1, lng2);
        } else {
          throw new Error('Invalid array bounds format');
        }
      } 

      else if (boundsExpression && typeof boundsExpression === 'object') {
        const obj = boundsExpression as any;
        
        if ('north' in obj && 'south' in obj && 'east' in obj && 'west' in obj) {
          ({ north, south, east, west } = obj);
        }
        else if ('_southWest' in obj && '_northEast' in obj) {
          south = obj._southWest.lat;
          west = obj._southWest.lng;
          north = obj._northEast.lat;
          east = obj._northEast.lng;
        } else {
          throw new Error('Unrecognized bounds object format');
        }
      } else {
        throw new Error('Invalid bounds type');
      }
      if (isNaN(north) || isNaN(south) || isNaN(east) || isNaN(west)) {
        throw new Error('Invalid coordinate values in bounds');
      }

      console.log('Parsed bounds:', { north, south, east, west });

      const centerLat = (north + south) / 2;
      const centerLng = (east + west) / 2;

      const centerWeather = await fetchWeatherForPoint(centerLat, centerLng);

      const gridPoints = generateGridPoints({ north, south, east, west });
      
    


      const weatherResults = await Promise.all(
        gridPoints.map(async (point) => {
          const weather = await fetchWeatherForPoint(point.lat, point.lng);
          return weather?.temperature ?? null;
        })
      );


      const temps = weatherResults.filter((t): t is number => t !== null);

      if (temps.length === 0) {
        throw new Error('No weather data available for this area');
      }

      const avg = temps.reduce((a, b) => a + b, 0) / temps.length;

      setLoading(false);
      return {
        avg: parseFloat(avg.toFixed(1)),
        min: Math.min(...temps),
        max: Math.max(...temps),
        count: temps.length,
        details: centerWeather || undefined,
      };
    } catch (err) {
      console.error('Error in fetchWeatherForArea:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch weather data');
      setLoading(false);
      return null;
    }
  }, [fetchWeatherForPoint]);

  return { fetchWeatherForArea, fetchWeatherForPoint, loading, error };
}

function generateGridPoints(
  bounds: { north: number; south: number; east: number; west: number },
  maxPoints = 25
) {
  const points: { lat: number; lng: number }[] = [];
  
  const latRange = bounds.north - bounds.south;
  const lngRange = bounds.east - bounds.west;
  
  const pointsPerSide = Math.ceil(Math.sqrt(maxPoints));
  
  const latStep = latRange / (pointsPerSide - 1);
  const lngStep = lngRange / (pointsPerSide - 1);
  
  for (let i = 0; i < pointsPerSide; i++) {
    for (let j = 0; j < pointsPerSide; j++) {
      const lat = bounds.south + (i * latStep);
      const lng = bounds.west + (j * lngStep);
      points.push({ lat, lng });
      
      if (points.length >= maxPoints) {
        return points;
      }
    }
  }
  
  return points;
}