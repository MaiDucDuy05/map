"""
Data Processor
Structures collected data into RAG-ready format
"""

import logging
from typing import List, Dict, Any
from datetime import datetime

logger = logging.getLogger(__name__)


class DataProcessor:
    """Processes and structures data for RAG system"""
    
    def prepare_for_rag(self, pois: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Convert raw POI data into RAG-ready structured format
        
        Args:
            pois: List of enriched POI dictionaries
            
        Returns:
            List of structured documents ready for embedding
        """
        logger.info("Processing data for RAG...")
        
        rag_documents = []
        
        for poi in pois:
            try:
                doc = self._structure_document(poi)
                rag_documents.append(doc)
            except Exception as e:
                logger.error(f"Failed to process POI {poi.get('name', 'unknown')}: {e}")
                continue
        
        logger.info(f"Successfully processed {len(rag_documents)} documents")
        return rag_documents
    
    def _structure_document(self, poi: Dict[str, Any]) -> Dict[str, Any]:
        """Structure a single POI into layered document format"""
        
        # Extract data from different sources
        osm_data = poi
        wiki_data = poi.get("wikipedia_data", {})
        web_data = poi.get("web_data", {})
        
        # Build structured document with layers
        document = {
            "id": f"{osm_data['osm_type']}_{osm_data['osm_id']}",
            "name": osm_data["name"],
            "name_variants": {
                "vi": osm_data.get("name_vi"),
                "en": osm_data.get("name_en"),
                "local": osm_data.get("name")
            },
            "location": osm_data["location"],
            
            # Layer 1: Basic Information
            "layers": {
                "basic": self._build_basic_layer(osm_data),
                "historical": self._build_historical_layer(wiki_data, web_data),
                "practical": self._build_practical_layer(osm_data, web_data),
                "cultural": self._build_cultural_layer(wiki_data, web_data)
            },
            
            # Metadata for filtering and ranking
            "metadata": self._build_metadata(osm_data, wiki_data),
            
            # Content for full-text search
            "searchable_content": self._build_searchable_content(osm_data, wiki_data, web_data),
            
            # Timestamps
            "created_at": datetime.now().isoformat(),
            "data_sources": self._list_sources(osm_data, wiki_data, web_data)
        }
        
        return document
    
    def _build_basic_layer(self, osm_data: Dict) -> Dict[str, Any]:
        """Build basic information layer"""
        return {
            "type": osm_data.get("type", ""),
            "category": osm_data.get("category", ""),
            "short_description": osm_data.get("basic_info", {}).get("description", ""),
            "website": osm_data.get("basic_info", {}).get("website"),
            "phone": osm_data.get("basic_info", {}).get("phone")
        }
    
    def _build_historical_layer(self, wiki_data: Dict, web_data: Dict) -> Dict[str, Any]:
        """Build historical and cultural context layer"""
        historical_info = {
            "wikipedia_summary": wiki_data.get("summary", ""),
            "wikipedia_url": wiki_data.get("url"),
            "wikipedia_categories": wiki_data.get("categories", []),
            "significance": self._extract_significance(wiki_data),
            "historical_period": self._extract_period(wiki_data)
        }
        
        # Add article snippets
        articles = web_data.get("articles", [])
        if articles:
            historical_info["related_articles"] = [
                {
                    "title": a["title"],
                    "url": a["url"],
                    "summary": a.get("description", "")
                }
                for a in articles[:3]
            ]
        
        return historical_info
    
    def _build_practical_layer(self, osm_data: Dict, web_data: Dict) -> Dict[str, Any]:
        """Build practical visitor information layer"""
        return {
            "opening_hours": osm_data.get("basic_info", {}).get("opening_hours"),
            "tips": web_data.get("tips", []),
            "best_time_to_visit": web_data.get("best_time_to_visit"),
            "accessibility": self._determine_accessibility(osm_data),
            "estimated_visit_duration": self._estimate_duration(osm_data),
            "admission_info": self._extract_admission_info(web_data)
        }
    
    def _build_cultural_layer(self, wiki_data: Dict, web_data: Dict) -> Dict[str, Any]:
        """Build cultural context and recommendations layer"""
        return {
            "cultural_significance": self._extract_cultural_notes(wiki_data),
            "nearby_attractions": web_data.get("nearby_attractions", []),
            "food_recommendations": web_data.get("food_recommendations", []),
            "events": self._extract_events(wiki_data, web_data),
            "local_customs": self._extract_customs(wiki_data)
        }
    
    def _build_metadata(self, osm_data: Dict, wiki_data: Dict) -> Dict[str, Any]:
        """Build metadata for filtering and ranking"""
        return {
            "category": osm_data.get("category", "unknown"),
            "type": osm_data.get("type", "unknown"),
            "has_wikipedia": bool(wiki_data.get("summary")),
            "has_image": bool(wiki_data.get("image_url")),
            "data_quality_score": self._calculate_quality_score(osm_data, wiki_data),
            "tags": self._extract_tags(osm_data, wiki_data),
            "suitable_for": self._determine_suitability(osm_data, wiki_data)
        }
    
    def _build_searchable_content(self, osm_data: Dict, wiki_data: Dict, web_data: Dict) -> str:
        """Build full searchable text content"""
        parts = []
        
        # Name and description
        parts.append(osm_data["name"])
        if desc := osm_data.get("basic_info", {}).get("description"):
            parts.append(desc)
        
        # Wikipedia summary
        if wiki_summary := wiki_data.get("summary"):
            parts.append(wiki_summary)
        
        # Tips
        if tips := web_data.get("tips"):
            parts.extend(tips)
        
        # Categories
        if wiki_cats := wiki_data.get("categories"):
            parts.extend(wiki_cats)
        
        return " ".join(parts)
    
    def _list_sources(self, osm_data: Dict, wiki_data: Dict, web_data: Dict) -> List[str]:
        """List data sources used"""
        sources = ["OpenStreetMap"]
        
        if wiki_data.get("summary"):
            sources.append(f"Wikipedia ({wiki_data.get('language', 'vi')})")
        
        if web_data.get("articles"):
            sources.append("VnExpress Travel")
        
        return sources
    
    # Helper methods for extraction
    
    def _extract_significance(self, wiki_data: Dict) -> str:
        """Extract historical significance from Wikipedia data"""
        summary = wiki_data.get("summary", "")
        
        # Look for sentences with significance keywords
        keywords = ["quan trọng", "nổi tiếng", "di sản", "UNESCO", "quốc gia"]
        sentences = summary.split(".")
        
        for sentence in sentences[:5]:
            if any(keyword in sentence.lower() for keyword in keywords):
                return sentence.strip()
        
        return ""
    
    def _extract_period(self, wiki_data: Dict) -> str:
        """Extract historical period from Wikipedia"""
        summary = wiki_data.get("summary", "")
        
        # Look for year patterns
        import re
        year_pattern = r'\b(1[0-9]{3}|20[0-2][0-9])\b'
        matches = re.findall(year_pattern, summary)
        
        if matches:
            return f"Khoảng năm {matches[0]}"
        
        # Look for dynasty names
        dynasties = ["Lý", "Trần", "Lê", "Nguyễn", "Đinh", "Tiền Lê"]
        for dynasty in dynasties:
            if f"nhà {dynasty}" in summary.lower():
                return f"Thời {dynasty}"
        
        return "Không rõ"
    
    def _determine_accessibility(self, osm_data: Dict) -> str:
        """Determine accessibility level"""
        tags = osm_data.get("raw_tags", {})
        
        if tags.get("wheelchair") == "yes":
            return "Có hỗ trợ xe lăn"
        elif tags.get("wheelchair") == "limited":
            return "Hỗ trợ hạn chế cho xe lăn"
        elif tags.get("wheelchair") == "no":
            return "Không hỗ trợ xe lăn"
        
        return "Chưa có thông tin"
    
    def _estimate_duration(self, osm_data: Dict) -> str:
        """Estimate visit duration based on type"""
        category = osm_data.get("category", "")
        poi_type = osm_data.get("type", "")
        
        duration_map = {
            "museum": "2-3 giờ",
            "historic": "1-2 giờ",
            "monument": "30 phút - 1 giờ",
            "place_of_worship": "30 phút - 1 giờ",
            "viewpoint": "30 phút",
            "attraction": "1-2 giờ"
        }
        
        return duration_map.get(poi_type, duration_map.get(category, "1-2 giờ"))
    
    def _extract_admission_info(self, web_data: Dict) -> Dict[str, Any]:
        """Extract admission/ticket information"""
        # This would need to parse from tips or articles
        # Placeholder implementation
        return {
            "fee_required": None,
            "price_range": None,
            "free_days": None
        }
    
    def _extract_cultural_notes(self, wiki_data: Dict) -> str:
        """Extract cultural significance notes"""
        categories = wiki_data.get("categories", [])
        
        cultural_keywords = ["văn hóa", "tôn giáo", "tín ngưỡng", "truyền thống", "lễ hội"]
        
        cultural_cats = [
            cat for cat in categories 
            if any(keyword in cat.lower() for keyword in cultural_keywords)
        ]
        
        if cultural_cats:
            return ", ".join(cultural_cats[:3])
        
        return ""
    
    def _extract_events(self, wiki_data: Dict, web_data: Dict) -> List[str]:
        """Extract events or festivals"""
        events = []
        
        # Look in Wikipedia summary
        summary = wiki_data.get("summary", "")
        event_keywords = ["lễ hội", "sự kiện", "lễ", "ngày"]
        
        sentences = summary.split(".")
        for sentence in sentences:
            if any(keyword in sentence.lower() for keyword in event_keywords):
                events.append(sentence.strip())
        
        return events[:3]
    
    def _extract_customs(self, wiki_data: Dict) -> List[str]:
        """Extract local customs or etiquette"""
        # Placeholder - would need more sophisticated extraction
        return []
    
    def _calculate_quality_score(self, osm_data: Dict, wiki_data: Dict) -> float:
        """Calculate data quality score (0-1)"""
        score = 0.0
        
        # Has name
        if osm_data.get("name"):
            score += 0.2
        
        # Has coordinates
        if osm_data.get("location", {}).get("lat"):
            score += 0.2
        
        # Has Wikipedia data
        if wiki_data.get("summary"):
            score += 0.3
        
        # Has image
        if wiki_data.get("image_url"):
            score += 0.15
        
        # Has contact info
        if osm_data.get("basic_info", {}).get("phone") or osm_data.get("basic_info", {}).get("website"):
            score += 0.15
        
        return round(score, 2)
    
    def _extract_tags(self, osm_data: Dict, wiki_data: Dict) -> List[str]:
        """Extract searchable tags"""
        tags = set()
        
        # Add category
        if cat := osm_data.get("category"):
            tags.add(cat)
        
        # Add type
        if poi_type := osm_data.get("type"):
            tags.add(poi_type)
        
        # Add from Wikipedia categories
        for category in wiki_data.get("categories", [])[:5]:
            # Clean up category name
            clean_cat = category.lower().strip()
            if len(clean_cat) > 3:  # Avoid very short tags
                tags.add(clean_cat)
        
        return list(tags)
    
    def _determine_suitability(self, osm_data: Dict, wiki_data: Dict) -> List[str]:
        """Determine who this location is suitable for"""
        suitable = []
        
        category = osm_data.get("category", "")
        poi_type = osm_data.get("type", "")
        
        # Based on category
        if category in ["museum", "historic"]:
            suitable.extend(["students", "history_enthusiasts", "families"])
        
        if category == "place_of_worship":
            suitable.extend(["spiritual_seekers", "culture_enthusiasts"])
        
        if poi_type in ["park", "garden"]:
            suitable.extend(["families", "couples", "photographers"])
        
        # Check if family-friendly
        tags = osm_data.get("raw_tags", {})
        if tags.get("wheelchair") == "yes":
            suitable.append("elderly")
            suitable.append("wheelchair_users")
        
        return list(set(suitable))


if __name__ == "__main__":
    # Test the processor
    processor = DataProcessor()
    
    test_poi = {
        "osm_id": 123456,
        "osm_type": "way",
        "name": "Văn Miếu - Quốc Tử Giám",
        "name_vi": "Văn Miếu - Quốc Tử Giám",
        "category": "historic",
        "type": "monument",
        "location": {"lat": 21.029, "lon": 105.835},
        "basic_info": {
            "description": "Ngôi trường đại học đầu tiên của Việt Nam",
            "wikipedia": "vi:Văn Miếu - Quốc Tử Giám"
        },
        "wikipedia_data": {
            "summary": "Văn Miếu - Quốc Tử Giám là một di tích lịch sử quan trọng...",
            "categories": ["Di tích quốc gia", "Giáo dục Việt Nam"]
        },
        "web_data": {
            "tips": ["Nên đến sớm", "Mặc trang phục lịch sự"]
        }
    }
    
    result = processor._structure_document(test_poi)
    
    import json
    print(json.dumps(result, indent=2, ensure_ascii=False))
