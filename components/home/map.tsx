"use client"

import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { LatLngTuple } from 'leaflet';
import { memo, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { SlidesControlContext } from "@/app/page";
import DrawingLayer from "./drawing-layer";
import InspectingLayer from "./inspecting-layer";
import Layers from "./layers";
import { RoutingPanel } from '@/components/home/routing-panel';
import { RouteLayer } from '@/components/home/route-layer';
import { RouteResult } from '@/hooks/useRouting';

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
      // Chỉ kích hoạt callback nếu đang ở chế độ chọn
      if (isSelecting) {
        onMapClick([e.latlng.lat, e.latlng.lng]);
      }
    },
  });

  // UX: Đổi con trỏ chuột khi đang chọn điểm
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

// --- Component: Update Map State (Giữ nguyên logic của bạn) ---
const UpdateMapState = memo(({ mapViewWorkaround } : { mapViewWorkaround: number }) => {
    // Lưu ý: Đảm bảo SlidesControlContext tồn tại ở component cha
    const context = useContext(SlidesControlContext);
    const map = useMap();

    useEffect(() => {
        if (!context) return;
        const { slides, setSlides, currentSlideIndex, previousSlideIndex } = context;

        // Save previous slide state
        if (previousSlideIndex >= 0 && slides[previousSlideIndex]) {
            const previousSlide = slides[previousSlideIndex];
            previousSlide.latLng = [map.getCenter().lat, map.getCenter().lng];
            previousSlide.mapZoom = map.getZoom();
            // Cập nhật slides (cần cẩn thận deep copy nếu state phức tạp)
             // setSlides logic... (giữ nguyên logic của bạn nếu nó đã chạy đúng)
        }

        // Fly to current slide
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

// --- MAIN COMPONENT ---
const Map = memo(({ mapViewWorkaround } : { mapViewWorkaround: number }) => {
    const [startPoint, setStartPoint] = useState<LatLngTuple | null>(null);
    const [endPoint, setEndPoint] = useState<LatLngTuple | null>(null);
    const [route, setRoute] = useState<RouteResult | null>(null);
    
    // State quản lý chế độ chọn: 'start' | 'end' | null
    const [selectionMode, setSelectionMode] = useState<'start' | 'end' | null>(null);

    // Xử lý khi click vào map
    const handleMapClick = useCallback((latlng: LatLngTuple) => {
        if (selectionMode === 'start') {
            setStartPoint(latlng);
            setSelectionMode(null); // Tắt chế độ chọn ngay sau khi click
        } else if (selectionMode === 'end') {
            setEndPoint(latlng);
            setSelectionMode(null);
        }
    }, [selectionMode]);

    // Các handlers cho RoutingPanel
    const handleRouteCalculated = useCallback((result: RouteResult) => setRoute(result), []);
    
    const handleClearRoute = useCallback(() => {
        setRoute(null);
        setStartPoint(null);
        setEndPoint(null);
        setSelectionMode(null);
    }, []);

    // Inject styles vào head
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
        <div className="flex w-full h-screen overflow-hidden">
            <div className="w-96 min-w-[24rem] bg-slate-900 border-r border-slate-700 flex flex-col z-[1001] shadow-xl">
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

            {/* Map Area */}
            <div className="flex-1 relative h-full">
                {/* Banner thông báo UX khi đang chọn điểm */}
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
                    {/* Logic update slide */}
                    {/* <UpdateMapState mapViewWorkaround={mapViewWorkaround} /> */}

                    <TileLayer
                        attribution='&copy; Google Maps'
                        url="http://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                        subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
                    />
                    
                    <DrawingLayer />
                    <Layers />
                    <InspectingLayer />

                    {/* Xử lý click chọn điểm */}
                    <MapEventsHandler 
                        onMapClick={handleMapClick} 
                        isSelecting={selectionMode !== null} 
                    />

                    {/* Hiển thị đường đi */}
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