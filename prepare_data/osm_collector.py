"""
OpenStreetMap Data Collector
Fetches POI data from Overpass API
"""

import asyncio
import aiohttp
import logging
from typing import List, Dict, Any
from urllib.parse import quote

logger = logging.getLogger(__name__)


class OSMCollector:
    """Collector for OpenStreetMap data via Overpass API"""
    
    OVERPASS_SERVERS = [
        "https://overpass.kumi.systems/api/interpreter",
        "https://overpass-api.de/api/interpreter",
        "https://lz4.overpass-api.de/api/interpreter"
    ]
    
    # Bounding box for Hanoi
    CITY_BOUNDS = {
        "Hanoi": {
            "south": 20.95,
            "north": 21.15,
            "west": 105.70,
            "east": 105.90
        }
    }
    
    CATEGORY_QUERIES = {
        "historic": '["historic"~"monument|memorial|archaeological_site|castle|fort|ruins"]',
        "tourism": '["tourism"~"attraction|museum|gallery|viewpoint|artwork"]',
        "place_of_worship": '["amenity"="place_of_worship"]',
        "monument": '["historic"="monument"]',
        "museum": '["tourism"="museum"]',
        "attraction": '["tourism"="attraction"]'
    }
    
    async def collect_pois(self, city: str, categories: List[str]) -> List[Dict[str, Any]]:
        """
        Collect POIs from OpenStreetMap
        
        Args:
            city: City name
            categories: List of categories to collect
            
        Returns:
            List of POI dictionaries
        """
        bounds = self.CITY_BOUNDS.get(city)
        if not bounds:
            raise ValueError(f"City '{city}' not supported. Available: {list(self.CITY_BOUNDS.keys())}")
        
        all_pois = []
        
        for category in categories:
            logger.info(f"Fetching {category} POIs...")
            pois = await self._fetch_category(bounds, category)
            all_pois.extend(pois)
            logger.info(f"  → Found {len(pois)} {category} POIs")
            
            # Be nice to the API
            await asyncio.sleep(2)
        
        # Remove duplicates by OSM ID
        unique_pois = {poi["osm_id"]: poi for poi in all_pois}.values()
        
        return list(unique_pois)
    
    async def _fetch_category(self, bounds: Dict, category: str) -> List[Dict[str, Any]]:
        """Fetch POIs for a specific category"""
        query_filter = self.CATEGORY_QUERIES.get(category, f'["tourism"="{category}"]')
        
        query = f"""
        [out:json][timeout:60];
        (
          node{query_filter}({bounds["south"]},{bounds["west"]},{bounds["north"]},{bounds["east"]});
          way{query_filter}({bounds["south"]},{bounds["west"]},{bounds["north"]},{bounds["east"]});
          relation{query_filter}({bounds["south"]},{bounds["west"]},{bounds["north"]},{bounds["east"]});
        );
        out center tags;
        """
        
        data = await self._query_overpass(query)
        
        if not data or "elements" not in data:
            return []
        
        return [self._parse_element(el, category) for el in data["elements"]]
    
    async def _query_overpass(self, query: str) -> Dict:
        """Query Overpass API with fallback servers"""
        async with aiohttp.ClientSession() as session:
            for server in self.OVERPASS_SERVERS:
                try:
                    logger.debug(f"Trying server: {server}")
                    async with session.post(
                        server,
                        data={"data": query},
                        timeout=aiohttp.ClientTimeout(total=90)
                    ) as response:
                        if response.status == 200:
                            return await response.json()
                        else:
                            logger.warning(f"Server {server} returned status {response.status}")
                except Exception as e:
                    logger.warning(f"Failed to query {server}: {e}")
                    continue
        
        logger.error("All Overpass servers failed")
        return {}
    
    def _parse_element(self, element: Dict, category: str) -> Dict[str, Any]:
        """Parse OSM element into structured format"""
        tags = element.get("tags", {})
        
        # Get coordinates
        if "lat" in element and "lon" in element:
            lat, lon = element["lat"], element["lon"]
        elif "center" in element:
            lat, lon = element["center"]["lat"], element["center"]["lon"]
        else:
            lat, lon = None, None
        
        # Extract name (prefer Vietnamese)
        name = (
            tags.get("name:vi") or 
            tags.get("name") or 
            tags.get("name:en") or 
            "Unknown"
        )
        
        # Get description if available
        description = (
            tags.get("description:vi") or
            tags.get("description") or
            tags.get("description:en") or
            ""
        )
        
        # Determine specific type
        poi_type = (
            tags.get("historic") or
            tags.get("tourism") or
            tags.get("amenity") or
            category
        )
        
        return {
            "osm_id": element["id"],
            "osm_type": element["type"],
            "name": name,
            "name_en": tags.get("name:en"),
            "name_vi": tags.get("name:vi"),
            "category": category,
            "type": poi_type,
            "location": {
                "lat": lat,
                "lon": lon,
                "address": self._build_address(tags)
            },
            "basic_info": {
                "description": description,
                "wikipedia": tags.get("wikipedia"),
                "wikidata": tags.get("wikidata"),
                "website": tags.get("website"),
                "phone": tags.get("phone"),
                "opening_hours": tags.get("opening_hours")
            },
            "raw_tags": tags
        }
    
    def _build_address(self, tags: Dict) -> str:
        """Build address from OSM tags"""
        parts = []
        
        if addr := tags.get("addr:housenumber"):
            parts.append(addr)
        if street := tags.get("addr:street"):
            parts.append(street)
        if district := tags.get("addr:district"):
            parts.append(district)
        if city := tags.get("addr:city"):
            parts.append(city)
        
        return ", ".join(parts) if parts else ""


if __name__ == "__main__":
    # Test the collector
    async def test():
        collector = OSMCollector()
        pois = await collector.collect_pois("Hanoi", ["historic", "museum"])
        print(f"Collected {len(pois)} POIs")
        
        # Print first POI as sample
        if pois:
            import json
            print(json.dumps(pois[0], indent=2, ensure_ascii=False))
    
    asyncio.run(test())
