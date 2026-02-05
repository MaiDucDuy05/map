import { useState, useCallback, useEffect } from 'react';
import { LatLngTuple } from 'leaflet';
import { useRouting, formatDistance, formatDuration, RouteResult } from '@/hooks/useRouting';
import { MapPin, Navigation, Loader2, X, Car, PersonStanding, Bike, ArrowRightLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RoutingPanelProps {
  startPoint: LatLngTuple | null;
  endPoint: LatLngTuple | null;
  onSelectStartMode: () => void;
  onSelectEndMode: () => void;
  onRouteCalculated?: (route: RouteResult) => void;
  onClearRoute?: () => void;
}

export function RoutingPanel({ 
  startPoint, 
  endPoint, 
  onSelectStartMode,
  onSelectEndMode,
  onRouteCalculated, 
  onClearRoute 
}: RoutingPanelProps) {
  const [mode, setMode] = useState<'driving' | 'walking' | 'cycling'>('driving');
  const [route, setRoute] = useState<RouteResult | null>(null);
  const { findRoute, loading, error } = useRouting();
  useEffect(() => {
    if (startPoint && endPoint) {
      findRoute(startPoint, endPoint, mode).then(result => {
        if (result) {
          setRoute(result);
          onRouteCalculated?.(result);
        }
      });
    }
  }, [startPoint, endPoint, mode, findRoute, onRouteCalculated]);


  const handleClear = useCallback(() => {
    setRoute(null);
    onClearRoute?.(); 
  }, [onClearRoute]);

  return (
    <div className="bg-slate-800 rounded-lg shadow-lg p-4 space-y-4 text-slate-200">
      <div className="flex items-center justify-between border-b border-slate-700 pb-3">
        <h3 className="font-semibold text-lg flex items-center gap-2 text-white">
          <Navigation size={20} className="text-blue-500" />
          Dẫn đường
        </h3>
        {(startPoint || endPoint || route) && (
          <button
            onClick={handleClear}
            className="text-slate-400 hover:text-red-400 p-1.5 rounded-md hover:bg-slate-700 transition-colors"
            title="Xóa lộ trình"
          >
            <X size={18} />
          </button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 bg-slate-900/50 p-1 rounded-lg">
        {[
          { id: 'driving', icon: Car, label: 'Xe hơi' },
          { id: 'walking', icon: PersonStanding, label: 'Đi bộ' },
          { id: 'cycling', icon: Bike, label: 'Xe đạp' },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setMode(item.id as any)}
            className={cn(
              "flex flex-col items-center justify-center py-2 px-1 rounded-md text-xs font-medium transition-all",
              mode === item.id 
                ? "bg-blue-600 text-white shadow-sm" 
                : "text-slate-400 hover:bg-slate-700 hover:text-slate-200"
            )}
          >
            <item.icon size={18} className="mb-1" />
            {item.label}
          </button>
        ))}
      </div>

      <div className="space-y-3 relative">
        <div className="absolute left-[19px] top-8 bottom-8 w-0.5 bg-slate-700 -z-0" />
        <div className="group relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full border-2 border-green-500 bg-slate-900 shadow-[0_0_10px_rgba(34,197,94,0.3)] flex-shrink-0" />
            <button
              onClick={onSelectStartMode}
              className={cn(
                "flex-1 text-left px-3 py-2.5 rounded-md text-sm border transition-all truncate",
                startPoint 
                  ? "bg-slate-700 border-slate-600 text-white" 
                  : "bg-slate-700/50 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300 border-dashed"
              )}
            >
              {startPoint 
                ? `${startPoint[0].toFixed(5)}, ${startPoint[1].toFixed(5)}`
                : "Chọn điểm xuất phát..."}
            </button>
          </div>
        </div>
        <div className="group relative z-10">
          <div className="flex items-center gap-3">
            <MapPin size={16} className="text-red-500 flex-shrink-0 fill-red-500/20" />
            <button
              onClick={onSelectEndMode}
              className={cn(
                "flex-1 text-left px-3 py-2.5 rounded-md text-sm border transition-all truncate",
                endPoint 
                  ? "bg-slate-700 border-slate-600 text-white" 
                  : "bg-slate-700/50 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300 border-dashed"
              )}
            >
              {endPoint 
                ? `${endPoint[0].toFixed(5)}, ${endPoint[1].toFixed(5)}`
                : "Chọn điểm đến..."}
            </button>
          </div>
        </div>
      </div>
      {loading && (
        <div className="flex items-center justify-center py-4 text-blue-400 bg-blue-500/10 rounded-md animate-pulse">
          <Loader2 size={18} className="animate-spin mr-2" />
          <span className="text-sm font-medium">Đang tìm đường tối ưu...</span>
        </div>
      )}

      {error && (
        <div className="text-red-400 text-sm p-3 bg-red-500/10 border border-red-500/20 rounded-md">
          ⚠️ {error}
        </div>
      )}

      {route && !loading && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-3">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg p-3 text-white shadow-lg">
            <div className="flex justify-between items-end mb-1">
              <span className="text-blue-100 text-xs uppercase tracking-wider">Tổng quan</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{formatDistance(route.distance)}</div>
                <div className="text-sm text-blue-100 opacity-90">{formatDuration(route.duration)}</div>
              </div>
              <Navigation className="opacity-20" size={40} />
            </div>
          </div>

          {route.steps && route.steps.length > 0 && (
            <div className="space-y-1">
              <h4 className="text-slate-400 font-medium text-xs uppercase tracking-wider py-1">Chi tiết lộ trình</h4>
              <div className="max-h-[30vh] overflow-y-auto pr-1 space-y-1 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent">
                {route.steps.map((step, index) => (
                  <div
                    key={index}
                    className="bg-slate-700/50 hover:bg-slate-700 rounded p-2.5 text-sm transition-colors group"
                  >
                    <div className="flex gap-3">
                      <span className="text-slate-500 font-mono text-xs pt-0.5 group-hover:text-slate-300 w-5 flex-shrink-0 text-right">
                        {index + 1}.
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-200 leading-snug" dangerouslySetInnerHTML={{ __html: step.instruction }} />
                        {step.name && step.name !== '-' && (
                          <p className="text-blue-400 text-xs mt-1 font-medium truncate">{step.name}</p>
                        )}
                        <p className="text-slate-500 text-xs mt-1 flex gap-2">
                          <span>{formatDistance(step.distance)}</span>
                          <span>•</span>
                          <span>{formatDuration(step.duration)}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}


      {!startPoint && !endPoint && !loading && (
        <div className="text-slate-500 text-xs text-center p-4 border border-dashed border-slate-700 rounded-lg">
          Chọn điểm đi và điểm đến để xem lộ trình
        </div>
      )}
    </div>
  );
}