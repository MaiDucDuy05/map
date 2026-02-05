import { Marker, Rectangle, Circle, Polyline, useMapEvents } from "react-leaflet";
import L, { LatLngBoundsExpression, LatLngTuple, PointExpression } from 'leaflet';
import { memo, useContext, useState, useEffect } from "react";
import { DrawingStatesContext, HistoryContext, LayersContext, PresentationContext } from "@/app/page";
import { v4 as uuidv4 } from "uuid";
import { Layer } from "@/types/layer";
import { NewLayerAction } from "@/types/history-stack";
import { HistoryStack } from "@/app/history-stack";

const DrawingLayer = memo(() => {
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

    // autofocus on the contenteditable div when it appears
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
                switch (drawingStates.drawingMode) {
                    case 0: // Rectangle
                        if (rectOrgin && rectBounds) {
                            let rectBounds: LatLngBoundsExpression = [
                                rectOrgin,
                                [e.latlng.lat, e.latlng.lng]
                            ];
                            newLayer = {
                                type: "rectangle",
                                uuid: uuidv4(),
                                isPinned: false,
                                isHidden: false,
                                bounds: rectBounds,
                                pathOptions: {
                                    color: drawingStates.strokeColor || 'blue',
                                    fillColor: drawingStates.fillColor || 'blue',
                                    fillOpacity: drawingStates.fillOpacity || 0.5,
                                },
                            };
                            newLayer.realLifeArea = map.distance(
                                rectBounds[0],
                                [rectBounds[0][0], rectBounds[1][1]]
                            ) * map.distance(
                                rectBounds[0],
                                [rectBounds[1][0], rectBounds[0][1]]
                            );
                            setInspectingLayerId(newLayer.uuid);
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
                    case 2: // Arrow
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
                    // // Create 99 other objects with latlng near to the first object
                    // const LIMIT:number = 99;
                    // let generatedLayers: Layer[] = [];
                    // setLayers((prevLayers) => {
                    //     const newLayers = [newLayer];
                    //     if (newLayer.type === "rectangle" && Array.isArray(newLayer.bounds)) {
                    //         const [origin, corner] = newLayer.bounds as [LatLngTuple, LatLngTuple];
                    //         for (let i = 1; i <= LIMIT; i++) {
                    //             const offset = Math.random() * 0.05 - 0.025; // Random offset between -0.00025 and 0.00025
                    //             const offset2 = Math.random() * 0.05 - 0.025; // Random offset between -0.00025 and 0.00025
                    //             const shiftedOrigin: LatLngTuple = [origin[0] + offset, origin[1] + offset2];
                    //             const shiftedCorner: LatLngTuple = [corner[0] + offset, corner[1] + offset2];
                    //             newLayers.push({
                    //                 ...newLayer,
                    //                 uuid: uuidv4(),
                    //                 bounds: [shiftedOrigin, shiftedCorner],
                    //             });
                    //         }
                    //     } else if (newLayer.type === "circle" && newLayer.center) {
                    //         for (let i = 1; i <= LIMIT; i++) {
                    //             const offset = Math.random() * 0.05 - 0.025;
                    //             const offset2 = Math.random() * 0.05 - 0.025;
                    //             const shiftedCenter: LatLngTuple = [
                    //                 newLayer.center[0] + offset,
                    //                 newLayer.center[1] + offset2,
                    //             ];
                    //             newLayers.push({
                    //                 ...newLayer,
                    //                 uuid: uuidv4(),
                    //                 center: shiftedCenter,
                    //             });
                    //         }
                    //     } else if (newLayer.type === "arrow" && newLayer.start && newLayer.end) {
                    //         for (let i = 1; i <= LIMIT; i++) {
                    //             const offset = Math.random() * 0.05 - 0.025;
                    //             const offset2 = Math.random() * 0.05 - 0.025;
                    //             const shiftedStart: LatLngTuple = [
                    //                 newLayer.start[0] + offset,
                    //                 newLayer.start[1] + offset2,
                    //             ];
                    //             const shiftedEnd: LatLngTuple = [
                    //                 newLayer.end[0] + offset,
                    //                 newLayer.end[1] + offset2,
                    //             ];
                    //             newLayers.push({
                    //                 ...newLayer,
                    //                 uuid: uuidv4(),
                    //                 start: shiftedStart,
                    //                 end: shiftedEnd,
                    //             });
                    //         }
                    //     }
                    //     generatedLayers = [...newLayers];
                    //     return [...prevLayers, ...newLayers];
                    // });
                    // setSlideHistory((prev: HistoryStack) => {
                    //     const newSlideHistory = prev.copy();
                    //     for (const newLayer of generatedLayers) {
                    //         newSlideHistory.push({
                    //             type: "NEW_LAYER",
                    //             layer: { ...newLayer },
                    //         } as NewLayerAction);
                    //     }
                    //     return newSlideHistory;
                    // });
                }
            }

            // Reset all drawing states
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
                const dx = arrowEnd[1] - arrowStart[1]; // longitude difference
                const dy = arrowStart[0] - arrowEnd[0]; // latitude difference (flipped for screen coordinates)
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
                                html: `<div style="
                                    width: 0;
                                    height: 0;
                                    border-left: 8px solid transparent;
                                    border-right: 8px solid transparent;
                                    border-bottom: 16px solid ${drawingStates.strokeColor || 'blue'};
                                    transform: rotate(${angle + 90}deg);
                                    transform-origin: center;
                                "></div>`,
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
            <button id="confirm-text" className="bg-slate-700 px-4 py-3 text-sm rounded-sm text-white hover:bg-slate-900 font-bold absolute z-1000 right-0 m-4">
                ✓ Confirm
            </button>
        </>
    );
});

export default DrawingLayer;