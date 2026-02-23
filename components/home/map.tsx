"use client"

import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, useMap, useMapEvents, Marker, Popup } from "react-leaflet";
import { ChevronLeft, ChevronRight, MessageSquare, X } from 'lucide-react';
import { LatLngTuple } from 'leaflet';
import L from 'leaflet';
import { memo, useEffect, useState, useCallback, useRef } from "react";
import DrawingLayer from "./drawing-layer";
import InspectingLayer from "./inspecting-layer";
import Layers from "./layers";
import { RoutingPanel } from '@/components/home/routing-panel';
import { RouteLayer } from '@/components/home/route-layer';
import { RouteResult } from '@/hooks/useRouting';
import { MapSearch } from "./map-search";
import { fetchPoiStatistics, PoiResult } from "@/utils/overpass";
import { PoiStatsPanel } from "./poi-stats-panel";
import Chatbot from '@/components/chat-interface';
import { MapControl } from '@/types/map-controls';
import { MapAction } from '@/hooks/useChat';

const inspectionStyles = `
  .custom-corner-marker div { transition: transform 0.2s ease; }
  .custom-corner-marker div:hover { transform: scale(1.4); background-color: #3b82f6; cursor: grab; }
  .arrow-head-marker, .arrow-head-marker-inspection, .arrow-head-marker-preview { pointer-events: none; }
  .leaflet-container.crosshair-cursor { cursor: crosshair !important; }
  
  .chatbot-marker {
    background-color: #3b82f6;
    border: 3px solid white;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  }
  
  .chatbot-marker-pulse {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
  
  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: .5;
    }
  }
`;

interface ChatbotMarker {
  id: string;
  position: LatLngTuple;
  title?: string;
  description?: string;
  color?: string;
}

const MapEventsHandler = ({ 
  onMapClick, 
  isSelecting,
  mapRef
}: { 
  onMapClick: (latlng: LatLngTuple) => void;
  isSelecting: boolean;
  mapRef: React.MutableRefObject<any>;
}) => {
  const map = useMap();

  useEffect(() => {
    mapRef.current = map;
  }, [map, mapRef]);

  useMapEvents({
    click: (e) => {
      if (isSelecting) {
        onMapClick([e.latlng.lat, e.latlng.lng]);
      }
    },
  });

  useEffect(() => {
    const container = map.getContainer();
    if (isSelecting) {
      container.classList.add('crosshair-cursor');
    } else {
      container.classList.remove('crosshair-cursor');
    }
  }, [isSelecting, map]);

  return null;
};

const createCustomIcon = (color: string = '#3b82f6') => {
  return L.divIcon({
    className: 'chatbot-marker',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    html: `<div style="background-color: ${color}; width: 100%; height: 100%; border-radius: 50%;"></div>`
  });
};

const Map = memo(({ mapViewWorkaround } : { mapViewWorkaround: number }) => {
    const mapRef = useRef<any>(null);
    
    const [startPoint, setStartPoint] = useState<LatLngTuple | null>(null);
    const [endPoint, setEndPoint] = useState<LatLngTuple | null>(null);
    const [route, setRoute] = useState<RouteResult | null>(null);
    
    const [selectionMode, setSelectionMode] = useState<'start' | 'end' | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isChatbotOpen, setIsChatbotOpen] = useState(false);

    const [poiResult, setPoiResult] = useState<PoiResult | null>(null);
    const [statsLoading, setStatsLoading] = useState(false);

    const [chatbotMarkers, setChatbotMarkers] = useState<ChatbotMarker[]>([]);

    const handleShapeCreated = useCallback(async (layer: any) => {
        const latlngsRaw = layer.getLatLngs();
        const latlngs = Array.isArray(latlngsRaw[0]) ? latlngsRaw[0] : latlngsRaw; 
        
        if (latlngs && latlngs.length > 2) {
            setStatsLoading(true);
            setPoiResult(null);
            
            const result = await fetchPoiStatistics(latlngs);
            
            setPoiResult(result);
            setStatsLoading(false);
        }
    }, []);

    const handleLocationClick = useCallback((lat: number, lon: number) => {
        if (mapRef.current) {
            mapRef.current.setView([lat, lon], 18);
        }
    }, []);

    const closeStats = useCallback(() => {
        setPoiResult(null);
    }, []);

    const handleMapClick = useCallback((latlng: LatLngTuple) => {
        if (selectionMode === 'start') {
            setStartPoint(latlng);
            setSelectionMode(null);
        } else if (selectionMode === 'end') {
            setEndPoint(latlng);
            setSelectionMode(null);
        }
    }, [selectionMode]);

    const handleRouteCalculated = useCallback((result: RouteResult) => setRoute(result), []);
    
    const handleClearRoute = useCallback(() => {
        setRoute(null);
        setStartPoint(null);
        setEndPoint(null);
        setSelectionMode(null);
    }, []);

    //  Handle map actions from chatbot
    const handleMapAction = useCallback((action: MapAction) => {
        console.log('Executing map action:', action);
        
        switch (action.type) {
            case 'add_map_marker':
                if (action.args.lat && action.args.lng) {
                    const id = `marker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    const newMarker: ChatbotMarker = {
                        id,
                        position: [action.args.lat, action.args.lng],
                        title: action.args.title,
                        description: action.args.description,
                        color: '#3b82f6'
                    };
                    
                    setChatbotMarkers(prev => [...prev, newMarker]);
                    
                    // Auto fly to marker
                    if (mapRef.current) {
                        mapRef.current.flyTo([action.args.lat, action.args.lng], 17, { duration: 1.5 });
                    }
                }
                break;
                
            case 'create_route':
                if (action.args.start && action.args.end) {
                    setStartPoint(action.args.start);
                    setEndPoint(action.args.end);
                }
                break;
                
            case 'fly_to':
                if (action.args.lat && action.args.lng && mapRef.current) {
                    const zoom = action.args.zoom || 17;
                    mapRef.current.flyTo([action.args.lat, action.args.lng], zoom, { duration: 1.5 });
                }
                break;
                
            case 'clear_markers':
                setChatbotMarkers([]);
                break;
                
            case 'add_polygon':
                if (action.args.points && action.args.points.length > 2) {
                    //  Implement polygon drawing
                    console.log('Draw polygon:', action.args.points);
                }
                break;
                
            default:
                console.warn('Unknown map action type:', action.type);
        }
    }, []);

    const mapControlRef = useRef<MapControl>({
        flyTo: (lat: number, lng: number, zoom: number = 17) => {
            if (mapRef.current) {
                mapRef.current.flyTo([lat, lng], zoom, {
                    duration: 1.5
                });
            }
        },
        
        setView: (lat: number, lng: number, zoom: number = 16) => {
            if (mapRef.current) {
                mapRef.current.setView([lat, lng], zoom);
            }
        },
        
        setRoute: (start: [number, number], end: [number, number]) => {
            setStartPoint(start);
            setEndPoint(end);
        },
        
        clearRoute: () => {
            handleClearRoute();
        },
        
        addMarker: (lat: number, lng: number, options?: {
            title?: string;
            description?: string;
        }) => {
            const id = `marker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const newMarker: ChatbotMarker = {
                id,
                position: [lat, lng],
                title: options?.title,
                description: options?.description,
            };
            
            setChatbotMarkers(prev => [...prev, newMarker]);
            
            if (mapRef.current) {
                mapRef.current.flyTo([lat, lng], 17, { duration: 1 });
            }
            
            return id;
        },
        
        removeMarker: (id: string) => {
            setChatbotMarkers(prev => prev.filter(m => m.id !== id));
        },
        
        clearAllMarkers: () => {
            setChatbotMarkers([]);
        },
        
        drawCircle: (lat: number, lng: number, radius: number) => {
            console.log('Draw circle:', lat, lng, radius);
        },
        
        drawPolygon: (points: [number, number][]) => {
            console.log('Draw polygon:', points);
        },
        
        getCurrentBounds: () => {
            if (mapRef.current) {
                const bounds = mapRef.current.getBounds();
                return {
                    north: bounds.getNorth(),
                    south: bounds.getSouth(),
                    east: bounds.getEast(),
                    west: bounds.getWest(),
                };
            }
            return { north: 0, south: 0, east: 0, west: 0 };
        },
        
        getCurrentCenter: () => {
            if (mapRef.current) {
                const center = mapRef.current.getCenter();
                return { lat: center.lat, lng: center.lng };
            }
            return { lat: 21.03, lng: 105.804 };
        },
    });

    useEffect(() => {
        const styleId = 'inspection-styles';
        if (!document.getElementById(styleId)) {
            const styleEl = document.createElement('style');
            styleEl.id = styleId;
            styleEl.innerHTML = inspectionStyles;
            document.head.appendChild(styleEl);
        }
    }, [mapViewWorkaround]);

    return (
        <div className="flex w-full h-full overflow-hidden relative">
            {/* Left Sidebar - Routing Panel */}
            <div 
                className={`
                    bg-slate-900 border-r border-slate-700 flex flex-col z-[1001] shadow-xl
                    transition-all duration-300 ease-in-out
                    ${isSidebarOpen ? 'w-96 translate-x-0 opacity-100' : 'w-0 -translate-x-full opacity-0 border-none hidden'}
                `}
            >
                <div className="w-96 min-w-[24rem] h-full flex flex-col overflow-hidden">
                    <div className="p-4 overflow-y-auto flex-1">
                        <RoutingPanel
                            startPoint={startPoint}
                            endPoint={endPoint}
                            onSelectStartMode={() => setSelectionMode('start')}
                            onSelectEndMode={() => setSelectionMode('end')}
                            onRouteCalculated={handleRouteCalculated}
                            onClearRoute={handleClearRoute}
                        />
                    </div>
                </div>
            </div>

            {/* Main Map Area */}
            <div className="flex-1 relative h-full w-full">
                <button
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className={`
                        absolute top-[80px] z-[1002] bg-white text-slate-700 p-2 rounded-md shadow-md hover:bg-slate-100 transition-all duration-300 border border-slate-300
                        ${isSidebarOpen ? 'left-[-15px] opacity-0 pointer-events-none' : 'left-3 opacity-100'} 
                    `}
                    title="Mở bảng điều khiển"
                >
                    <ChevronRight size={20} />
                </button>
                
                <button
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className={`
                        absolute top-1/2 -translate-y-1/2 z-[1002] 
                        bg-slate-800 text-white border border-slate-600 border-l-0
                        h-12 w-6 flex items-center justify-center rounded-r-md shadow-lg
                        transition-all duration-300 hover:bg-slate-700
                        ${isSidebarOpen ? 'left-0' : '-left-8'} 
                    `}
                    title={isSidebarOpen ? "Thu gọn" : "Mở rộng"}
                >
                   {isSidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                </button>

                {/* Chatbot Toggle Button */}
                {!isChatbotOpen && (
                    <button
                        onClick={() => setIsChatbotOpen(true)}
                        className="absolute bottom-6 right-6 z-[1002] bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-2xl transition-all duration-300 hover:scale-110 group"
                        title="Mở trợ lý du lịch"
                    >
                        <MessageSquare size={24} />
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                        
                        <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-slate-800 text-white text-sm px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                            Hỏi về địa điểm du lịch
                        </span>
                    </button>
                )}

                {selectionMode && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-blue-600/90 text-white px-6 py-3 rounded-full shadow-lg backdrop-blur-sm flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
                        <span className="font-medium">
                            {selectionMode === 'start' ? 'Chọn Điểm Bắt Đầu' : 'Chọn Điểm Kết Thúc'}
                        </span>
                        <button 
                            onClick={() => setSelectionMode(null)}
                            className="bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded text-sm transition-colors"
                        >
                            Hủy
                        </button>
                    </div>
                )}

                {(poiResult !== null || statsLoading) && (
                    <PoiStatsPanel 
                        stats={poiResult?.stats || []} 
                        details={poiResult?.details || []}
                        loading={statsLoading} 
                        onClose={closeStats}
                        onLocationClick={handleLocationClick}
                    />
                )}

                {/* Chatbot Panel */}
                {isChatbotOpen && (
                    <div className="absolute top-4 right-4 z-[1003] w-[450px] h-[calc(100vh-8rem)] max-h-[800px] shadow-2xl rounded-lg overflow-hidden animate-in slide-in-from-right duration-300">
                        <div className="relative h-full bg-white rounded-lg flex flex-col">
                            <button
                                onClick={() => setIsChatbotOpen(false)}
                                className="absolute top-3 right-3 z-10 bg-white/80 hover:bg-white text-gray-600 hover:text-gray-800 p-1.5 rounded-full shadow-md transition-all"
                                title="Đóng"
                            >
                                <X size={18} />
                            </button>

                            <Chatbot
                                userId="hanoi_traveler_001"
                                mapControl={mapControlRef.current}
                                onMapAction={handleMapAction}
                            />
                        </div>
                    </div>
                )}
                
                <MapContainer
                    center={[21.03, 105.804]}
                    zoom={16}
                    style={{ height: "100%", width: "100%" }}
                    keyboard={false}
                    doubleClickZoom={false}
                >   
                    {isSidebarOpen && <MapSearch />}
                    
                    <TileLayer
                        attribution='&copy; Google Maps'
                        url="https://mt0.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                        subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
                    />
                    
                    <DrawingLayer onShapeCreated={handleShapeCreated} />
                    
                    <Layers />
                    <InspectingLayer />

                    <MapEventsHandler 
                        onMapClick={handleMapClick} 
                        isSelecting={selectionMode !== null}
                        mapRef={mapRef}
                    />
                    
                    <RouteLayer
                        route={route}
                        startPoint={startPoint}
                        endPoint={endPoint}
                    />

                    {/* Render Chatbot Markers */}
                    {chatbotMarkers.map((marker) => (
                        <Marker
                            key={marker.id}
                            position={marker.position}
                            icon={createCustomIcon(marker.color || '#3b82f6')}
                        >
                            <Popup>
                                <div className="p-2 min-w-[200px]">
                                    {marker.title && (
                                        <h3 className="font-semibold text-sm mb-1 text-gray-800">
                                            {marker.title}
                                        </h3>
                                    )}
                                    {marker.description && (
                                        <p className="text-xs text-gray-600 mb-2">
                                            {marker.description}
                                        </p>
                                    )}
                                    <div className="flex gap-2 mt-2">
                                        <button
                                            onClick={() => {
                                                if (mapRef.current) {
                                                    mapRef.current.flyTo(marker.position, 18, { duration: 1 });
                                                }
                                            }}
                                            className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                                        >
                                            Phóng to
                                        </button>
                                        <button
                                            onClick={() => mapControlRef.current.removeMarker(marker.id)}
                                            className="text-xs px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                                        >
                                            Xóa
                                        </button>
                                    </div>
                                </div>
                            </Popup>
                        </Marker>
                    ))}
                </MapContainer>
            </div>
        </div>
    );
});

Map.displayName = "Map";

export default Map;