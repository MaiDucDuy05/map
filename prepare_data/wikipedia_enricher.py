"""
Wikipedia Enricher
Adds historical and cultural information from Wikipedia
"""

import asyncio
import aiohttp
import logging
from typing import List, Dict, Any, Optional
from urllib.parse import quote

logger = logging.getLogger(__name__)


class WikipediaEnricher:
    """Enriches POI data with Wikipedia information"""
    
    WIKI_API_URL = "https://vi.wikipedia.org/w/api.php"
    EN_WIKI_API_URL = "https://en.wikipedia.org/w/api.php"
    headers = {
        "User-Agent": "TaskGenie-Interactive-Map/0.1 (contact: https://github.com/zuyxt05)"
    }

    
    def __init__(self):
        self.session: Optional[aiohttp.ClientSession] = None
    
    async def enrich_batch(self, pois: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Enrich a batch of POIs with Wikipedia data
        
        Args:
            pois: List of POI dictionaries from OSM
            
        Returns:
            Enriched POI list
        """
        self.session = aiohttp.ClientSession()
        
        try:
            enriched = []
            for i, poi in enumerate(pois):
                logger.info(f"Enriching {i+1}/{len(pois)}: {poi['name']}")
                enriched_poi = await self._enrich_single(poi)
                enriched.append(enriched_poi)
                
                # Rate limiting
                await asyncio.sleep(0.5)
            
            return enriched
        finally:
            await self.session.close()
    
    async def _enrich_single(self, poi: Dict[str, Any]) -> Dict[str, Any]:
        """Enrich a single POI with Wikipedia data"""
        wiki_data = {}
        
        # Try to get Wikipedia link from OSM
        wiki_link = poi.get("basic_info", {}).get("wikipedia")

        
        if wiki_link:
            if ":" in wiki_link:
                lang, title = wiki_link.split(":", 1)
                wiki_data = await self._fetch_wikipedia_data(title, lang)
        
        # If no wiki link, try searching by name
        if not wiki_data:
            # Try Vietnamese first
            wiki_data = await self._search_and_fetch(poi["name"], "vi")
            
            # If not found, try English name
            if not wiki_data and poi.get("name_en"):
                wiki_data = await self._search_and_fetch(poi["name_en"], "en")
        # Add Wikipedia data to POI
        poi["wikipedia_data"] = wiki_data
        
        return poi
    
    async def _search_and_fetch(self, query: str, lang: str = "vi") -> Dict[str, Any]:
        """Search Wikipedia and fetch article data"""
        # First, search for the article
        page_title = await self._search_wikipedia(query, lang)
        
        if not page_title:
            return {}
        
        # Then fetch the article data
        return await self._fetch_wikipedia_data(page_title, lang)
    
    async def _search_wikipedia(self, query: str, lang: str = "vi") -> Optional[str]:
        """Search for a Wikipedia page"""
        if not self.session:
            return None
            
        api_url = self.WIKI_API_URL if lang == "vi" else self.EN_WIKI_API_URL
        
        params = {
            "action": "opensearch",
            "search": query,
            "limit": 1,
            "namespace": 0,
            "format": "json"
        }
        
        try:
            async with self.session.get(api_url, params=params,headers=self.headers) as response:
                if response.status == 200:
                    data = await response.json()
                    if data and len(data) > 1 and data[1]:
                        return data[1][0]  # First result title
        except Exception as e:
            logger.warning(f"Wikipedia search failed for '{query}': {e}")
        
        return None
    
    async def _fetch_wikipedia_data(self, title: str, lang: str = "vi") -> Dict[str, Any]:
        """Fetch Wikipedia article data"""
        if not self.session:
            return {}
            
        api_url = self.WIKI_API_URL if lang == "vi" else self.EN_WIKI_API_URL
        
    
        params = {
            "action": "query",
            "format": "json",
            "generator": "search",
            "gsrsearch": title,
            "gsrlimit": 1,
            "prop": "extracts|pageimages|info|categories",
            "exintro": 1,
            "explaintext": 1,
            "piprop": "original",
            "inprop": "url",
            "cllimit": 50,
            "redirects": 1
        }
        
        try:
            async with self.session.get(api_url, params=params,headers= self.headers) as response:
                if response.status != 200:
                    return {}
                
                data = await response.json()
                pages = data.get("query", {}).get("pages", {})
                
                if not pages:
                    return {}
                
                # Get first (and only) page
                page = list(pages.values())[0]
                
                if "missing" in page:
                    return {}
                
                # Extract categories
                categories = []
                for cat in page.get("categories", []):
                    cat_title = cat.get("title", "").replace("Category:", "").replace("Thể loại:", "")
                    categories.append(cat_title)
                
                return {
                    "title": page.get("title"),
                    "summary": page.get("extract", ""),
                    "url": page.get("fullurl"),
                    "image_url": page.get("original", {}).get("source"),
                    "categories": categories,
                    "language": lang
                }
        
        except Exception as e:
            logger.warning(f"Failed to fetch Wikipedia data for '{title}': {e}")
            return {}
    
    async def _fetch_full_content(self, title: str, lang: str = "vi") -> str:
        """Fetch full Wikipedia article content (not just summary)"""
        api_url = self.WIKI_API_URL if lang == "vi" else self.EN_WIKI_API_URL
        
        # FIX: Changed boolean True to integer 1
        params = {
            "action": "query",
            "format": "json",
            "titles": title,
            "prop": "extracts",
            "explaintext": 1, # Changed from True
            "exsectionformat": "plain"
        }
        
        try:
            async with self.session.get(api_url, params=params,headers=self.headers) as response:
                if response.status == 200:
                    data = await response.json()
                    pages = data.get("query", {}).get("pages", {})
                    page = list(pages.values())[0]
                    return page.get("extract", "")
        except Exception as e:
            logger.warning(f"Failed to fetch full content for '{title}': {e}")
        
        return ""


if __name__ == "__main__":
    # Test the enricher
    async def test():
        # Configure basic logging to see the output
        logging.basicConfig(level=logging.INFO)
        
        enricher = WikipediaEnricher()
        
        # Test POI
        test_poi = {
            "name": "Văn Miếu - Quốc Tử Giám",
            "basic_info": {
                "wikipedia": "vi:Văn Miếu - Quốc Tử Giám"
            }
        }
        
        # Use enrich_batch instead of _enrich_single to ensure session is initialized
        results = await enricher.enrich_batch([test_poi])
        
        import json
        print(json.dumps(results[0], indent=2, ensure_ascii=False))
    
    asyncio.run(test())