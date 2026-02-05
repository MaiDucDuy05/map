import { useContext, useState, useRef, useEffect } from "react";
import { Button } from "../ui/button";
import { DrawingStatesContext, HistoryContext, PresentationContext } from "@/app/page";
import { ArrowBigRight, Check, Circle, Hand, MoveRight, RectangleHorizontal, Redo, Tv, Undo, Palette, ChevronDown, Type } from "lucide-react";
import { cn } from "@/lib/utils";

const basicColors = [
  "#000000", // Black
  "#FFFFFF", // White
  "#FF0000", // Red
  "#00FF00", // Green
  "#0000FF", // Blue
  "#FFFF00", // Yellow
  "#00FFFF", // Cyan
  "#FF00FF", // Magenta
  "#FFA500", // Orange
  "#800080", // Purple
  "#A52A2A", // Brown
  "#808080", // Gray
  "#FF69B4", // Hot Pink
  "#32CD32", // Lime Green
  "#1E90FF", // Dodger Blue
  "#FFD700", // Gold
  "#FF4500", // Red Orange
  "#9400D3"  // Violet
];

interface ColorPickerPopupProps {
  isStroke?: boolean;
  onSelectColor: (color: string) => void;
  currentColor: string;
  onClose: () => void;
}

function ColorPickerPopup({
  isStroke = true,
  onSelectColor,
  currentColor,
  onClose
}: ColorPickerPopupProps) {
  const popupRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={popupRef}
      className="absolute z-50 p-3 bg-slate-800 border border-slate-600 rounded-lg shadow-xl backdrop-blur-sm"
      style={{ top: "calc(100% + 8px)", left: 0 }}
    >
      <div className="flex flex-wrap gap-2 w-[180px]">
        {basicColors.map(color => (
          <button
            key={color}
            className="w-7 h-7 rounded-lg border border-slate-500 hover:scale-110 transition-all duration-200 relative group"
            style={{
              backgroundColor: color,
              borderColor: color === "#FFFFFF" ? "#666" : "transparent",
              boxShadow: currentColor === color ? `0 0 0 2px ${color === "#FFFFFF" ? "#666" : color}` : "none"
            }}
            onClick={() => onSelectColor(color)}
            title={color}
          >
            {currentColor === color && (
              <div className="absolute inset-0 flex justify-center items-center">
                <Check
                  size={16}
                  className={`${color === "#FFFFFF" || color === "#FFFF00" ? "text-black" : "text-white"} drop-shadow-sm`}
                />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

interface ColorButtonProps {
  isStroke?: boolean;
  color: string;
  onClick: () => void;
}

function ColorButton({ isStroke = true, color, onClick }: ColorButtonProps) {
  const colorDisplay = color;

  // Determine arrow color based on background brightness for better contrast
  const lightColorsForArrowContrast = [
    "#FFFFFF", "#FFFF00", // White, Yellow
    "#00FF00", "#32CD32", // Green, Lime Green
    "#00FFFF",             // Cyan
    "#FF69B4",             // Hot Pink
    "#FFD700",             // Gold
    "#FFA500"              // Orange
  ];
  const arrowColorClass = lightColorsForArrowContrast.includes(colorDisplay.toUpperCase())
    ? "text-slate-700"
    : "text-slate-200";

  return (
    <Button
      onClick={onClick}
      title={isStroke ? "Stroke" : "Fill"}
      className="bg-transparent! px-0"
    >
      <span className={`font-medium`}>{isStroke ? "Stroke:" : "Fill:"}</span>
      <div
        className="relative w-10 h-5 rounded-sm flex items-center justify-end"
        style={{ backgroundColor: colorDisplay }}
      >
        {colorDisplay.toUpperCase() === "#FFFFFF" && (
           <div className="absolute inset-0 w-full h-full rounded-sm" />
        )}
        <ChevronDown size={14} className={`${arrowColorClass} z-10`} />
      </div>
    </Button>
  );
}

function ColorPicker() {
  const { drawingStates, setDrawingStates } = useContext(DrawingStatesContext);
  const [showStrokeColorPicker, setShowStrokeColorPicker] = useState(false);
  const [showFillColorPicker, setShowFillColorPicker] = useState(false);

  const handleStrokeColorSelect = (color: string) => {
    setDrawingStates(prev => ({
      ...prev,
      strokeColor: color,
    }));
    setShowStrokeColorPicker(false);
  };

  const handleFillColorSelect = (color: string) => {
    setDrawingStates(prev => ({
      ...prev,
      fillColor: color,
    }));
    setShowFillColorPicker(false);
  };

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <ColorButton
          isStroke={true}
          color={drawingStates.strokeColor || "#000000"}
          onClick={() => setShowStrokeColorPicker(!showStrokeColorPicker)}
        />
        {showStrokeColorPicker && (
          <ColorPickerPopup
            isStroke={true}
            currentColor={drawingStates.strokeColor || "#000000"}
            onSelectColor={handleStrokeColorSelect}
            onClose={() => setShowStrokeColorPicker(false)}
          />
        )}
      </div>

      <div className="relative">
        <ColorButton
          isStroke={false}
          color={drawingStates.fillColor || "#FFFFFF"}
          onClick={() => setShowFillColorPicker(!showFillColorPicker)}
        />
        {showFillColorPicker && (
          <ColorPickerPopup
            isStroke={false}
            currentColor={drawingStates.fillColor || "#FFFFFF"}
            onSelectColor={handleFillColorSelect}
            onClose={() => setShowFillColorPicker(false)}
          />
        )}
      </div>
    </div>
  );
}

export default function Toolbar() {
  const {
    undo,
    redo,
    slideHistory
  } = useContext(HistoryContext);
  const { drawingStates, setDrawingStates } = useContext(DrawingStatesContext);
  const { setIsPresenting, setCurrentLayerIndex, setInspectingLayerId } = useContext(PresentationContext);

  const handleRect = () => {
    setDrawingStates(prev => ({
      ...prev,
      isDrawing: true,
      drawingMode: 0,
    }));
  };

  const handleCircle = () => {
    setDrawingStates(prev => ({
      ...prev,
      isDrawing: true,
      drawingMode: 1,
    }));
  };

  const handleArrow = () => {
    setDrawingStates(prev => ({
      ...prev,
      isDrawing: true,
      drawingMode: 2,
    }));
  };

  const handleText = () => {
    setDrawingStates(prev => ({
      ...prev,
      isDrawing: true,
      drawingMode: 3,
    }));
  };

  const handleHand = () => {
    setDrawingStates(prev => ({
      ...prev,
      isDrawing: false,
      drawingMode: -1, // Toggle drawing mode
    }));
    setInspectingLayerId(null);
  };

  const handlePresent = () => {
    setIsPresenting(true);
    setCurrentLayerIndex(-1);
    setDrawingStates(prev => ({
      ...prev,
      isDrawing: false,
      drawingMode: -1,
    }));
    document.documentElement.requestFullscreen();
  };

  const activeButtonClass:string = "bg-slate-200 text-slate-900 hover:bg-slate-200 font-bold";

  return (
    <div className="mx-auto p-4 z-10 w-full h-fit bg-slate-700 flex flex-row items-center justify-between">
      <div className="flex flex-row items-center gap-2">
        <Button onClick={handleHand} className={cn(!drawingStates.isDrawing && activeButtonClass)}>
          <Hand size={16} />
          Hand
        </Button>
        <Button onClick={handleRect} className={cn(drawingStates.isDrawing && drawingStates.drawingMode === 0 && activeButtonClass)}>
          <RectangleHorizontal size={16} />
          Rect
        </Button>
        <Button onClick={handleCircle} className={cn(drawingStates.isDrawing && drawingStates.drawingMode === 1 && activeButtonClass)}>
          <Circle size={16} />
          Circle
        </Button>
        <Button onClick={handleArrow} className={cn(drawingStates.isDrawing && drawingStates.drawingMode === 2 && activeButtonClass)}>
          <MoveRight size={16} />
          Arrow
        </Button>
        <Button onClick={handleText} className={cn(drawingStates.isDrawing && drawingStates.drawingMode === 3 && activeButtonClass)}>
          <Type size={16} />
          Text
        </Button>
        <div className="border-l-1 h-6 mx-3 border-slate-500"></div>
        <ColorPicker />
      </div>
      <div className="flex flex-row items-center gap-2">
        <Button onClick={() => undo()} disabled={slideHistory.currentIndex < 0}><Undo size={16}/> Undo</Button>
        <Button onClick={() => redo()} disabled={slideHistory.currentIndex == slideHistory.actions.length - 1}><Redo size={16}/> Redo</Button>
        <Button onClick={handlePresent}>
          <Tv size={16} />
          Present
        </Button>
      </div>
    </div>
  )
}