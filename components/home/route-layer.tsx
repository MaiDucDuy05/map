import { Polyline, Marker, Popup } from 'react-leaflet';
import { LatLngTuple } from 'leaflet';
import { RouteResult } from '@/hooks/useRouting';
import L from 'leaflet';

interface RouteLayerProps {
  route: RouteResult | null;
  startPoint: LatLngTuple | null;
  endPoint: LatLngTuple | null;
}

// Custom markers
const startIcon = L.divIcon({
  className: 'custom-marker',
  html: `<div style="background: #10b981; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const endIcon = L.divIcon({
  className: 'custom-marker',
  html: `<div style="background: #ef4444; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

export function RouteLayer({ route, startPoint, endPoint }: RouteLayerProps) {
  if (!route) return null;

  return (
    <>
      {/* Route Polyline */}
      <Polyline
        positions={route.geometry}
        pathOptions={{
          color: '#3b82f6',
          weight: 5,
          opacity: 0.7,
        }}
      />

      {/* Start Marker */}
      {startPoint && (
        <Marker position={startPoint} icon={startIcon}>
          <Popup>
            <div className="text-xs">
              <strong>Điểm xuất phát</strong>
            </div>
          </Popup>
        </Marker>
      )}

      {/* End Marker */}
      {endPoint && (
        <Marker position={endPoint} icon={endIcon}>
          <Popup>
            <div className="text-xs">
              <strong>Điểm đến</strong>
            </div>
          </Popup>
        </Marker>
      )}
    </>
  );
}