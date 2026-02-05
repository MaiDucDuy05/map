import { useState, useCallback } from 'react';
import { LatLngTuple } from 'leaflet';

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

  const findRoute = useCallback(async (
    start: LatLngTuple,
    end: LatLngTuple,
    mode: TravelMode = 'driving'
  ): Promise<RouteResult | null> => {
    setLoading(true);
    setError(null);

    try {
      const profile = mode === 'walking' ? 'foot' : mode === 'cycling' ? 'bike' : 'car';
      
      const url = `https://router.project-osrm.org/route/v1/${profile}/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&steps=true&geometries=geojson`;

      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to fetch route');
      }

      const data = await response.json();

      if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
        throw new Error('No route found');
      }

      const route = data.routes[0];
      const leg = route.legs[0];
      const geometry: LatLngTuple[] = route.geometry.coordinates.map(
        (coord: [number, number]) => [coord[1], coord[0]] as LatLngTuple
      );


      const steps: RouteStep[] = leg.steps.map((step: any) => ({
        distance: step.distance,
        duration: step.duration,
        instruction: step.maneuver.instruction || getManeuverInstruction(step.maneuver),
        name: step.name || '',
        maneuver: step.maneuver ? {
          type: step.maneuver.type,
          modifier: step.maneuver.modifier,
          location: [step.maneuver.location[1], step.maneuver.location[0]] as LatLngTuple,
        } : undefined,
      }));

      setLoading(false);
      return {
        distance: route.distance,
        duration: route.duration,
        geometry,
        steps,
      };

    } catch (err) {
      console.error('Routing error:', err);
      setError(err instanceof Error ? err.message : 'Failed to find route');
      setLoading(false);
      return null;
    }
  }, []);

  return { findRoute, loading, error };
}

// Helper: Tạo instruction từ maneuver
function getManeuverInstruction(maneuver: any): string {
  const type = maneuver.type;
  const modifier = maneuver.modifier;

  if (type === 'depart') return 'Bắt đầu';
  if (type === 'arrive') return 'Đến nơi';
  if (type === 'turn') {
    if (modifier === 'left') return 'Rẽ trái';
    if (modifier === 'right') return 'Rẽ phải';
    if (modifier === 'sharp left') return 'Rẽ trái gấp';
    if (modifier === 'sharp right') return 'Rẽ phải gấp';
    if (modifier === 'slight left') return 'Rẽ trái nhẹ';
    if (modifier === 'slight right') return 'Rẽ phải nhẹ';
  }
  if (type === 'continue') return 'Tiếp tục đi thẳng';
  if (type === 'roundabout') return 'Vào vòng xuyến';
  
  return 'Tiếp tục';
}

export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}