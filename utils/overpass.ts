import { LatLngTuple } from "leaflet";

export interface PoiStat {
  name: string;
  count: number;
  fill: string;
}

export interface PoiDetail {
  id: number;
  name: string;
  category: string; 
  subType: string;  
  lat: number;
  lon: number;
}

export interface PoiResult {
  stats: PoiStat[];
  details: PoiDetail[];
}

const OVERPASS_SERVERS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter"
];

export const fetchPoiStatistics = async (polygon: LatLngTuple[]): Promise<PoiResult> => {
  const polyCoords = polygon
    .map((p) => `${Number(p[0]).toFixed(5)} ${Number(p[1]).toFixed(5)}`)
    .join(" ");

  const query = `
    [out:json][timeout:30];
    (
      nwr["amenity"~"school|university|hospital|clinic|pharmacy|restaurant|cafe|bank|marketplace"](poly:"${polyCoords}");
      nwr["leisure"~"park"](poly:"${polyCoords}");
      nwr["shop"~"supermarket|convenience"](poly:"${polyCoords}");
    );
    out center;
  `;

  let data = null;

  for (const server of OVERPASS_SERVERS) {
    try {
      console.log(`Connecting to Overpass: ${server}...`);
      const response = await fetch(server, {
        method: "POST",
        body: "data=" + encodeURIComponent(query),
      });

      if (response.ok) {
        data = await response.json();
        break;
      } else {
        console.warn(`Server ${server} failed: ${response.status}`);
      }
    } catch (e) {
      console.warn(`Connection error to ${server}`, e);
    }
  }

  if (!data || !data.elements) {
    console.error("All Overpass servers failed or timed out.");
    return { stats: [], details: [] };
  }


  const stats: Record<string, number> = {
    "Trường học": 0, "Y tế": 0, "Ẩm thực": 0, "Mua sắm": 0,
    "Công viên": 0, "Tài chính": 0, "Khác": 0
  };

  const details: PoiDetail[] = [];

  data.elements.forEach((el: any) => {
    const t = el.tags || {};
    const amenity = t.amenity;
    const leisure = t.leisure;
    const shop = t.shop;
    
 
    const name = t["name:vi"] || t.name || t["name:en"] || "Không tên";

  
    const lat = el.lat || el.center?.lat || 0;
    const lon = el.lon || el.center?.lon || 0;

    let category = "Khác";
    let subType = amenity || leisure || shop || "unknown";

    if (['school', 'kindergarten', 'university', 'college'].includes(amenity)) category = "Trường học";
    else if (['hospital', 'clinic', 'doctors', 'pharmacy'].includes(amenity)) category = "Y tế";
    else if (['restaurant', 'cafe', 'fast_food', 'pub'].includes(amenity)) category = "Ẩm thực";
    else if (['bank', 'atm', 'marketplace'].includes(amenity)) category = "Tài chính";
    else if (['park', 'garden', 'playground'].includes(leisure)) category = "Công viên";
    else if (['supermarket', 'convenience'].includes(shop)) category = "Mua sắm";


    stats[category]++;

 
    if (name !== "Không tên") {
      details.push({
        id: el.id,
        name: name,
        category: category,
        subType: subType,
        lat: lat,
        lon: lon
      });
    }
  });

  const colors: Record<string, string> = {
    "Trường học": "#3b82f6", "Y tế": "#ef4444", "Ẩm thực": "#f97316",
    "Mua sắm": "#eab308", "Công viên": "#22c55e", "Tài chính": "#10b981", "Khác": "#94a3b8"
  };

  const formattedStats = Object.entries(stats)
    .filter(([_, count]) => count > 0)
    .map(([name, count]) => ({
      name,
      count,
      fill: colors[name] || "#ccc"
    }));

  return {
    stats: formattedStats,
    details: details
  };
};