import { SlidesControlContext } from "@/app/contexts";
import { cn } from "@/lib/utils";
import { useContext, useState, useRef } from "react";
import { Copy, Download, Upload, Trash2, MoreVertical, Plus } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { Button } from "../ui/button";

export default function SlidesControl() {
  const { slides, currentSlideIndex, setCurrentSlideIndex, setPreviousSlideIndex, setSlides } = useContext(SlidesControlContext);
  const [activeDropdown, setActiveDropdown] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDeleteSlide = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (slides.length <= 1) return; 

    const newSlides = slides.filter((_, i) => i !== index);
    setSlides(newSlides);

    if (currentSlideIndex >= index) {
      const newIndex = Math.max(0, currentSlideIndex - 1);
      setPreviousSlideIndex(currentSlideIndex);
      setCurrentSlideIndex(newIndex);
    }
    setActiveDropdown(null);
  };

  const handleCopySlide = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const slideToCopy = slides[index];
    const newSlide = {
      ...slideToCopy,
      layers: slideToCopy.layers.map(layer => ({
        ...layer,
        uuid: uuidv4()
      })),
      slideHistory: slideToCopy.slideHistory.copy(),
      slideThumbnail: slideToCopy.slideThumbnail
    };

    const newSlides = [...slides];
    newSlides.splice(index + 1, 0, newSlide);
    setSlides(newSlides);

    setPreviousSlideIndex(currentSlideIndex);
    setCurrentSlideIndex(index + 1);
    setActiveDropdown(null);
  };

  const handleExportSlide = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const slideToExport = slides[index];
    const dataStr = JSON.stringify(slideToExport, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });

    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `slide-${index + 1}.json`;
    link.click();

    setActiveDropdown(null);
  };

  const handleImportSlide = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/json') {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const importedSlide = JSON.parse(event.target?.result as string);
          // Validate imported slide structure
          if (importedSlide.layers && Array.isArray(importedSlide.layers)) {
            const newSlides = [...slides];
            newSlides.splice(currentSlideIndex + 1, 0, importedSlide);
            setSlides(newSlides);

            setPreviousSlideIndex(currentSlideIndex);
            setCurrentSlideIndex(currentSlideIndex + 1);
          } else {
            alert('Invalid slide format');
          }
        } catch (error) {
          alert(`Error importing slide: Invalid JSON format ${error}`);
        }
      };
      reader.readAsText(file);
    } else {
      alert('Please select a valid JSON file');
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="z-10 bg-slate-600 w-full max-w-70 overflow-y-auto h-screen">
      <div className="flex flex-col items-center gap-2 p-4">
        {slides.map((slide, index) => (
          <div key={index} className="relative w-full group flex flex-row items-center justify-center">
            <div
              className={cn(
                "w-full overflow-hidden bg-slate-700 py-2 px-4 border-0 border-transparent rounded-sm cursor-pointer",
                currentSlideIndex === index && "border-slate-400 bg-slate-200"
              )}
              onClick={() => {
                setPreviousSlideIndex(currentSlideIndex);
                setCurrentSlideIndex(index);
              }}
            >
              <p className={currentSlideIndex === index ? "text-slate-900 font-bold" : "text-white"}>Slide {index + 1}</p>
            </div>

            {/* Dropdown Menu Button */}
            <button
              className="absolute right-2 bg-slate-700 bg-opacity-90 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-800"
              onClick={(e) => {
                e.stopPropagation();
                setActiveDropdown(activeDropdown === index ? null : index);
              }}
            >
              <MoreVertical size={16} />
            </button>

            {/* Dropdown Menu */}
            {activeDropdown === index && (
              <div className="absolute top-8 py-2 right-1 bg-slate-800 border border-slate-600 rounded-sm shadow-lg z-20 min-w-28 overflow-hidden text-sm">
                <button
                  className="w-full px-3 py-1 text-left text-white hover:bg-slate-700 flex items-center"
                  onClick={(e) => handleCopySlide(index, e)}
                >
                  <Copy size={12} className="mr-2" />
                  Copy
                </button>
                <button
                  className="w-full px-3 py-1 text-left text-white hover:bg-slate-700 flex items-center"
                  onClick={(e) => handleExportSlide(index, e)}
                >
                  <Download size={12} className="mr-2" />
                  Export
                </button>
                {slides.length > 1 && (
                  <button
                    className="w-full px-3 py-1 text-left text-red-400 hover:bg-slate-700 flex items-center"
                    onClick={(e) => handleDeleteSlide(index, e)}
                  >
                    <Trash2 size={12} className="mr-2" />
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
        ))}

        <div className="w-full border-t-1 border-slate-500 m-4"></div>

        <div className="flex flex-row gap-2 w-full overflow-hidden">
          {/* Import Button */}
          <Button
            className="cursor-pointer transition-colors duration-200 flex-1"
            onClick={handleImportSlide}
          >
            <Upload size={12} />
            Import
          </Button>

          {/* New Slide Button */}
          <Button
            className="cursor-pointer transition-colors duration-200 flex-1"
            onClick={() => {
              setPreviousSlideIndex(currentSlideIndex);
              setCurrentSlideIndex(slides.length);
            }}
          >
            <Plus size={12} />
            New Slide
          </Button>
        </div>
      </div>

      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      {/* Click outside to close dropdown */}
      {activeDropdown !== null && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setActiveDropdown(null)}
        />
      )}
    </div>
  );
}