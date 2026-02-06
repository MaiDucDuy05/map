import { Marker, Rectangle, Circle, Polyline, useMapEvents } from "react-leaflet";
import L, { LatLngBoundsExpression, LatLngTuple, PointExpression } from 'leaflet';
import { memo, useContext, useState, useEffect } from "react";
import { DrawingStatesContext, HistoryContext, LayersContext, PresentationContext } from "@/app/contexts";
import { v4 as uuidv4 } from "uuid";
import { Layer } from "@/types/layer";
import { NewLayerAction } from "@/types/history-stack";
import { HistoryStack } from "@/app/history-stack";

interface DrawingLayerProps {
  onShapeCreated?: (layer: any) => void;
}

const DrawingLayer = memo(({ onShapeCreated }: DrawingLayerProps) => {
    const [rectOrgin, setRectOrigin] = useState<LatLngTuple | null>();
    const [rectBounds, setRectBounds] = useState<LatLngBoundsExpression | null>();
    const [circleCenter, setCircleCenter] = useState<LatLngTuple | null>();
    const [circleRadius, setCircleRadius] = useState<number>(0);
    const [arrowStart, setArrowStart] = useState<LatLngTuple | null>();
    const [arrowEnd, setArrowEnd] = useState<LatLngTuple | null>();
    const [textOrigin, setTextOrigin] = useState<LatLngTuple | null>();

    const { setSlideHistory } = useContext(HistoryContext);
    const { setLayers } = useContext(LayersContext)
    const { drawingStates } = useContext(DrawingStatesContext);
    const { setInspectingLayerId } = useContext(PresentationContext);

    useEffect(() => {
        if (textOrigin && drawingStates.drawingMode === 3) {
            setTimeout(() => {
                const textEditable: HTMLElement | null = document.getElementById("text-editable");
                const confirmTextBtn: HTMLElement | null = document.getElementById("confirm-text");
                if (textEditable) {
                    textEditable.focus();
                    confirmTextBtn?.addEventListener("click", (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const textContent = textEditable.textContent?.trim();
                        if (textContent) {
                            const newLayer: Layer = {
                                type: "text",
                                uuid: uuidv4(),
                                isPinned: false,
                                isHidden: false,
                                textContent: textContent,
                                textPosition: textOrigin,
                                fontSize: drawingStates.fontSize || 16,
                                textColor: drawingStates.fillColor || 'blue',
                                textStrokeColor: drawingStates.strokeColor || 'blue',
                            };
                            setLayers((prevLayers) => [...prevLayers, newLayer]);
                            setSlideHistory((prev: HistoryStack) => {
                                const newSlideHistory = prev.copy();
                                newSlideHistory.push({
                                    type: "NEW_LAYER",
                                    layer: {...newLayer},
                                } as NewLayerAction);
                                return newSlideHistory;
                            });
                            setInspectingLayerId(newLayer.uuid);
                        }
                        setTextOrigin(null);
                    });
                }
            }, 0);
        }
    }, [textOrigin, drawingStates.drawingMode]);


    const map = useMapEvents({
        mousedown: (e) => {
            if (drawingStates.isDrawing) {
                switch (drawingStates.drawingMode) {
                    case 0: // Rectangle
                        setRectOrigin([e.latlng.lat, e.latlng.lng]);
                        break;
                    case 1: // Circle
                        setCircleCenter([e.latlng.lat, e.latlng.lng]);
                        setCircleRadius(0);
                        break;
                    case 2: // Arrow
                        setArrowStart([e.latlng.lat, e.latlng.lng]);
                        break;
                    case 3: // Text
                        setTextOrigin([e.latlng.lat, e.latlng.lng]);
                        break;
                }
            }
        },
        mousemove: (e) => {
            if (drawingStates.isDrawing) {
                switch (drawingStates.drawingMode) {
                    case 0: // Rectangle
                        if (rectOrgin) {
                            setRectBounds([rectOrgin, [e.latlng.lat, e.latlng.lng]]);
                        }
                        break;
                    case 1: // Circle
                        if (circleCenter) {
                            const radius = map.distance(circleCenter, [e.latlng.lat, e.latlng.lng]);
                            setCircleRadius(radius);
                        }
                        break;
                    case 2: // Arrow
                        if (arrowStart) {
                            setArrowEnd([e.latlng.lat, e.latlng.lng]);
                        }
                        break;
                }
            }
        },
        mouseup: (e) => {
            if (drawingStates.isDrawing) {
                let newLayer: Layer;
                let shapeForStats: any = null;

                switch (drawingStates.drawingMode) {
                    case 0: 
                        if (rectOrgin && rectBounds) {
                            const bounds: LatLngBoundsExpression = [
                                rectOrgin,
                                [e.latlng.lat, e.latlng.lng]
                            ];
                            newLayer = {
                                type: "rectangle",
                                uuid: uuidv4(),
                                isPinned: false,
                                isHidden: false,
                                bounds: bounds,
                                pathOptions: {
                                    color: drawingStates.strokeColor || 'blue',
                                    fillColor: drawingStates.fillColor || 'blue',
                                    fillOpacity: drawingStates.fillOpacity || 0.5,
                                },
                            };
                            // Tính diện tích thực tế (giữ nguyên logic của bạn)
                            newLayer.realLifeArea = map.distance(
                                bounds[0] as LatLngTuple,
                                [bounds[0][0], bounds[1][1]] as LatLngTuple
                            ) * map.distance(
                                bounds[0] as LatLngTuple,
                                [bounds[1][0], bounds[0][1]] as LatLngTuple
                            );
                            
                            setInspectingLayerId(newLayer.uuid);
                            
                            shapeForStats = {
                                getLatLngs: () => {
                                    const p1 = bounds[0] as LatLngTuple; // Top-Left
                                    const p2: LatLngTuple = [bounds[0][0], bounds[1][1]]; // Top-Right
                                    const p3 = bounds[1] as LatLngTuple; // Bottom-Right
                                    const p4: LatLngTuple = [bounds[1][0], bounds[0][1]]; // Bottom-Left
                                    return [[p1, p2, p3, p4]]; 
                                }
                            };
                        }
                        break;
                    
                     case 1: // Circle
                        if (circleCenter && circleRadius > 0) {
                            newLayer = {
                                type: "circle",
                                uuid: uuidv4(),
                                isPinned: false,
                                isHidden: false,
                                center: circleCenter,
                                radius: circleRadius,
                                pathOptions: {
                                    color: drawingStates.strokeColor || 'blue',
                                    fillColor: drawingStates.fillColor || 'blue',
                                    fillOpacity: drawingStates.fillOpacity || 0.5,
                                },
                            };
                            newLayer.realLifeArea = Math.PI * Math.pow(circleRadius, 2);
                            setInspectingLayerId(newLayer.uuid);
                        }
                        break;
                    case 2:
                        if (arrowStart && arrowEnd) {
                            newLayer = {
                                type: "arrow",
                                uuid: uuidv4(),
                                isPinned: false,
                                isHidden: false,
                                start: arrowStart,
                                end: arrowEnd,
                                pathOptions: {
                                    color: drawingStates.strokeColor || 'blue',
                                    weight: 3,
                                },
                            };
                            newLayer.realLifeDistance = map.distance(arrowStart, arrowEnd);
                            setInspectingLayerId(newLayer.uuid);
                        }
                        break;
                    default:
                        return;
                }

                if (newLayer!) {
                    setLayers((prevLayers) => [...prevLayers, newLayer]);
                    setSlideHistory((prev: HistoryStack) => {
                        const newSlideHistory = prev.copy();
                        newSlideHistory.push({
                            type: "NEW_LAYER",
                            layer: {...newLayer},
                        } as NewLayerAction);
                        return newSlideHistory;
                    });

                    if (onShapeCreated && shapeForStats) {
                        onShapeCreated(shapeForStats);
                    }
                }
            }
            setRectBounds(null);
            setRectOrigin(null);
            setCircleCenter(null);
            setCircleRadius(0);
            setArrowStart(null);
            setArrowEnd(null);
        },
    });

    if (drawingStates.isDrawing) {
        map.dragging.disable();
    } else {
        map.dragging.enable();
    }

    if (!rectOrgin && !circleCenter && !arrowStart && !textOrigin) {
        return null;
    }

    return (
        <>
            {rectOrgin && rectBounds && drawingStates.drawingMode === 0 && (
                <Rectangle
                    bounds={rectBounds}
                    pathOptions={{
                        color: drawingStates.strokeColor || 'blue',
                        weight: 2,
                        fillColor: drawingStates.fillColor || 'blue',
                        fillOpacity: drawingStates.fillOpacity || 0.5,
                    }}
                />
            )}
            {circleCenter && circleRadius > 0 && drawingStates.drawingMode === 1 && (
                <Circle
                    center={circleCenter}
                    radius={circleRadius}
                    pathOptions={{
                        color: drawingStates.strokeColor || 'blue',
                        weight: 2,
                        fillColor: drawingStates.fillColor || 'blue',
                        fillOpacity: drawingStates.fillOpacity || 0.5,
                    }}
                />
            )}
            {arrowStart && arrowEnd && drawingStates.drawingMode === 2 && (() => {
                const dx = arrowEnd[1] - arrowStart[1];
                const dy = arrowStart[0] - arrowEnd[0];
                const angle = Math.atan2(dy, dx) * 180 / Math.PI;
                return (
                     <>
                        <Polyline
                            positions={[arrowStart, arrowEnd]}
                            pathOptions={{
                                color: drawingStates.strokeColor || 'blue',
                                weight: 3,
                            }}
                        />
                        <Marker
                            position={arrowEnd}
                            icon={L.divIcon({
                                className: 'arrow-head-marker-preview',
                                html: `<div style="width: 0; height: 0; border-left: 8px solid transparent; border-right: 8px solid transparent; border-bottom: 16px solid ${drawingStates.strokeColor || 'blue'}; transform: rotate(${angle + 90}deg); transform-origin: center;"></div>`,
                                iconSize: [16, 16],
                                iconAnchor: [8, 8]
                            })}
                        />
                    </>
                );
            })()}

            {textOrigin && drawingStates.drawingMode === 3 && (
                 <Marker
                    position={textOrigin}
                    icon={L.divIcon({
                        className: 'text-marker-preview',
                        html: `
                        <div
                          id="text-editable"
                          tabindex="0"
                          contenteditable="true"
                          style="
                            width: 100%;
                            font-size: ${drawingStates.fontSize}px;
                            font-weight: bold;
                            color: ${drawingStates.fillColor};
                            -webkit-text-stroke: 3px ${drawingStates.strokeColor};
                            paint-order: stroke fill;
                            outline: 2px solid #3b82f6;
                          "
                        ></div>
                        `,
                        iconSize: [200, drawingStates.fontSize!],
                        iconAnchor: [50, 15] as PointExpression,
                    })}
                />
            )}
            
             {textOrigin && drawingStates.drawingMode === 3 && (
                <button id="confirm-text" className="bg-slate-700 px-4 py-3 text-sm rounded-sm text-white hover:bg-slate-900 font-bold absolute z-1000 right-0 m-4">
                    ✓ Confirm
                </button>
            )}
        </>
    );
});

DrawingLayer.displayName = "DrawingLayer";

export default DrawingLayer;