"use client"
import { Layer } from "@/types/layer";
import dynamic from "next/dynamic";
import { createContext, Dispatch, SetStateAction } from "react";
import { HistoryStack } from "./history-stack";



export type DrawingStates = {
  isDrawing: boolean,
  drawingMode: number, 
  strokeColor?: string,
  fillColor?: string,
  fillOpacity?: number,
  fontSize?: number,
};

class Slide {
  layers: Layer[] = [];
  latLng: [number, number] = [21.03, 105.804];
  mapZoom: number = 16;
  slideHistory: HistoryStack = new HistoryStack();
  slideThumbnail?: string | null = null;
};

type SlidesControlContextProps = {
  slides: Slide[],
  currentSlideIndex: number,
  previousSlideIndex: number,
  setSlides: Dispatch<SetStateAction<Slide[]>>,
  setCurrentSlideIndex: Dispatch<SetStateAction<number>>,
  setPreviousSlideIndex: Dispatch<SetStateAction<number>>,
};

export const SlidesControlContext = createContext<SlidesControlContextProps>({
  slides: [],
  currentSlideIndex: 0,
  previousSlideIndex: -1,
  setSlides: () => {},
  setCurrentSlideIndex: () => {},
  setPreviousSlideIndex: () => {},
});

// Added separate contexts to reduce unnecessary rerenders
export const LayersContext = createContext<{ layers: Layer[]; setLayers: Dispatch<SetStateAction<Layer[]>> }>(
  { layers: [], setLayers: () => {} }
);
export const DrawingStatesContext = createContext<{ drawingStates: DrawingStates; setDrawingStates: Dispatch<SetStateAction<DrawingStates>> }>(
  { drawingStates: { isDrawing: false, drawingMode: -1, strokeColor: "#000000", fillColor: "#FFFFFF", fillOpacity: 0.2, fontSize: 20 }, setDrawingStates: () => {} }
);
export const PresentationContext = createContext<{ isPresenting: boolean; setIsPresenting: Dispatch<SetStateAction<boolean>>; currentLayerIndex: number; setCurrentLayerIndex: Dispatch<SetStateAction<number>>; inspectingLayerId: string | null; setInspectingLayerId: Dispatch<SetStateAction<string | null>> }>(
  { isPresenting: false, setIsPresenting: () => {}, currentLayerIndex: -1, setCurrentLayerIndex: () => {}, inspectingLayerId: null, setInspectingLayerId: () => {} }
);
export const HistoryContext = createContext<{ slideHistory: HistoryStack; setSlideHistory: Dispatch<SetStateAction<HistoryStack>>; undo: () => void; redo: () => void }>(
  { slideHistory: new HistoryStack(), setSlideHistory: () => {}, undo: () => {}, redo: () => {} }
);