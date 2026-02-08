"""
Web Crawler (Integrated)
Uses DuckDuckGo for articles & FoodRecommendationService for restaurants
"""

import asyncio
import aiohttp
import logging
from typing import List, Dict, Any, Optional
from bs4 import BeautifulSoup

# IMPORT SERVICE TỪ FILE BÊN CẠNH
try:
    from prepare_data.recommendatin_food import FoodRecommendationService
except ImportError:
    print("WARNING: Không tìm thấy file 'recomendation_food.py'. Hãy đảm bảo file này tồn tại.")
    FoodRecommendationService = None

logger = logging.getLogger(__name__)

class WebCrawler:
    """Crawls tourism info using Hybrid approach"""

    HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "Sec-Ch-Ua": '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"Windows"',
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
        "Accept-Encoding": "gzip, deflate", 
        "Referer": "https://duckduckgo.com/",
        "Upgrade-Insecure-Requests": "1"
    }
    
    def __init__(self):
        self.session: Optional[aiohttp.ClientSession] = None
        

        if FoodRecommendationService:
            self.food_service = FoodRecommendationService()
        else:
            self.food_service = None
    
    async def enrich_batch(self, pois: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Xử lý hàng loạt địa điểm"""
        self.session = aiohttp.ClientSession(headers=self.HEADERS)
        try:
            enriched = []
            for i, poi in enumerate(pois):
                logger.info(f"Crawling web data {i+1}/{len(pois)}: {poi['name']}")
                enriched_poi = await self._enrich_single(poi)
                enriched.append(enriched_poi)
                
                # Nghỉ ngắn để tránh bị chặn IP
                await asyncio.sleep(2)
            return enriched
        finally:
            if self.session:
                await self.session.close()
    
    async def _enrich_single(self, poi: Dict[str, Any]) -> Dict[str, Any]:
        """Làm giàu dữ liệu cho 1 địa điểm"""
        if not self.session:
            return poi

        web_data = {
            "articles": [],
            "tips": [],
            "food_recommendations": []
        }
        
        search_query = f"kinh nghiệm tham quan {poi['name']}"
        articles = await self._search_duckduckgo_articles(search_query)
        web_data["articles"] = articles
        
        if articles:
            top_article_url = articles[0]["url"]
            extracted_tips = await self._extract_tips_from_article(top_article_url)
            web_data["tips"].extend(extracted_tips)
        
        if not web_data["tips"]:
             web_data["tips"] = self._generate_category_tips(poi)

  
        if self.food_service:
            try:
                logger.info(f"Fetching food recommendations for: {poi['name']}")
                recommendations = await self.food_service.get_food_recommendations(
                    location_name=poi['name'], 
                    limit=5  
                )
                web_data["food_recommendations"] = recommendations
            except Exception as e:
                logger.error(f"Error fetching food recommendations: {e}")
                web_data["food_recommendations"] = []
        
        poi["web_data"] = web_data
        return poi
    
    async def _search_duckduckgo_articles(self, query: str) -> List[Dict[str, Any]]:
    
        url = "https://html.duckduckgo.com/html/"
        data = {'q': query}
        
        try:
            async with self.session.post(url, data=data, timeout=15) as response:
                if response.status != 200:
                    return []
                
                html = await response.text()
                soup = BeautifulSoup(html, 'html.parser')
                
                articles = []
                results = soup.select('.result')
                
                for res in results[:3]: 
                    link_tag = res.select_one('.result__a')
                    snippet_tag = res.select_one('.result__snippet')
                    
                    if link_tag:
                        url = link_tag.get('href')
                        if "duckduckgo.com" in url:
                            continue

                        articles.append({
                            "title": link_tag.get_text(strip=True),
                            "url": url,
                            "description": snippet_tag.get_text(strip=True) if snippet_tag else "",
                            "source": "duckduckgo"
                        })
                return articles
        except Exception as e:
            logger.warning(f"Error searching articles on DDG: {e}")
            return []

    async def _extract_tips_from_article(self, url: str) -> List[str]:
        """Cào nội dung bài viết để tìm Tips"""
        if not url: return []
        try:
            async with self.session.get(url, timeout=10) as response:
                if response.status != 200: return []
                html = await response.text()
                soup = BeautifulSoup(html, 'html.parser')
                
                tips = []
                paragraphs = soup.find_all('p')
                keywords = ['lưu ý', 'nên', 'không nên', 'giá vé', 'giờ mở cửa', 'trang phục', 'mang theo']
                
                for p in paragraphs:
                    text = p.get_text(strip=True)
                    if any(k in text.lower() for k in keywords) and 30 < len(text) < 250:
                        tips.append(text)
                        if len(tips) >= 5: break
                return tips
        except Exception as e:
            logger.warning(f"Failed to extract tips from {url}: {e}")
            return []

    def _generate_category_tips(self, poi: Dict[str, Any]) -> List[str]:
        """Tips mặc định dựa trên loại địa điểm"""
        category = poi.get("category", "")
        category_specific_tips = {
            "historic": [
                "Nên mặc trang phục lịch sự, kín đáo.",
                "Đi nhẹ nói khẽ, giữ gìn vệ sinh chung.",
                "Nên đi sớm để tránh đông đúc."
            ],
            "museum": [
                "Không chạm vào hiện vật.",
                "Tắt đèn flash khi chụp ảnh.",
                "Kiểm tra giờ mở cửa trước khi đến."
            ],
             "tourism": [
                "Mang theo kem chống nắng và nước uống.",
                "Cẩn thận tư trang nơi đông người."
            ]
        }
        return category_specific_tips.get(category, [
            "Kiểm tra dự báo thời tiết.", 
            "Mang theo tiền mặt dự phòng."
        ])

if __name__ == "__main__":
    async def test():
        logging.basicConfig(level=logging.INFO)
        crawler = WebCrawler()
        test_poi = {
            "name": "Hồ Hoàn Kiếm",
            "category": "tourism"
        }
        

        results = await crawler.enrich_batch([test_poi])

        import json
        poi_data = results[0]
        
        print("\n=== KẾT QUẢ BÀI VIẾT ===")
        print(json.dumps(poi_data['web_data']['articles'], indent=2, ensure_ascii=False))
        
        print("\n=== KẾT QUẢ QUÁN ĂN (FOOD RECOMMENDATIONS) ===")
        print(json.dumps(poi_data['web_data']['food_recommendations'], indent=2, ensure_ascii=False))
    
    asyncio.run(test())