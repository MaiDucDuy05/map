import { Layer, RectLayer, CircleLayer, ArrowLayer, TextLayer } from "@/types/layer";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { useWeatherData } from "@/hooks/useWeatherData";
import { WeatherInfoDisplay } from "./weather-info-display";

interface LayerInfoPanelProps {
  layer: Layer;
  isSelected: boolean;
}

export function LayerInfoPanel({ layer, isSelected }: LayerInfoPanelProps) {
  const { fetchWeatherForArea, fetchWeatherForPoint, loading, error } = useWeatherData();
  const [weatherData, setWeatherData] = useState<any>(null);


  useEffect(() => {
      if (layer.type === "rectangle") {
        const bounds = (layer as RectLayer).bounds;
        fetchWeatherForArea(bounds)
        .then(setWeatherData);
      } else if (layer.type === "circle") {
        const circleLayer = layer as CircleLayer;

        const [lat, lng] = circleLayer.center;
        fetchWeatherForPoint(lat, lng).then(data => {
          if (data) {
            setWeatherData({
              avg: data.temperature,
              min: data.temperature,
              max: data.temperature,
              count: 1,
              details: data,
            });
          }
        });
    }
  }, [layer]);

  return (
    <div className={cn("p-3 bg-slate-700 text-sm rounded overflow-auto shadow m-0", isSelected && "bg-slate-800")}>
      <div className="space-y-3">
        {/* Geometry Info */}
        <div className="space-y-1">
          {layer.type === "rectangle" && (
            <>
              <div>
                <p className="font-medium text-slate-300"> Bounds:</p>
                <p className="pl-2 text-xs text-slate-400">{JSON.stringify((layer as RectLayer).bounds)}</p>
              </div>
              <div className="mt-2">
                <p className="font-medium text-slate-300">Real life area:</p>
                <p className="pl-1 text-xs text-slate-400">{layer.realLifeArea?.toFixed(2)} m²</p>
              </div>
            </>
          )}

          {layer.type === "circle" && (
            <>
              <div>
                <p className="font-medium text-slate-300"> Position:</p>
                {/* ✅ SỬA: Hiển thị đúng format */}
                <p className="pl-2 text-xs text-slate-400">
                  Center: [{(layer as CircleLayer).center[0].toFixed(6)}, {(layer as CircleLayer).center[1].toFixed(6)}]
                </p>
                <p className="pl-2 text-xs text-slate-400">Radius: {(layer as CircleLayer).radius.toFixed(1)}m</p>
              </div>
              <div className="mt-2">
                <p className="font-medium text-slate-300"> Real life area:</p>
                <p className="pl-1 text-xs text-slate-400">{layer.realLifeArea?.toFixed(2)} m²</p>
              </div>
            </>
          )}

          {layer.type === "arrow" && (
            <div>
              <p className="font-medium text-slate-300">📍 Position:</p>
              {/* ✅ SỬA: Arrow cũng dùng LatLngTuple */}
              <p className="pl-2 text-xs text-slate-400">
                Start: [{(layer as ArrowLayer).start[0].toFixed(6)}, {(layer as ArrowLayer).start[1].toFixed(6)}]
              </p>
              <p className="pl-2 text-xs text-slate-400">
                End: [{(layer as ArrowLayer).end[0].toFixed(6)}, {(layer as ArrowLayer).end[1].toFixed(6)}]
              </p>
              <div className="mt-2">
                <p className="font-medium text-slate-300"> Distance:</p>
                <p className="pl-1 text-xs text-slate-400">{layer.realLifeDistance!.toFixed(1)} m</p>
              </div>
            </div>
          )}
        </div>

        {/* Weather Info - Only for rectangle and circle */}
        {(layer.type === "rectangle" || layer.type === "circle") && (
          <div className="pt-3 border-t border-slate-600">
            <p className="font-medium text-slate-300 mb-2"> Weather Information</p>
            <WeatherInfoDisplay weatherData={weatherData} loading={loading} error={error} />
          </div>
        )}

        {/* Style Info */}
        <div className="pt-3 border-t border-slate-600">
          <p className="font-medium text-slate-300 mb-2"> Style:</p>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-slate-400">Stroke:</p>
              <div className="flex items-center gap-1">
                <div
                  className="w-3 h-3 border border-white rounded"
                  style={{
                    backgroundColor: (layer.type === "text" ? layer.textStrokeColor : layer.pathOptions?.color || 'default'),
                  }}
                />
                <p className="text-xs">
                  {layer.type === "text"
                    ? layer.textStrokeColor
                    : layer.pathOptions?.color || 'default'}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-slate-400">Fill:</p>
              <div className="flex items-center gap-1">
                <div
                  className="w-3 h-3 border border-white rounded"
                  style={{backgroundColor: (layer.type === "text" ? layer.textColor : layer.pathOptions?.fillColor || 'default')}}
                />
                <p className="text-xs">
                  {layer.type === "text"
                    ? layer.textColor
                    : layer.pathOptions?.fillColor || 'default'}
                </p>
              </div>
            </div>
            {layer.type === "text" && (
              <div className="flex items-center justify-between">
                <p className="text-slate-400">Font size:</p>
                <p className="text-xs">{(layer as TextLayer).fontSize}px</p>
              </div>
            )}
            {layer.type !== "text" && (
              <div className="flex items-center justify-between">
                <p className="text-slate-400">Opacity:</p>
                <p className="text-xs">{layer.pathOptions?.fillOpacity || 'default'}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}