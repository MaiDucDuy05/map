import { Marker, Popup, Rectangle, Circle, Polyline, SVGOverlay } from "react-leaflet";
import L, { LatLngTuple } from 'leaflet';
import { useContext } from "react";
import { LayersContext, PresentationContext } from "@/app/page";
import { CircleLayer, ArrowLayer } from "@/types/layer";

export default function InspectingLayer() {
    const { inspectingLayerId, isPresenting } = useContext(PresentationContext);
    const { layers } = useContext(LayersContext);

    if (isPresenting) {
        return null;
    }

    if (!inspectingLayerId) {
        return null;
    }
    const layer = layers.find(l => l.uuid === inspectingLayerId);
    if (!layer) {
        return null;
    }

    switch (layer.type) {
        case "rectangle":
            const layerBounds = layer.bounds as [LatLngTuple, LatLngTuple];
            const corners = {
                topLeft: [layerBounds[0][0], layerBounds[0][1]],
                topRight: [layerBounds[0][0], layerBounds[1][1]],
                bottomLeft: [layerBounds[1][0], layerBounds[0][1]],
                bottomRight: [layerBounds[1][0], layerBounds[1][1]],
            };

            const areaDisplay = layer.realLifeArea! < 10000
                ? `${layer.realLifeArea!.toFixed(1)} m²`
                : `${(layer.realLifeArea! / 10000).toFixed(2)} ha`;

            return (
                <>
                    <Rectangle
                        key={layer.uuid}
                        bounds={layerBounds}
                        pathOptions={{
                            color: '#3b82f6',
                            weight: 2,
                            fillColor: '#3b82f6',
                        }}
                    >
                    <SVGOverlay bounds={layerBounds}>
                        <g>
                            <rect
                                x="50%"
                                y="50%"
                                width="100"
                                height="30"
                                fill="white"
                                fillOpacity="0.8"
                                stroke="#3b82f6"
                                strokeWidth="1"
                                transform="translate(-50, -15)"
                            />
                            <text
                                x="50%"
                                y="50%"
                                dominantBaseline="middle"
                                textAnchor="middle"
                                fill="#3b82f6"
                                fontSize="16"
                                fontWeight="bold"
                            >
                                {areaDisplay}
                            </text>
                        </g>
                    </SVGOverlay>

                        </Rectangle>

                    {Object.entries(corners).map(([position, coord], idx) => (
                        <Marker
                            key={`corner-${idx}`}
                            position={coord as LatLngTuple}
                            icon={L.divIcon({
                                className: 'custom-corner-marker',
                                html: `<div style="
                                    width: 8px;
                                    height: 8px;
                                    background-color: white;
                                    border: 1px solid #3b82f6;
                                    outline: 1px solid white;
                                "></div>`,
                                iconSize: [8, 8],
                                iconAnchor: [4, 4]
                            })}
                        >
                            <Popup>
                                <div className="text-xs font-mono">
                                    <div>Lat: {(coord as LatLngTuple)[0].toFixed(6)}</div>
                                    <div>Lng: {(coord as LatLngTuple)[1].toFixed(6)}</div>
                                </div>
                            </Popup>
                        </Marker>
                    ))}
                </>
            );

        case "circle":
            const circleLayer = layer as CircleLayer;
            const circleAreaDisplay = layer.realLifeArea! < 10000
                ? `${layer.realLifeArea!.toFixed(1)} m²`
                : `${(layer.realLifeArea! / 10000).toFixed(2)} ha`;

            const radiusDisplay = circleLayer.radius < 1000
                ? `R: ${circleLayer.radius.toFixed(1)}m`
                : `R: ${(circleLayer.radius / 1000).toFixed(2)}km`;

            return (
                <>
                    <Circle
                        key={layer.uuid}
                        center={circleLayer.center}
                        radius={circleLayer.radius}
                        pathOptions={{
                            color: '#3b82f6',
                            weight: 2,
                            fillColor: '#3b82f6',
                            fillOpacity: 0.2,
                        }}
                    >
                        <SVGOverlay bounds={[
                            [circleLayer.center[0] - 0.001, circleLayer.center[1] - 0.001],
                            [circleLayer.center[0] + 0.001, circleLayer.center[1] + 0.001]
                        ]}>
                            <g>
                                <rect
                                    x="50%"
                                    y="50%"
                                    width="120"
                                    height="40"
                                    fill="white"
                                    fillOpacity="0.8"
                                    stroke="#3b82f6"
                                    strokeWidth="1"
                                    transform="translate(-60, -20)"
                                />
                                <text
                                    x="50%"
                                    y="40%"
                                    dominantBaseline="middle"
                                    textAnchor="middle"
                                    fill="#3b82f6"
                                    fontSize="12"
                                    fontWeight="bold"
                                >
                                    {radiusDisplay}
                                </text>
                                <text
                                    x="50%"
                                    y="60%"
                                    dominantBaseline="middle"
                                    textAnchor="middle"
                                    fill="#3b82f6"
                                    fontSize="12"
                                    fontWeight="bold"
                                >
                                    {circleAreaDisplay}
                                </text>
                            </g>
                        </SVGOverlay>
                        <Marker
                            position={circleLayer.center}
                            icon={L.divIcon({
                                className: 'custom-center-marker',
                                html: `<div style="
                                    width: 8px;
                                    height: 8px;
                                    background-color: #3b82f6;
                                    border: 2px solid white;
                                    border-radius: 50%;
                                    outline: 1px solid #3b82f6;
                                "></div>`,
                                iconSize: [12, 12],
                                iconAnchor: [6, 6]
                            })}
                        >
                            <Popup>
                                <div className="text-xs font-mono">
                                    <div>Center: {circleLayer.center[0].toFixed(6)}, {circleLayer.center[1].toFixed(6)}</div>
                                    <div>Radius: {circleLayer.radius.toFixed(1)} m</div>
                                    <div>Area: {circleAreaDisplay}</div>
                                </div>
                            </Popup>
                        </Marker>
                    </Circle>
                </>
            );

        case "arrow":
            const arrowLayer = layer as ArrowLayer;

            // Calculate arrow direction
            const dx = arrowLayer.end[1] - arrowLayer.start[1];
            const dy = arrowLayer.start[0] - arrowLayer.end[0];
            const angle = Math.atan2(dy, dx) * 180 / Math.PI; // Convert to degrees for CSS rotation

            const distance = arrowLayer.realLifeDistance!;
            const distanceDisplay = distance < 1000
                ? `${distance.toFixed(1)} m`
                : `${(distance / 1000).toFixed(2)} km`;

            return (
                <>
                    <Polyline
                        key={`${layer.uuid}-line`}
                        positions={[arrowLayer.start, arrowLayer.end]}
                        pathOptions={{
                            color: '#3b82f6',
                            weight: 3,
                        }}
                    >
                        <Marker
                            position={arrowLayer.end}
                            icon={L.divIcon({
                                className: 'arrow-head-marker-inspection',
                                html: `<div style="
                                    width: 0;
                                    height: 0;
                                    border-left: 10px solid transparent;
                                    border-right: 10px solid transparent;
                                    border-bottom: 20px solid #3b82f6;
                                    transform: rotate(${angle + 90}deg);
                                    transform-origin: center;
                                "></div>`,
                                iconSize: [20, 20],
                                iconAnchor: [10, 10]
                            })}
                        />
                        <SVGOverlay bounds={[arrowLayer.start, arrowLayer.end]}>
                            <g>
                                <rect
                                    x="50%"
                                    y="50%"
                                    width="80"
                                    height="25"
                                    fill="white"
                                    fillOpacity="0.8"
                                    stroke="#3b82f6"
                                    strokeWidth="1"
                                    transform="translate(-40, -12)"
                                />
                                <text
                                    x="50%"
                                    y="50%"
                                    dominantBaseline="middle"
                                    textAnchor="middle"
                                    fill="#3b82f6"
                                    fontSize="14"
                                    fontWeight="bold"
                                >
                                    {distanceDisplay}
                                </text>
                            </g>
                        </SVGOverlay>
                        <Marker
                            position={arrowLayer.start}
                            icon={L.divIcon({
                                className: 'custom-arrow-marker',
                                html: `<div style="
                                    width: 8px;
                                    height: 8px;
                                    background-color: #3b82f6;
                                    border: 2px solid white;
                                    border-radius: 50%;
                                "></div>`,
                                iconSize: [12, 12],
                                iconAnchor: [6, 6]
                            })}
                        >
                            <Popup>
                                <div className="text-xs font-mono">
                                    <div>Start: {arrowLayer.start[0].toFixed(6)}, {arrowLayer.start[1].toFixed(6)}</div>
                                    <div>End: {arrowLayer.end[0].toFixed(6)}, {arrowLayer.end[1].toFixed(6)}</div>
                                    <div>Distance: {distanceDisplay}</div>
                                </div>
                            </Popup>
                        </Marker>
                    </Polyline>
                </>
            );

        case "text":
            return (
                <Marker
                    key={layer.uuid}
                    position={layer.textPosition}
                    icon={L.divIcon({
                        className: 'text-marker',
                        html: `
                            <div
                                style="
                                    width: 100%;
                                    font-size: ${layer.fontSize}px;
                                    font-weight: bold;
                                    color: transparent;
                                    -webkit-text-stroke: 2px transparent;
                                    paint-order: stroke fill;
                                    outline: 2px solid #3b82f6;
                                "
                            >
                                ${layer.textContent}
                            </div>
                        `,
                        iconSize: [200, layer.fontSize],
                        iconAnchor: [50, 15]
                    })}
                >
                    <Popup>
                        <div className="text-xs font-mono">
                            <div>Text: {layer.textContent}</div>
                            <div>Position: {layer.textPosition[0].toFixed(6)}, {layer.textPosition[1].toFixed(6)}</div>
                        </div>
                    </Popup>
                </Marker>
            );

        default:
            return null;
    }
}