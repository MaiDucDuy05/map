// langchain/utils/formatters.ts

export function formatDocsForContext(docs: any[]): string {
  return docs
    .map((doc, i) => `[Tài liệu ${i + 1}]\n${doc.pageContent}`)
    .join("\n\n");
}

export function formatSources(docs: any[]): Array<{
  name: string;
  content: string;
  coordinates?: { lat: number; lng: number };
  category?: string;
  tips?: string[];
  nearbyRestaurants?: string[];
}> {
  return docs.map((doc: any) => {
    const content = doc.pageContent || "";
    
    return {
      name: doc.metadata?.name || "Unknown",
      content: content.substring(0, 200) + "...",
      coordinates: extractCoordinates(content),
      category: extractCategory(content),
      tips: extractTips(content),
      nearbyRestaurants: extractRestaurants(content),
    };
  });
}

function extractCoordinates(content: string) {
  const match = content.match(/Tọa độ:\s*([\d.]+),\s*([\d.]+)/);
  if (match) {
    return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
  }
  return undefined;
}

function extractCategory(content: string) {
  const match = content.match(/Danh mục:\s*([^\n]+)/);
  return match ? match[1].trim() : undefined;
}

function extractTips(content: string) {
  const tipsSection = content.match(/Lưu ý khi tham quan \(Tips\):([\s\S]+?)(?=Thời gian|$)/);
  if (!tipsSection) return undefined;
  
  return tipsSection[1]
    .split('\n')
    .filter(line => line.trim().startsWith('-'))
    .map(line => line.replace(/^-\s*/, '').trim());
}

function extractRestaurants(content: string) {
  const restaurantSection = content.match(/Đề xuất quán ăn ngon lân cận:([\s\S]+?)(?=\n\n|$)/);
  if (!restaurantSection) return undefined;
  
  return restaurantSection[1]
    .split('\n')
    .filter(line => line.trim().startsWith('-'))
    .map(line => line.replace(/^-\s*/, '').trim());
}