import { Loader2, Cloud, Wind, Droplets, Thermometer } from "lucide-react";

interface WeatherInfoDisplayProps {
  weatherData: {
    avg: number;
    min: number;
    max: number;
    count: number;
    details?: {
      temperature: number;
      windSpeed: number;
      humidity: number;
      precipitation: number;
      weatherCode: number;
      time: string;
    };
  } | null;
  loading: boolean;
  error: string | null;
}

export function WeatherInfoDisplay({ weatherData, loading, error }: WeatherInfoDisplayProps) {

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Loader2 size={14} className="animate-spin" />
        <span>Loading weather...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-xs text-red-400">
        {error}
      </div>
    );
  }


  if (!weatherData) return null;

  return (
    <div className="space-y-2 text-xs">
      {/* Temperature Summary */}
      <div className="bg-slate-800 p-2 rounded">
        <p className="font-medium text-slate-300 mb-1">🌡️ Temperature</p>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <p className="text-slate-400">Avg</p>
            <p className="font-bold text-blue-400">{weatherData.avg}°C</p>
          </div>
          <div>
            <p className="text-slate-400">Min</p>
            <p className="font-bold text-cyan-400">{weatherData.min}°C</p>
          </div>
          <div>
            <p className="text-slate-400">Max</p>
            <p className="font-bold text-orange-400">{weatherData.max}°C</p>
          </div>
        </div>
      </div>

      {/* Detailed Weather Info */}
      {weatherData.details && (
        <div className="bg-slate-800 p-2 rounded space-y-2">
          <p className="font-medium text-slate-300 mb-1"> Center Point Details</p>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Thermometer size={14} className="text-red-400" />
              <span className="text-slate-400">Temperature:</span>
            </div>
            <span className="font-medium">{weatherData.details.temperature}°C</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Wind size={14} className="text-blue-400" />
              <span className="text-slate-400">Wind Speed:</span>
            </div>
            <span className="font-medium">{weatherData.details.windSpeed} km/h</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Droplets size={14} className="text-cyan-400" />
              <span className="text-slate-400">Humidity:</span>
            </div>
            <span className="font-medium">{weatherData.details.humidity}%</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Cloud size={14} className="text-gray-400" />
              <span className="text-slate-400">Precipitation:</span>
            </div>
            <span className="font-medium">{weatherData.details.precipitation} mm</span>
          </div>

          <div className="text-[10px] text-slate-500 mt-2 pt-2 border-t border-slate-700">
            Updated: {new Date(weatherData.details.time).toLocaleString()}
          </div>
        </div>
      )}

      <div className="text-[10px] text-slate-500">
        Based on {weatherData.count} sample points
      </div>
    </div>
  );
}