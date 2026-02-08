import httpx
from bs4 import BeautifulSoup
from typing import List, Dict, Any
import asyncio
from urllib.parse import urljoin
import re

class FoodRecommendationService:
    def __init__(self):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    
    async def get_food_recommendations(self, location_name: str, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Lấy danh sách quán ăn recommend tốt nhất
        Chiến lược: Multi-source với parallel fetching
        """
        tasks = [
            self._fetch_from_foody(location_name, limit),
            self._fetch_from_search_engines(location_name, limit),
        ]
        
        # Chạy song song tất cả nguồn
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Gộp và deduplicate
        all_restaurants = []
        for result in results:
            if isinstance(result, list):
                all_restaurants.extend(result)
        
        # Loại bỏ trùng lặp và rank
        unique_restaurants = self._deduplicate_and_rank(all_restaurants)
        
        # **CRAWL CHI TIẾT** cho top results
        detailed_restaurants = await self._enrich_with_details(unique_restaurants[:limit * 2])
        
        return detailed_restaurants[:limit]
    
    async def _enrich_with_details(self, restaurants: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Crawl chi tiết thông tin cho từng nhà hàng
        """
        tasks = []
        for restaurant in restaurants:
            if restaurant['source'] == 'foody':
                tasks.append(self._crawl_foody_detail(restaurant))
            else:
                tasks.append(self._return_as_is(restaurant))
        
        detailed = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Filter out errors
        return [r for r in detailed if isinstance(r, dict) and r.get('name')]
    
    async def _return_as_is(self, restaurant: Dict[str, Any]) -> Dict[str, Any]:
        """Helper to return restaurant as-is"""
        return restaurant
    
    async def _crawl_foody_detail(self, restaurant: Dict[str, Any]) -> Dict[str, Any]:
        """
        Crawl trang chi tiết của Foody để lấy đầy đủ thông tin
        """
        try:
            url = restaurant['url']
            
            async with httpx.AsyncClient(headers=self.headers, timeout=15) as client:
                response = await client.get(url)
                response.raise_for_status()
                html = response.text
            
            soup = BeautifulSoup(html, 'lxml')
            
            # Tên nhà hàng
            name_elem = soup.select_one('h1.restaurant-name') or soup.select_one('h1')
            if name_elem:
                restaurant['name'] = name_elem.get_text(strip=True)
            
            # Địa chỉ chi tiết
            address_selectors = [
                '.detail-address',
                '.restaurant-info .address',
                'span[itemprop="address"]',
                '.microsite-address',
                '.res-common-add'
            ]
            
            for selector in address_selectors:
                address_elem = soup.select_one(selector)
                if address_elem:
                    restaurant['address'] = address_elem.get_text(strip=True)
                    break
            
            # Rating
            rating_selectors = [
                '.microsite-point-avg',
                '.rating-point',
                'span[itemprop="ratingValue"]',
                '.point-avg'
            ]
            
            for selector in rating_selectors:
                rating_elem = soup.select_one(selector)
                if rating_elem:
                    try:
                        rating_text = rating_elem.get_text(strip=True)
                        # Extract số từ text như "8.5" hoặc "8.5/10"
                        match = re.search(r'(\d+\.?\d*)', rating_text)
                        if match:
                            restaurant['rating'] = float(match.group(1))
                            break
                    except:
                        pass
            
            # Review count
            review_selectors = [
                '.microsite-review-count',
                '.review-number',
                '.total-review',
                'span[itemprop="reviewCount"]'
            ]
            
            for selector in review_selectors:
                review_elem = soup.select_one(selector)
                if review_elem:
                    try:
                        review_text = review_elem.get_text(strip=True)
                        # Extract số từ text như "1,234 đánh giá"
                        numbers = re.findall(r'\d+', review_text.replace(',', '').replace('.', ''))
                        if numbers:
                            restaurant['review_count'] = int(numbers[0])
                            break
                    except:
                        pass
            
            # Giá trung bình
            price_selectors = [
                '.restaurant-info .price',
                '.res-common-price',
                'span[itemprop="priceRange"]'
            ]
            
            for selector in price_selectors:
                price_elem = soup.select_one(selector)
                if price_elem:
                    restaurant['price_range'] = price_elem.get_text(strip=True)
                    break
            
            # Giờ mở cửa
            hours_selectors = [
                '.restaurant-info .hours',
                '.res-common-hour',
                '.opening-hours'
            ]
            
            for selector in hours_selectors:
                hours_elem = soup.select_one(selector)
                if hours_elem:
                    restaurant['opening_hours'] = hours_elem.get_text(strip=True)
                    break
            
            # Danh mục món ăn
            category_elem = soup.select_one('.res-common-type') or soup.select_one('.restaurant-type')
            if category_elem:
                restaurant['category'] = category_elem.get_text(strip=True)
            
            # Hình ảnh
            img_elem = soup.select_one('.microsite-cover img') or soup.select_one('img[itemprop="image"]')
            if img_elem:
                restaurant['image'] = img_elem.get('src', '')
            
            # Tính lại score với thông tin mới
            restaurant['score'] = self._calculate_score(
                restaurant.get('rating'),
                restaurant.get('review_count', 0)
            )
            
            print(f"✓ Crawled details for: {restaurant['name']}")
            
            return restaurant
            
        except Exception as e:
            print(f"Error crawling detail for {restaurant.get('name', 'Unknown')}: {e}")
            return restaurant  # Return original data nếu fail
    
    async def _fetch_from_foody(self, location_name: str, limit: int) -> List[Dict[str, Any]]:
        """
        Chiến lược Foody:
        1. Search DuckDuckGo cho Foody links
        2. Nếu gặp listing page -> crawl chi tiết
        3. Nếu gặp restaurant page -> lấy luôn
        """
        try:
            query = f'site:foody.vn {location_name} quán ăn ngon'
            search_results = await self._search_duckduckgo(query)
            
            restaurants = []
            
            for result in search_results[:5]:  # Top 5 results
                url = result['url']
                
                # Bỏ qua các trang không cần thiết
                if any(skip in url for skip in ['bai-viet', 'bo-suu-tap', '/blog/', '/tim-kiem', '/thuc-don']):
                    continue
                
                # Nếu là listing page -> crawl
                if '/dia-diem-tai-khu-vuc' in url or '/khu-vuc-' in url:
                    listing_restaurants = await self._crawl_foody_listing(url, limit)
                    restaurants.extend(listing_restaurants)
                
                # Nếu là restaurant page -> lấy thông tin cơ bản
                else:
                    restaurant = await self._parse_foody_restaurant(url, result)
                    if restaurant:
                        restaurants.append(restaurant)
            
            return restaurants
            
        except Exception as e:
            print(f"Error fetching from Foody: {e}")
            return []
    
    async def _crawl_foody_listing(self, url: str, limit: int) -> List[Dict[str, Any]]:
        """
        Crawl trang listing của Foody để lấy danh sách quán
        """
        try:
            async with httpx.AsyncClient(headers=self.headers, timeout=15) as client:
                response = await client.get(url)
                response.raise_for_status()
                html = response.text
            
            soup = BeautifulSoup(html, 'lxml')
            restaurants = []
            
            # Foody structure - thử nhiều selector
            selectors = [
                '.microsite-top-points .row-item',
                '.fd-list-item',
                '.item-restaurant',
                'div[class*="item"]',
                '.row-item'
            ]
            
            items = []
            for selector in selectors:
                items = soup.select(selector)
                if items:
                    print(f"✓ Found {len(items)} items with selector: {selector}")
                    break
            
            for item in items[:limit]:
                try:
                    restaurant = self._parse_foody_item(item)
                    if restaurant:
                        restaurants.append(restaurant)
                except Exception as e:
                    print(f"Error parsing item: {e}")
                    continue
            
            return restaurants
            
        except Exception as e:
            print(f"Error crawling listing {url}: {e}")
            return []
    
    def _parse_foody_item(self, item) -> Dict[str, Any]:
        """
        Parse một item quán ăn từ Foody HTML
        """
        try:
            # Tìm tên và URL - thử nhiều cách
            name_elem = None
            url = ''
            
            # Thử các selector khác nhau
            link_selectors = [
                'a[href*="/ha-noi/"]',
                '.title a',
                'h3 a',
                'a.title',
                '.item-title a'
            ]
            
            for selector in link_selectors:
                name_elem = item.select_one(selector)
                if name_elem:
                    break
            
            if not name_elem:
                return None
            
            name = name_elem.get_text(strip=True)
            url = name_elem.get('href', '')
            
            if url and not url.startswith('http'):
                url = urljoin('https://www.foody.vn', url)
            
            # Tìm địa chỉ
            address_elem = (
                item.select_one('.address') or 
                item.select_one('.fd-text-ellipsis') or
                item.select_one('[class*="address"]') or
                item.select_one('.subtitle')
            )
            address = address_elem.get_text(strip=True) if address_elem else "Xem chi tiết tại link"
            
            # Tìm rating
            rating_elem = (
                item.select_one('.point') or 
                item.select_one('.rating') or
                item.select_one('[class*="point"]')
            )
            rating = None
            if rating_elem:
                try:
                    rating_text = rating_elem.get_text(strip=True)
                    match = re.search(r'(\d+\.?\d*)', rating_text)
                    if match:
                        rating = float(match.group(1))
                except:
                    pass
            
            # Tìm số review
            review_elem = item.select_one('.review-count') or item.select_one('[class*="review"]')
            review_count = 0
            if review_elem:
                try:
                    review_text = review_elem.get_text(strip=True)
                    numbers = re.findall(r'\d+', review_text.replace(',', '').replace('.', ''))
                    if numbers:
                        review_count = int(numbers[0])
                except:
                    pass
            
            return {
                "name": name,
                "url": url,
                "address": address,
                "rating": rating,
                "review_count": review_count,
                "source": "foody",
                "score": self._calculate_score(rating, review_count)
            }
            
        except Exception as e:
            print(f"Error parsing Foody item: {e}")
            return None
    
    async def _parse_foody_restaurant(self, url: str, search_result: Dict) -> Dict[str, Any]:
        """
        Parse metadata từ search result
        """
        try:
            name = search_result['title'].split('-')[0].strip()
            if '|' in name:
                name = name.split('|')[0].strip()
            
            description = search_result.get('description', '')
            address = "Xem chi tiết tại link"
            
            if "tại" in description:
                parts = description.split("tại")
                if len(parts) > 1:
                    address = parts[1][:100].strip()
            
            return {
                "name": name,
                "url": url,
                "address": address,
                "rating": None,
                "review_count": 0,
                "source": "foody",
                "score": 50.0
            }
            
        except Exception as e:
            print(f"Error parsing restaurant: {e}")
            return None
    
    async def _fetch_from_search_engines(self, location_name: str, limit: int) -> List[Dict[str, Any]]:
        """
        Lấy từ các nguồn tin cậy khác qua search engine
        """
        try:
            queries = [
                f'{location_name} quán ăn ngon nhất',
                f'top quán ăn {location_name}',
            ]
            
            all_results = []
            
            for query in queries[:1]:  # Chỉ dùng 1 query
                results = await self._search_duckduckgo(query)
                
                for result in results[:3]:
                    url = result['url']
                    
                    # Chỉ lấy từ các nguồn uy tín
                    trusted_domains = [
                        'pasgo.vn', 'vietcetera.com', 'kenh14.vn',
                        'vnexpress.net', 'thanhnien.vn'
                    ]
                    
                    if any(domain in url for domain in trusted_domains):
                        restaurant = {
                            "name": result['title'].split('-')[0].strip(),
                            "url": url,
                            "address": result.get('description', '')[:100],
                            "rating": None,
                            "review_count": 0,
                            "source": url.split('/')[2],
                            "score": 50
                        }
                        all_results.append(restaurant)
            
            return all_results
            
        except Exception as e:
            print(f"Error fetching from search engines: {e}")
            return []
    
    async def _search_duckduckgo(self, query: str) -> List[Dict[str, Any]]:
        try:
            import urllib.parse
            
            encoded_query = urllib.parse.quote_plus(query)
            url = f'https://html.duckduckgo.com/html/?q={encoded_query}'
            
            async with httpx.AsyncClient(
                headers=self.headers,
                timeout=15,
                follow_redirects=True
            ) as client:
                response = await client.get(url)
                html = response.text
            
            soup = BeautifulSoup(html, 'lxml')
            results = []
            
            for result_div in soup.select('.result')[:10]:
                try:
                    title_elem = result_div.select_one('.result__a')
                    snippet_elem = result_div.select_one('.result__snippet')
                    
                    if not title_elem:
                        continue
                    
                    url_text = title_elem.get('href', '')
                    
                    # Extract actual URL from DuckDuckGo redirect
                    if 'uddg=' in url_text:
                        import urllib.parse
                        parsed = urllib.parse.parse_qs(urllib.parse.urlparse(url_text).query)
                        url_text = parsed.get('uddg', [''])[0]
                    
                    if not url_text:
                        continue
                    
                    results.append({
                        'title': title_elem.get_text(strip=True),
                        'url': url_text,
                        'description': snippet_elem.get_text(strip=True) if snippet_elem else ''
                    })
                    
                except Exception:
                    continue
            
            return results
        
        except Exception as e:
            print(f"Error searching DuckDuckGo: {e}")
            return []
    
    def _calculate_score(self, rating: float = None, review_count: int = 0) -> float:
        """
        Tính điểm tổng hợp
        """
        if rating is None:
            return 50.0
        
        C = 10
        m = 7.0
        
        score = (C * m + review_count * rating) / (C + review_count)
        
        return (score / 10) * 100
    
    def _deduplicate_and_rank(self, restaurants: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Loại bỏ trùng lặp và xếp hạng
        """
        seen_names = set()
        seen_urls = set()
        unique = []
        
        for restaurant in restaurants:
            name_normalized = restaurant['name'].lower().strip()
            url = restaurant['url']
            
            if name_normalized in seen_names or url in seen_urls:
                continue
            
            seen_names.add(name_normalized)
            seen_urls.add(url)
            unique.append(restaurant)
        
        unique.sort(key=lambda x: x['score'], reverse=True)
        
        return unique


# Sử dụng
async def main():
    service = FoodRecommendationService()
    
    # Test
    location = "Mỹ Đình"
    results = await service.get_food_recommendations(location, limit=10)
    
    print(f"\n{'='*80}")
    print(f"TOP QUÁN ĂN GẦN {location.upper()}")
    print(f"{'='*80}\n")
    
    for i, r in enumerate(results, 1):
        print(f"{i}. {r['name']}")
        print(f"   Địa chỉ: {r.get('address', 'N/A')}")
        print(f"   Rating: {r.get('rating') or 'N/A'} ({r.get('review_count', 0)} reviews)")
        
        if r.get('price_range'):
            print(f"   Giá: {r['price_range']}")
        
        if r.get('category'):
            print(f"   Danh mục: {r['category']}")
        
        if r.get('opening_hours'):
            print(f"   Giờ mở cửa: {r['opening_hours']}")
        
        print(f"   Score: {r['score']:.1f}")
        print(f"   Link: {r['url']}")
        print(f"   Source: {r['source']}\n")

if __name__ == "__main__":
    asyncio.run(main())