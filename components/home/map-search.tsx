"use client";

import { useState, useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import { Search, MapPin, Loader2, X } from 'lucide-react';

interface NominatimResult {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  type: string;
}

export const MapSearch = () => {
  const map = useMap();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.length < 3) {
      setResults([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setLoading(true);
      setIsOpen(true);
      try {
        const params = new URLSearchParams({
          q: query,
          format: 'json',
          addressdetails: '1',
          limit: '5',
          countrycodes: 'vn', 
        });

        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?${params.toString()}`
        );
        
        const data = await response.json();
        setResults(data);
      } catch (error) {
        console.error("Lỗi tìm kiếm:", error);
      } finally {
        setLoading(false);
      }
    }, 800); 

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectLocation = (item: NominatimResult) => {
    const lat = parseFloat(item.lat);
    const lon = parseFloat(item.lon);
    map.flyTo([lat, lon], 16, {
      duration: 1.5,
    });
    setQuery(item.display_name.split(',')[0]);
    
    setIsOpen(false);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
  };

  return (
    <div ref={wrapperRef} className="absolute top-4 left-16 z-[1000] w-80 font-sans">
      {/* Input Box */}
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
        </div>
        
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
             if (results.length > 0) setIsOpen(true);
          }}
          placeholder="Tìm địa điểm (VD: Hồ Gươm)..."
          className="block w-full pl-10 pr-10 py-2.5 bg-white border border-slate-300 rounded-lg leading-5 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-md sm:text-sm transition-all"
        />

        {query && (
          <button
            onClick={handleClear}
            className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer text-slate-400 hover:text-slate-600"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {isOpen && (loading || results.length > 0) && (
        <div className="absolute mt-2 w-full bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden max-h-[60vh] overflow-y-auto animate-in fade-in slide-in-from-top-2">
          
          {loading && (
            <div className="p-4 flex items-center justify-center text-slate-500 text-sm gap-2">
              <Loader2 className="animate-spin" size={16} />
              Đang tìm kiếm...
            </div>
          )}

          {!loading && results.map((item) => (
            <button
              key={item.place_id}
              onClick={() => handleSelectLocation(item)}
              className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-slate-100 last:border-none transition-colors flex items-start gap-3 group"
            >
              <MapPin 
                size={18} 
                className="mt-0.5 flex-shrink-0 text-slate-400 group-hover:text-blue-500" 
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-700 truncate group-hover:text-blue-700">
                  {item.display_name.split(',')[0]}
                </p>
                <p className="text-xs text-slate-500 truncate mt-0.5">
                  {item.display_name.split(',').slice(1).join(',')}
                </p>
              </div>
            </button>
          ))}
          
          {!loading && results.length === 0 && query.length >= 3 && (
            <div className="p-4 text-center text-slate-500 text-sm">
              Không tìm thấy kết quả nào.
            </div>
          )}
        </div>
      )}
    </div>
  );
};