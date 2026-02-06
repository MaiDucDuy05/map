import { LatLngTuple } from "leaflet";

export interface PoiStat {
  name: string;
  count: number;
  fill: string;
}

// Danh sách các server Overpass mirror
const OVERPASS_SERVERS = [
  "https://overpass.kumi.systems/api/interpreter", // Thường nhanh nhất
  "https://overpass-api.de/api/interpreter",       // Mặc định (hay quá tải)
  "https://lz4.overpass-api.de/api/interpreter"    // Backup
];

export const fetchPoiStatistics = async (polygon: LatLngTuple[]): Promise<PoiStat[]> => {
  // 1. Tối ưu toạ độ: Chỉ lấy 5 số thập phân
  const polyCoords = polygon
    .map((p) => `${Number(p[0]).toFixed(5)} ${Number(p[1]).toFixed(5)}`)
    .join(" ");

  // 2. Query tối giản
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

  // 3. Cơ chế Retry: Thử từng server một
  for (const server of OVERPASS_SERVERS) {
    try {
      console.log(`Connecting to Overpass: ${server}...`);
      const response = await fetch(server, {
        method: "POST",
        body: "data=" + encodeURIComponent(query),
      });

      if (response.ok) {
        data = await response.json();
        break; // Thành công thì thoát vòng lặp
      } else {
        console.warn(`Server ${server} failed: ${response.status}`);
      }
    } catch (e) {
      console.warn(`Connection error to ${server}`, e);
    }
  }

  // Nếu thử hết server mà vẫn không có data
  if (!data || !data.elements) {
    console.error("All Overpass servers failed or timed out.");
    return [];
  }

  // 4. Xử lý dữ liệu (Mapping)
  const stats: Record<string, number> = {
    "Trường học": 0,
    "Y tế": 0,
    "Ẩm thực": 0,
    "Mua sắm": 0,
    "Công viên": 0,
    "Tài chính": 0,
    "Khác": 0
  };

  data.elements.forEach((el: any) => {
    const t = el.tags || {};
    const amenity = t.amenity;
    const leisure = t.leisure;
    const shop = t.shop;

    if (['school', 'kindergarten', 'university', 'college'].includes(amenity)) stats["Trường học"]++;
    else if (['hospital', 'clinic', 'doctors', 'pharmacy'].includes(amenity)) stats["Y tế"]++;
    else if (['restaurant', 'cafe', 'fast_food', 'pub'].includes(amenity)) stats["Ẩm thực"]++;
    else if (['bank', 'atm', 'marketplace'].includes(amenity)) stats["Tài chính"]++;
    else if (['park', 'garden', 'playground'].includes(leisure)) stats["Công viên"]++;
    else if (['supermarket', 'convenience'].includes(shop)) stats["Mua sắm"]++;
    else stats["Khác"]++;
  });

  const colors: Record<string, string> = {
    "Trường học": "#3b82f6",
    "Y tế": "#ef4444",
    "Ẩm thực": "#f97316",
    "Mua sắm": "#eab308",
    "Công viên": "#22c55e",
    "Tài chính": "#10b981",
    "Khác": "#94a3b8"
  };

  return Object.entries(stats)
    .filter(([_, count]) => count > 0)
    .map(([name, count]) => ({
      name,
      count,
      fill: colors[name] || "#ccc"
    }));
};