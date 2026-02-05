import { Marker, Rectangle, Circle, Polyline } from "react-leaflet";
import L, { } from 'leaflet';
import { CircleLayer, ArrowLayer, Layer } from "@/types/layer";
import { memo, useContext } from "react";
import { LayersContext, PresentationContext } from "@/app/page";

const ObjectLayer = memo(({
    layer,
    wasPresented,
} : {
    layer: Layer,
    wasPresented: boolean,
}) => {
    if (layer.isHidden) {
        return null;
    }
    if (!layer.isPinned && !wasPresented) {
        return null;
    }

    switch (layer.type) {
        case "rectangle":
            return (
                <Rectangle
                    key={layer.uuid}
                    bounds={layer.bounds}
                    pathOptions={layer.pathOptions}
                />
            );

        case "circle":
            const circleLayer = layer as CircleLayer;
            return (
                <Circle
                    key={layer.uuid}
                    center={circleLayer.center}
                    radius={circleLayer.radius}
                    pathOptions={circleLayer.pathOptions}
                />
            );

        case "arrow":
            const arrowLayer = layer as ArrowLayer;

            // Calculate arrow direction
            const dx = arrowLayer.end[1] - arrowLayer.start[1];
            const dy = arrowLayer.start[0] - arrowLayer.end[0];
            const angle = Math.atan2(dy, dx) * 180 / Math.PI; // Convert to degrees for CSS rotation

            return (
                <div key={layer.uuid}>
                    <Polyline
                        positions={[arrowLayer.start, arrowLayer.end]}
                        pathOptions={arrowLayer.pathOptions}
                    />
                    <Marker
                        position={arrowLayer.end}
                        icon={L.divIcon({
                            className: 'arrow-head-marker',
                            html: `<div style="
                                width: 0;
                                height: 0;
                                border-left: 8px solid transparent;
                                border-right: 8px solid transparent;
                                border-bottom: 16px solid ${arrowLayer.pathOptions?.color || '#000'};
                                transform: rotate(${angle + 90}deg);
                                transform-origin: center;
                            "></div>`,
                            iconSize: [16, 16],
                            iconAnchor: [8, 8]
                        })}
                    />
                </div>
            );

        case "text":
            console.log("eyye")
            console.log(layer)
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
                            color: ${layer.textColor};
                            -webkit-text-stroke: 3px ${layer.textStrokeColor};
                            paint-order: stroke fill;
                          "
                    >${layer.textContent}</div>
                        `,
                        iconSize: [200, layer.fontSize],
                        iconAnchor: [50, 15],
                    })}
                />
            );
        default:
            return null;
    }
});

const Layers = memo(() => {
  const { currentLayerIndex, isPresenting, } = useContext(PresentationContext);
  const { layers } = useContext(LayersContext);

  return (
    <>
        {layers.map((layer, index) => (
            <ObjectLayer
                key={layer.uuid}
                layer={layer}
                wasPresented={!(isPresenting && index > currentLayerIndex)}
            />
        ))}
    </>
  )
});

export default Layers;