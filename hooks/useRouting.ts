// hooks/useRouting.ts
import { useState, useCallback } from 'react';
import { LatLngTuple } from 'leaflet';

const ORS_API_KEY = process.env.NEXT_PUBLIC_ORS_API_KEY;

export interface RouteStep {
  distance: number;
  duration: number;
  instruction: string;
  name: string;
  maneuver?: {
    type: string;
    modifier?: string;
    location: LatLngTuple;
  };
}

export interface RouteResult {
  distance: number;
  duration: number;
  geometry: LatLngTuple[];
  steps: RouteStep[];
}

type TravelMode = 'driving' | 'walking' | 'cycling';

export function useRouting() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const findRoute = useCallback(
    async (
      start: LatLngTuple,
      end: LatLngTuple,
      mode: TravelMode = "driving"
    ): Promise<RouteResult | null> => {
      setLoading(true);
      setError(null);

      try {
        if (!ORS_API_KEY) {
          throw new Error("Missing ORS_API_KEY");
        }

        const profileMap: Record<TravelMode, string> = {
          driving: "driving-car",
          walking: "foot-walking",
          cycling: "cycling-regular",
        };
        const profile = profileMap[mode];

        // 1. SỬA URL: Thêm "/geojson" vào cuối để lấy định dạng mảng tọa độ
        const url = `https://api.openrouteservice.org/v2/directions/${profile}/geojson`;

        const requestBody = {
          coordinates: [
            [start[1], start[0]], // [Lng, Lat]
            [end[1], end[0]],
          ],
          instructions: true,
          geometry: true,
          language: "vi",
          radiuses: [5000, 5000], // Tìm đường trong bán kính 5km
        };

        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Authorization": ORS_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          console.error("❌ ORS Error:", errData);
          throw new Error(errData.error?.message || `Lỗi API: ${response.status}`);
        }

        const data = await response.json();

        // 2. SỬA CÁCH ĐỌC DỮ LIỆU: GeoJSON trả về "features", không phải "routes"
        if (!data.features || data.features.length === 0) {
          throw new Error("Không tìm thấy đường đi (No route found)");
        }

        const feature = data.features[0];
        const geometryCoords = feature.geometry.coordinates; // Đây là mảng [[lon, lat], ...]
        const segment = feature.properties.segments[0];

        // Map từ [Lon, Lat] (GeoJSON) sang [Lat, Lon] (Leaflet)
        const geometry: LatLngTuple[] = geometryCoords.map(
          (coord: [number, number]) => [coord[1], coord[0]] as LatLngTuple
        );

        const steps: RouteStep[] = (segment.steps || []).map((step: any) => ({
          distance: step.distance || 0,
          duration: step.duration || 0,
          instruction: step.instruction || "Tiếp tục",
          name: step.name || "-",
          maneuver: step.maneuver
            ? {
                type: step.maneuver.type,
                modifier: step.maneuver.modifier,
                location: [
                  step.maneuver.location[1],
                  step.maneuver.location[0],
                ] as LatLngTuple,
              }
            : undefined,
        }));

        setLoading(false);
        return {
          distance: segment.distance,
          duration: segment.duration,
          geometry,
          steps,
        };

      } catch (err) {
        console.error("❌ Routing Error:", err);
        setError(err instanceof Error ? err.message : "Không thể tìm đường");
        setLoading(false);
        return null;
      }
    },
    []
  );

  return { findRoute, loading, error };
}

// Helper functions
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`.replace('.0', '');
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return '< 1 phút';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours} giờ ${minutes} phút` : `${minutes} phút`;
}