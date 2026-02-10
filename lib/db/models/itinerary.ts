import { IndexSpecification, ObjectId } from 'mongodb';
import { Coordinates } from './location-mention';

export interface ItineraryPlace {
  place_id: string;
  name: string;
  coordinates: Coordinates;
  address?: string;
  category?: string;
  order: number;
  suggested_time?: string; // "08:00", "14:30"
  duration_minutes?: number;
  notes?: string;
  estimated_cost?: number;
}

export interface RouteInfo {
  geometry?: string; // Encoded polyline
  total_distance_km: number;
  total_duration_minutes: number;
  travel_mode: 'walking' | 'driving' | 'transit' | 'bicycling';
}

export interface Itinerary {
  _id?: ObjectId;
  user_id: string;
  title: string;
  description?: string;
  created_at: Date;
  updated_at: Date;
  source_session?: string; // Link về conversation tạo ra itinerary này
  places: ItineraryPlace[];
  route?: RouteInfo;
  metadata?: {
    total_cost_estimate?: number;
    difficulty?: 'easy' | 'moderate' | 'challenging';
    tags?: string[];
    shared?: boolean;
    likes?: number;
  };
  status: 'draft' | 'completed' | 'in_progress';
}

export const createItinerary = (
  user_id: string,
  title: string,
  places: ItineraryPlace[]
): Itinerary => ({
  user_id,
  title,
  places,
  created_at: new Date(),
  updated_at: new Date(),
  status: 'draft'
});

// Sort places theo thứ tự tối ưu (TSP approximation)
export const optimizePlaceOrder = (places: ItineraryPlace[]): ItineraryPlace[] => {
  if (places.length <= 2) return places;

  // Simple nearest neighbor heuristic
  const visited = new Set<number>();
  const ordered: ItineraryPlace[] = [];
  let current = 0; // Start from first place

  visited.add(current);
  ordered.push(places[current]);

  while (visited.size < places.length) {
    let nearest = -1;
    let minDistance = Infinity;

    for (let i = 0; i < places.length; i++) {
      if (visited.has(i)) continue;

      const distance = calculateDistance(
        places[current].coordinates,
        places[i].coordinates
      );

      if (distance < minDistance) {
        minDistance = distance;
        nearest = i;
      }
    }

    if (nearest !== -1) {
      visited.add(nearest);
      ordered.push(places[nearest]);
      current = nearest;
    }
  }

  // Update order
  return ordered.map((place, index) => ({
    ...place,
    order: index + 1
  }));
};

// Haversine formula
const calculateDistance = (coord1: Coordinates, coord2: Coordinates): number => {
  const R = 6371; // Earth radius in km
  const dLat = toRad(coord2.lat - coord1.lat);
  const dLon = toRad(coord2.lng - coord1.lng);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(coord1.lat)) * Math.cos(toRad(coord2.lat)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const toRad = (deg: number): number => deg * (Math.PI / 180);

// Calculate total route info
export const calculateRouteInfo = (places: ItineraryPlace[]): RouteInfo => {
  let total_distance = 0;
  
  for (let i = 0; i < places.length - 1; i++) {
    total_distance += calculateDistance(
      places[i].coordinates,
      places[i + 1].coordinates
    );
  }

  // Estimate time: 4 km/h walking, 30 km/h driving
  const avg_speed_kmh = 4; // walking default
  const travel_time = (total_distance / avg_speed_kmh) * 60; // minutes
  
  const activity_time = places.reduce(
    (sum, place) => sum + (place.duration_minutes || 60),
    0
  );

  return {
    total_distance_km: parseFloat(total_distance.toFixed(2)),
    total_duration_minutes: Math.round(travel_time + activity_time),
    travel_mode: 'walking'
  };
};


export const itineraryIndexes: {
  key: IndexSpecification;
}[] = [
  { key: { user_id: 1 } },
  { key: { created_at: -1 } },
  { key: { status: 1 } },
  { key: { 'metadata.shared': 1 } },
  { key: { 'metadata.tags': 1 } }
];
