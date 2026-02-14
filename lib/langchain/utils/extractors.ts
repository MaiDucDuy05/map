// langchain/utils/extractors.ts

export interface LocationData {
  name: string;
  coordinates: { lat: number; lng: number } | null;
  category: string;
  nearbyRestaurants: string[];
  visitDuration?: string;
  tips: string[];
}

export function extractCoordinates(content: string): { lat: number; lng: number } | null {
  const match = content.match(/Tọa độ:\s*([\d.]+),\s*([\d.]+)/);
  if (match) {
    return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
  }
  return null;
}

export function extractCategory(content: string): string {
  const match = content.match(/Danh mục:\s*([^\n]+)/);
  return match ? match[1].trim() : "unknown";
}

export function extractLocationName(content: string): string {
  const match = content.match(/Địa điểm:\s*([^\n]+)/);
  return match ? match[1].trim() : "Unknown Location";
}

export function extractRestaurants(content: string): string[] {
  const restaurantSection = content.match(/Đề xuất quán ăn ngon lân cận:([\s\S]+?)(?=\n\n|$)/);
  if (!restaurantSection) return [];
  
  const restaurants = restaurantSection[1]
    .split('\n')
    .filter(line => line.trim().startsWith('-'))
    .map(line => line.replace(/^-\s*/, '').trim());
  
  return restaurants;
}

export function extractTips(content: string): string[] {
  const tipsSection = content.match(/Lưu ý khi tham quan \(Tips\):([\s\S]+?)(?=Thời gian|$)/);
  if (!tipsSection) return [];
  
  return tipsSection[1]
    .split('\n')
    .filter(line => line.trim().startsWith('-'))
    .map(line => line.replace(/^-\s*/, '').trim());
}

export function extractVisitDuration(content: string): string | undefined {
  const match = content.match(/Thời gian tham quan dự kiến:\s*([^\n]+)/);
  return match ? match[1].trim() : undefined;
}

export function extractLocationData(doc: any): LocationData {
  const content = doc.pageContent || "";
  
  return {
    name: doc.metadata?.name || extractLocationName(content),
    coordinates: extractCoordinates(content),
    category: extractCategory(content),
    nearbyRestaurants: extractRestaurants(content),
    visitDuration: extractVisitDuration(content),
    tips: extractTips(content),
  };
}

export function extractEntities(text: string): Array<{ text: string; type: string }> {
  const patterns = [
    /(?:Hồ|Phố|Đường|Quán|Nhà hàng|Chùa|Đền|Bảo tàng|Công viên|Tượng đài|Đài)\s+([A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ][a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ\s]+)/gi,
  ];
  
  const entities: Array<{ text: string; type: string }> = [];
  
  for (const pattern of patterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      entities.push({ text: match[0], type: 'LOCATION' });
    }
  }
  
  return Array.from(new Map(entities.map(e => [e.text.toLowerCase(), e])).values());
}

export function extractAllLocations(docs: any[]): LocationData[] {
  return docs
    .map(doc => extractLocationData(doc))
    .filter(loc => loc.coordinates !== null);
}