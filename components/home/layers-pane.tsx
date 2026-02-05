// components/LayersPane.tsx
import { Layer } from "@/types/layer";
import { cn } from "@/lib/utils";
import { ArrowRight, ChevronDown, ChevronUp, Circle, Eye, EyeOff, Pin, PinOff, Square, Trash2, Type } from "lucide-react";
import { JSX, memo, useCallback, useContext, useState } from "react";
import { HistoryContext, LayersContext, PresentationContext } from "@/app/page";
import { DeleteLayerAction } from "@/types/history-stack";
import { LayerInfoPanel } from "./layer-info-panel";

const LayerItemRow = memo(function({
  layer,
  index,
  isSelected,
  isDraggedOver,
  isExpanded,
  onClick,
  onToggleLock,
  onToggleHide,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
  onExpand,
} : {
  layer: Layer,
  index: number,
  isSelected: boolean,
  isDraggedOver: boolean,
  isExpanded: boolean,
  onClick: any,
  onToggleLock: any,
  onToggleHide: any,
  onRemove: any,
  onDragStart: any,
  onDragOver: any,
  onDrop: any,
  onExpand: any,
}) {
  let layerIcon: JSX.Element;
  switch (layer.type) {
    case "rectangle":
      layerIcon = <Square size={16} />;
      break;
    case "circle":
      layerIcon = <Circle size={16} />;
      break;
    case "arrow":
      layerIcon = <ArrowRight size={16} />;
      break;
    case "text":
      layerIcon = <Type size={16} />;
      break;
    default:
      layerIcon = <Square size={16} />;
      break;
  }

  return (
    <div
      className={cn("border-b border-slate-500", isDraggedOver && "border-t-2 border-t-slate-300")}
      draggable={true}
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={(e) => onDrop(e, index)}
    >
      <button
        className={cn(
          "flex flex-row justify-between items-center p-3 w-full bg-slate-700 cursor-pointer hover:bg-slate-650 transition-colors",
          isSelected && "bg-slate-800",
        )}
        onClick={(e) => onClick(e, layer.uuid)}
      >
        <div className="flex flex-row items-center gap-2 text-sm">
          {layerIcon}
          <span className="font-mono">{index} {layer.type}_{layer.uuid.slice(0,5)}</span>
        </div>
        <div className="flex flex-row items-center gap-2">
          <div
            className="cursor-pointer hover:bg-slate-600 p-1 rounded transition-colors"
            onClick={(e) => onExpand(e, layer.uuid)}
            title="Toggle layer info"
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
          <div
            className="cursor-pointer hover:bg-slate-600 p-1 rounded transition-colors"
            onClick={(e) => onToggleLock(e, layer.uuid)}
            title={layer.isPinned ? "Unpin layer" : "Pin layer"}
          >
            {layer.isPinned ? <PinOff size={16} /> : <Pin size={16} />}
          </div>
          <div
            className="cursor-pointer hover:bg-slate-600 p-1 rounded transition-colors"
            onClick={(e) => onToggleHide(e, layer.uuid)}
            title={layer.isHidden ? "Show layer" : "Hide layer"}
          >
            {layer.isHidden ? <EyeOff size={16} /> : <Eye size={16} />}
          </div>
          <div
            className="cursor-pointer hover:bg-red-600 p-1 rounded transition-colors"
            onClick={(e) => onRemove(e, layer.uuid)}
            title="Remove layer"
          >
            <Trash2 size={16} />
          </div>
        </div>
      </button>

      {isExpanded && (
        <LayerInfoPanel layer={layer} isSelected={isSelected} />
      )}
    </div>
  );
});

export default function LayersPane() {
  const { layers, setLayers } = useContext(LayersContext);
  const { inspectingLayerId, setInspectingLayerId } = useContext(PresentationContext);
  const { setSlideHistory } = useContext(HistoryContext);
  const [dragStartIndex, setDragStartIndex] = useState<number | null>(null);
  const [draggedOverIndex, setDraggedOverIndex] = useState<number | null>(null);
  const [expandedLayers, setExpandedLayers] = useState<Record<string, boolean>>({});


  const handleSelectRow = useCallback((e: any, layerId: string) => {
    e.stopPropagation();
    setInspectingLayerId(layerId);
  }, [setInspectingLayerId]);

  const toggleLockLayer = useCallback((e: React.MouseEvent<HTMLDivElement, MouseEvent>, layerId: string) => {
    e.stopPropagation();

    let count:number = 0;
    setLayers(prev => {
      const index = prev.findIndex(layer => layer.uuid === layerId);
      if (index === -1) return prev;
      const newLayers = [...prev];
      const targetLayer = newLayers[index];
      newLayers[index] = {
        ...targetLayer,
        isPinned: !targetLayer.isPinned,
      };

      if (count === 0) {
        setSlideHistory(prev => {
          const newSlideHistory = prev.copy();
          newSlideHistory.push({
            type: targetLayer.isPinned ? "UNPIN_LAYER" : "PIN_LAYER",
            layerId: layerId,
          });
          return newSlideHistory;
        });
        count++;
      }
      return newLayers;
    });
  }, [setLayers, setSlideHistory]);

  const toggleHideLayer = useCallback((e: React.MouseEvent<HTMLDivElement, MouseEvent>, layerId: string) => {
    e.stopPropagation();

    let count:number = 0;
    setLayers(prevLayers => {
      const index = prevLayers.findIndex(layer => layer.uuid === layerId);
      if (index === -1) return prevLayers;
      const newLayers = [...prevLayers];
      const targetLayer = newLayers[index];
      newLayers[index] = {
        ...targetLayer,
        isHidden: !targetLayer.isHidden,
      };

      if (count === 0) {
        setSlideHistory(prev => {
          const newSlideHistory = prev.copy();
          newSlideHistory.push({
            type: targetLayer.isHidden ? "UNHIDE_LAYER" : "HIDE_LAYER",
            layerId: layerId,
          });
          return newSlideHistory;
        });
        count++;
      }
      return newLayers;
    });
  }, [setLayers, setSlideHistory]);

  const removeLayer = useCallback((e: React.MouseEvent<HTMLDivElement, MouseEvent>, layerId: string) => {
    e.stopPropagation();

    let count:number = 0;
    setLayers(prevLayers => {
      const index = prevLayers.findIndex(layer => layer.uuid === layerId);
      const targetLayer = prevLayers[index];

      if (count === 0) {
        setSlideHistory(prev => {
          const newSlideHistory = prev.copy();
          newSlideHistory.push({
            type: "DELETE_LAYER",
            layer: {...targetLayer},
            oldIndex: index,
          } as DeleteLayerAction);
          return newSlideHistory;
        });
        count++;
      }

      const newLayers = [...prevLayers];
      newLayers.splice(index, 1);
      return newLayers;
    });
  }, [setLayers, setSlideHistory]);

  const toggleLayerInfo = useCallback((e: React.MouseEvent<HTMLDivElement, MouseEvent>, layerId: string) => {
    e.stopPropagation();
    setExpandedLayers(prev => ({
      ...prev,
      [layerId]: !prev[layerId]
    }));
  }, []);

  const handleDragStart = useCallback((e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDragStartIndex(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    setDraggedOverIndex(index);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();

    setSlideHistory(prev => {
      const newSlideHistory = prev.copy();
      newSlideHistory.push({
        type: "REORDER_LAYER",
        oldIndex: dragStartIndex!,
        newIndex: index
      });
      return newSlideHistory;
    });

    setLayers(prevLayers => {
      const newLayers = [...prevLayers];
      const reorderedLayer = newLayers.splice(dragStartIndex!, 1)[0];
      newLayers.splice(index, 0, reorderedLayer);
      return newLayers;
    });
    setDragStartIndex(null);
    setDraggedOverIndex(null);
  }, [dragStartIndex, setLayers, setSlideHistory]);

  return (
    <>
      <p className="text-white text-2xl m-2 font-semibold">Layers</p>
      <div className="overflow-y-auto h-full">
        {layers.length === 0 ? (
          <div className="text-slate-400 text-sm text-center p-4">
            No layers yet. Draw something on the map!
          </div>
        ) : (
          layers.map((layer, index) =>
            <LayerItemRow
              key={layer.uuid}
              layer={layer}
              index={index}
              onClick={handleSelectRow}
              onToggleLock={toggleLockLayer}
              onToggleHide={toggleHideLayer}
              onRemove={removeLayer}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onExpand={toggleLayerInfo}
              isSelected={inspectingLayerId == layer.uuid}
              isDraggedOver={draggedOverIndex === index}
              isExpanded={expandedLayers[layer.uuid] || false}
            />
          )
        )}
      </div>
    </>
  );
}