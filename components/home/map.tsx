"use client"

import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { LatLngTuple } from 'leaflet';
import { memo, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { SlidesControlContext } from "@/app/page";
import DrawingLayer from "./drawing-layer";
import InspectingLayer from "./inspecting-layer";
import Layers from "./layers";
import { RoutingPanel } from '@/components/home/routing-panel';
import { RouteLayer } from '@/components/home/route-layer';
import { RouteResult } from '@/hooks/useRouting';
import { MapSearch } from "./map-search";

const inspectionStyles = `
  .custom-corner-marker div { transition: transform 0.2s ease; }
  .custom-corner-marker div:hover { transform: scale(1.4); background-color: #3b82f6; cursor: grab; }
  .arrow-head-marker, .arrow-head-marker-inspection, .arrow-head-marker-preview { pointer-events: none; }
  /* Cursor styles */
  .leaflet-container.crosshair-cursor { cursor: crosshair !important; }
`;

const MapEventsHandler = ({ 
  onMapClick, 
  isSelecting 
}: { 
  onMapClick: (latlng: LatLngTuple) => void;
  isSelecting: boolean;
}) => {
  const map = useMap();

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

const UpdateMapState = memo(({ mapViewWorkaround } : { mapViewWorkaround: number }) => {
    const context = useContext(SlidesControlContext);
    const map = useMap();

    useEffect(() => {
        if (!context) return;
        const { slides, setSlides, currentSlideIndex, previousSlideIndex } = context;

        if (previousSlideIndex >= 0 && slides[previousSlideIndex]) {
            const previousSlide = slides[previousSlideIndex];
            previousSlide.latLng = [map.getCenter().lat, map.getCenter().lng];
            previousSlide.mapZoom = map.getZoom();
        }

        const currentSlide = slides[currentSlideIndex];
        if (currentSlide) {
             const { latLng, mapZoom } = currentSlide;
             if (!map.getCenter().equals(latLng) || map.getZoom() !== mapZoom) {
                 map.flyTo(latLng, mapZoom, { duration: 0.2 });
             }
        }
    }, [mapViewWorkaround, context, map]);

    return null;
});

const Map = memo(({ mapViewWorkaround } : { mapViewWorkaround: number }) => {
    const [startPoint, setStartPoint] = useState<LatLngTuple | null>(null);
    const [endPoint, setEndPoint] = useState<LatLngTuple | null>(null);
    const [route, setRoute] = useState<RouteResult | null>(null);
    
    const [selectionMode, setSelectionMode] = useState<'start' | 'end' | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    


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

    useEffect(() => {
        const styleId = 'inspection-styles';
        if (!document.getElementById(styleId)) {
            const styleEl = document.createElement('style');
            styleEl.id = styleId;
            styleEl.innerHTML = inspectionStyles;
            document.head.appendChild(styleEl);
        }
    }, []);

    return (
        <div className="flex w-full h-full overflow-hidden relative">
            
            <div 
                className={`
                    bg-slate-900 border-r border-slate-700 flex flex-col z-[1001] shadow-xl
                    transition-all duration-300 ease-in-out
                    ${isSidebarOpen ? 'w-96 translate-x-0 opacity-100' : 'w-0 -translate-x-full opacity-0 border-none'}
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


                {/* BANNER THÔNG BÁO CHỌN ĐIỂM */}
                {selectionMode && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-blue-600/90 text-white px-6 py-3 rounded-full shadow-lg backdrop-blur-sm flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
                        <span className="font-medium">
                            {selectionMode === 'start' ? '📍 Chọn Điểm Bắt Đầu' : '🏁 Chọn Điểm Kết Thúc'}
                        </span>
                        <button 
                            onClick={() => setSelectionMode(null)}
                            className="bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded text-sm transition-colors"
                        >
                            Hủy
                        </button>
                    </div>
                )}
                
                <MapContainer
                    center={[21.03, 105.804]}
                    zoom={16}
                    style={{ height: "100%", width: "100%" }}
                    keyboard={false}
                    doubleClickZoom={false}
                >   
                    {
                        isSidebarOpen ? <MapSearch /> : null
                    }
                    <TileLayer
                        attribution='&copy; Google Maps'
                        url="http://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                        subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
                    />
                    
                    <DrawingLayer />
                    <Layers />
                    <InspectingLayer />

                    <MapEventsHandler 
                        onMapClick={handleMapClick} 
                        isSelecting={selectionMode !== null} 
                    />
                    <RouteLayer
                        route={route}
                        startPoint={startPoint}
                        endPoint={endPoint}
                    />
                </MapContainer>
            </div>
        </div>
    );
});

export default Map;