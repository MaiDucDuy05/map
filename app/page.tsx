"use client"

import Toolbar from "@/components/home/toolbar";
import { cn } from "@/lib/utils";
import { Layer } from "@/types/layer";
import dynamic from "next/dynamic";
import {  useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HistoryStack } from "./history-stack";
import { Action } from "@/types/history-stack";
import Sidebar from "@/components/home/sidebar";
import SlidesControl from "@/components/home/slides-control";
import { DrawingStates, DrawingStatesContext, HistoryContext, LayersContext, PresentationContext, SlidesControlContext } from "./contexts";


const LazyMap = dynamic(() => import("@/components/home/map"), {
  ssr: false,
});


class Slide {
  layers: Layer[] = [];
  latLng: [number, number] = [21.03, 105.804];
  mapZoom: number = 16;
  slideHistory: HistoryStack = new HistoryStack();
  slideThumbnail?: string | null = null;
};



export default function Home() {
  // SLIDES CONTROL
  const slideThumbnailRef = useRef<HTMLImageElement | null>(null);
  const [slides, setSlides] = useState<Slide[]>([new Slide()]);
  const [previousSlideIndex, setPreviousSlideIndex] = useState<number>(-1);
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);
  const [mapViewWorkaround, setMapViewWorkaround] = useState<number>(0);

  // CURRENT SLIDE
  const [layers, setLayers] = useState<Layer[]>([]);
  const [drawingStates, setDrawingStates] = useState<DrawingStates>({
    isDrawing: false,
    drawingMode: -1,
    strokeColor: "#000000",
    fillColor: "#FFFFFF",
    fillOpacity: 0.2,
    fontSize: 20,
  });
  const [isPresenting, setIsPresenting] = useState<boolean>(false);
  const [currentLayerIndex, setCurrentLayerIndex] = useState<number>(-1);
  const [inspectingLayerId, setInspectingLayerId] = useState<string | null>(null);
  const [slideHistory, setSlideHistory] = useState<HistoryStack>(new HistoryStack());

  const resetSlide = () => {
    setDrawingStates({
      isDrawing: false,
      drawingMode: -1,
      strokeColor: "#000000",
      fillColor: "#FFFFFF",
      fillOpacity: 0.2,
      fontSize: 20,
    });
    setCurrentLayerIndex(-1);
    setInspectingLayerId(null);
  };

  useEffect(() => {
    resetSlide();
    const newSlides = [...slides];
    if (currentSlideIndex >= newSlides.length) {
      newSlides.push(new Slide());
    }
    const currentSlide = newSlides[currentSlideIndex];
    if (currentSlide) {
      setLayers(currentSlide.layers);
      setSlideHistory(currentSlide.slideHistory);
      setMapViewWorkaround(prev => prev + 1);
    }
    setSlides(newSlides);
  }, [currentSlideIndex]);

  useEffect(() => {
    if (currentSlideIndex < slides.length) {
      setSlides((prevSlides) => {
        const updatedSlides = [...prevSlides];
        updatedSlides[currentSlideIndex] = {
          ...updatedSlides[currentSlideIndex],
          layers: layers,
          slideHistory: slideHistory,
        };
        return updatedSlides;
      });
    }
  }, [layers, slideHistory]);

  // const lastScreenshotTime = useRef<number>(0);
  // useEffect(() => {
  //   if (Date.now() - lastScreenshotTime.current < 200) {
  //     return;
  //   }
  //   if (slideThumbnailRef.current) {
  //     domtoimage.toJpeg(slideThumbnailRef.current, { quality: 0.1 }).then((dataUrl) => {
  //       lastScreenshotTime.current = Date.now();
  //       setSlides((prevSlides) => {
  //         const updatedSlides = [...prevSlides];
  //         updatedSlides[currentSlideIndex] = {
  //           ...updatedSlides[currentSlideIndex],
  //           slideThumbnail: dataUrl,
  //         };
  //         return updatedSlides;
  //       });
  //     }).catch((error) => {
  //       console.error("Error generating slide thumbnail:", error);
  //     });
  //   }
  // }, [layers, latLng, mapZoom]);

  const undo = useCallback(() => {
    const lastAction: (Action | null) = slideHistory.undo();
    if (lastAction) {
      switch (lastAction.type) {
        case "NEW_LAYER":
          setLayers((prevLayers) => prevLayers.filter(layer => layer.uuid !== lastAction.layer!.uuid));
          break;
        case "DELETE_LAYER":
          setLayers((prevLayers) => {
            const newLayers = [...prevLayers];
            newLayers.splice(lastAction.oldIndex!, 0, lastAction.layer!);
            return newLayers;
          });
          break;
        case "PIN_LAYER":
          setLayers((prevLayers) =>
            prevLayers.map(layer =>
              layer.uuid === lastAction.layerId
                ? { ...layer, isPinned: false }
                : layer
            )
          );
          break;
        case "UNPIN_LAYER":
          setLayers((prevLayers) =>
            prevLayers.map(layer =>
              layer.uuid === lastAction.layerId
                ? { ...layer, isPinned: true }
                : layer
            )
          );
          break;
        case "HIDE_LAYER":
          setLayers((prevLayers) =>
            prevLayers.map(layer =>
              layer.uuid === lastAction.layerId
                ? { ...layer, isHidden: false }
                : layer
            )
          );
          break;
        case "UNHIDE_LAYER":
          setLayers((prevLayers) =>
            prevLayers.map(layer =>
              layer.uuid === lastAction.layerId
                ? { ...layer, isHidden: true }
                : layer
            )
          );
          break;
        case "REORDER_LAYER":
          setLayers((prevLayers) => {
            const newLayers = [...prevLayers];
            const movedLayer = newLayers.splice(lastAction.newIndex!, 1)[0];
            newLayers.splice(lastAction.oldIndex!, 0, movedLayer);
            return newLayers;
          });
          break;
      }
    }
  }, [slideHistory.currentIndex]);

  const redo = useCallback(() => {
    const lastAction: (Action | null) = slideHistory.redo();
    if (lastAction) {
      switch (lastAction.type) {
        case "NEW_LAYER":
          setLayers((prevLayers) => [...prevLayers, lastAction.layer!]);
          break;
        case "DELETE_LAYER":
          setLayers((prevLayers) => prevLayers.filter(layer => layer.uuid !== lastAction.layer!.uuid));
          break;
        case "PIN_LAYER":
          setLayers((prevLayers) =>
            prevLayers.map(layer =>
              layer.uuid === lastAction.layerId
                ? { ...layer, isPinned: true }
                : layer
            )
          );
          break;
        case "UNPIN_LAYER":
          setLayers((prevLayers) =>
            prevLayers.map(layer =>
              layer.uuid === lastAction.layerId
                ? { ...layer, isPinned: false }
                : layer
            )
          );
          break;
        case "HIDE_LAYER":
          setLayers((prevLayers) =>
            prevLayers.map(layer =>
              layer.uuid === lastAction.layerId
                ? { ...layer, isHidden: true }
                : layer
            )
          );
          break;
        case "UNHIDE_LAYER":
          setLayers((prevLayers) =>
            prevLayers.map(layer =>
              layer.uuid === lastAction.layerId
                ? { ...layer, isHidden: false }
                : layer
            )
          );
          break;
        case "REORDER_LAYER":
          setLayers((prevLayers) => {
            const newLayers = [...prevLayers];
            const movedLayer = newLayers.splice(lastAction.oldIndex!, 1)[0];
            newLayers.splice(lastAction.newIndex!, 0, movedLayer);
            return newLayers;
          });
          break;
      }
    }
  }, [slideHistory.currentIndex]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsPresenting(false);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    const handleNextPresentingLayer = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") {
        setCurrentLayerIndex((prev) => {
          let nextId: number = prev + 1;
          while (nextId + 1 < layers.length && (layers[nextId].isPinned || layers[nextId].isHidden)) {
            nextId++;
          }
          if (nextId >= layers.length) {
            nextId = layers.length - 1;
          }
          return nextId;
        });
      } else if (event.key === "ArrowLeft") {
        setCurrentLayerIndex((prev) => {
          let nextId: number = prev - 1;
          while (nextId - 1 >= 0 && (layers[nextId].isPinned || layers[nextId].isHidden)) {
            nextId--;
          }
          if (nextId < 0) {
            nextId = -1;
          }
          return nextId;
        });
      }
    }
    if (isPresenting) {
      document.addEventListener("keydown", handleNextPresentingLayer);
    } else {
      document.removeEventListener("keydown", handleNextPresentingLayer);
    }

    return () => {
      document.removeEventListener("keydown", handleNextPresentingLayer);
    };
  }, [isPresenting, layers]);

  useEffect(() => {
    const handleUndoRedo = (event: KeyboardEvent) => {
      if (event.ctrlKey) {
        if (event.key === "z") {
          undo();
        } else if (event.key === "y") {
          console.log("Redoing action");
          redo();
        }
        event.preventDefault();
      }
    };
    document.addEventListener("keydown", handleUndoRedo);
    return () => {
      document.removeEventListener("keydown", handleUndoRedo);
    }
  }, [slideHistory]);

  const slidesControlValue = useMemo(() => ({
    slides,
    currentSlideIndex,
    previousSlideIndex,
    setSlides,
    setCurrentSlideIndex,
    setPreviousSlideIndex,
  }), [slides, currentSlideIndex, previousSlideIndex]);

  const presentationValue = useMemo(() => ({
    isPresenting,
    setIsPresenting,
    currentLayerIndex,
    setCurrentLayerIndex,
    inspectingLayerId,
    setInspectingLayerId,
  }), [isPresenting, currentLayerIndex, inspectingLayerId]);

  const historyValue = useMemo(() => ({
    slideHistory,
    setSlideHistory,
    undo,
    redo,
  }), [slideHistory, undo, redo]);

  const layersValue = useMemo(() => ({
    layers,
    setLayers,
  }), [layers]);

  const drawingStatesValue = useMemo(() => ({
    drawingStates,
    setDrawingStates,
  }), [drawingStates]);

  return (
    <>
     {/* <div className="flex flex-col flex-1 h-screen">
        <DrawingStatesContext.Provider value={ drawingStatesValue }>
          <Toolbar />
            <div className={cn("mx-auto w-full h-full z-1 select-none", isPresenting ? "fixed top-0 left-0 z-20" : "relative")} ref={slideThumbnailRef}>
              <LazyMap mapViewWorkaround={mapViewWorkaround} />
            </div>
        </DrawingStatesContext.Provider>
      </div> */}
      <SlidesControlContext.Provider value={slidesControlValue}>
        <LayersContext.Provider value={ layersValue }>
            <PresentationContext.Provider value={ presentationValue }>
              <HistoryContext.Provider value={ historyValue }>
                  <div className="flex flex-row mx-auto">
                    <SlidesControl />
                    <div className="flex flex-col flex-1 h-screen">
                      <DrawingStatesContext.Provider value={ drawingStatesValue }>
                        <Toolbar />
                          <div className={cn("mx-auto w-full h-full z-1 select-none", isPresenting ? "fixed top-0 left-0 z-20" : "relative")} ref={slideThumbnailRef}>
                            <LazyMap mapViewWorkaround={mapViewWorkaround} />
                          </div>
                      </DrawingStatesContext.Provider>
                    </div>
                    <Sidebar />
                  </div>
              </HistoryContext.Provider>
            </PresentationContext.Provider>
        </LayersContext.Provider>
      </SlidesControlContext.Provider>
    </>
  );
}

