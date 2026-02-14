// types/map-controls.ts
export interface MapControl {
  // Navigation
  flyTo: (lat: number, lng: number, zoom?: number) => void;
  setView: (lat: number, lng: number, zoom?: number) => void;
  
  // Routing
  setRoute: (start: [number, number], end: [number, number]) => void;
  clearRoute: () => void;
  
  // Markers
  addMarker: (lat: number, lng: number, options?: {
    title?: string;
    description?: string;
    icon?: string;
  }) => string; // returns marker id
  removeMarker: (id: string) => void;
  clearAllMarkers: () => void;
  
  // Drawing
  drawCircle: (lat: number, lng: number, radius: number) => void;
  drawPolygon: (points: [number, number][]) => void;
  
  // Info
  getCurrentBounds: () => { north: number; south: number; east: number; west: number };
  getCurrentCenter: () => { lat: number; lng: number };
}