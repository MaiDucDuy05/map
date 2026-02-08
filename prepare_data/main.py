"""
Data Collection Pipeline for Hanoi Tourism RAG Chatbot
Combines: OSM + Wikipedia + Web Crawling

"""

import asyncio
import json
import logging
from pathlib import Path
from typing import List, Dict, Any
from datetime import datetime

# Import modules
from osm_collector import OSMCollector
from wikipedia_enricher import WikipediaEnricher
from web_crawler import WebCrawler
from data_processor import DataProcessor

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('data_collection.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


class DataCollectionPipeline:
    """Main pipeline to collect and process tourism data"""
    
    def __init__(self, output_dir: str = "./output"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        
        # Initialize collectors
        self.osm_collector = OSMCollector()
        self.wiki_enricher = WikipediaEnricher()
        self.web_crawler = WebCrawler()
        self.processor = DataProcessor()
        
        logger.info("Data Collection Pipeline initialized")
    
    async def run(self, city: str = "Hanoi", categories: List[str] = None):
        """
        Main execution flow
        
        Args:
            city: City name to collect data for
            categories: List of POI categories to collect
        """
        logger.info(f"Starting data collection for {city}")
        
        if categories is None:
            categories = [
                "historic",
                "tourism", 
                "attraction",
                "museum",
                "monument",
                "place_of_worship"
            ]
        
        # Step 1: Collect from OSM
        logger.info("Step 1: Collecting POIs from OpenStreetMap...")
        osm_data = await self.osm_collector.collect_pois(city, categories)
        logger.info(f"Collected {len(osm_data)} POIs from OSM")
        
        # Save intermediate result
        self._save_json(osm_data, "01_osm_raw.json")
        
        # Step 2: Enrich with Wikipedia
        logger.info("Step 2: Enriching with Wikipedia data...")
        enriched_data = await self.wiki_enricher.enrich_batch(osm_data)
        logger.info(f" Enriched {len(enriched_data)} POIs with Wikipedia")
        
        # Save intermediate result
        self._save_json(enriched_data, "02_wikipedia_enriched.json")
        
        # Step 3: Add web crawling data
        logger.info("Step 3: Crawling additional web sources...")
        final_data = await self.web_crawler.enrich_batch(enriched_data)
        logger.info(f" Crawled additional data for {len(final_data)} POIs")
        
        # Save intermediate result
        self._save_json(final_data, "03_web_crawled.json")
        
        # Step 4: Process and structure for RAG
        logger.info(" Step 4: Processing data for RAG...")
        rag_data = self.processor.prepare_for_rag(final_data)
        logger.info(f" Prepared {len(rag_data)} documents for RAG")
        
        # Save final results
        self._save_json(rag_data, "04_final_rag_ready.json")
        
        # Generate statistics
        stats = self._generate_stats(rag_data)
        self._save_json(stats, "statistics.json")
        
        logger.info("Data collection pipeline completed successfully!")
        logger.info(f"Statistics: {stats}")
        
        return rag_data
    
    def _save_json(self, data: Any, filename: str):
        """Save data to JSON file"""
        filepath = self.output_dir / filename
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        logger.info(f"💾 Saved: {filepath}")
    
    def _generate_stats(self, data: List[Dict]) -> Dict:
        """Generate statistics about collected data"""
        stats = {
            "total_locations": len(data),
            "collection_date": datetime.now().isoformat(),
            "categories": {},
            "data_completeness": {
                "with_wikipedia": 0,
                "with_reviews": 0,
                "with_images": 0,
                "with_tips": 0
            }
        }
        
        for item in data:
            # Count by category
            category = item.get("layers", {}).get("basic", {}).get("category", "unknown")
            stats["categories"][category] = stats["categories"].get(category, 0) + 1
            
            # Check data completeness
            if item.get("layers", {}).get("historical", {}).get("wikipedia_summary"):
                stats["data_completeness"]["with_wikipedia"] += 1
            if item.get("layers", {}).get("practical", {}).get("reviews"):
                stats["data_completeness"]["with_reviews"] += 1
            if item.get("layers", {}).get("images"):
                stats["data_completeness"]["with_images"] += 1
            if item.get("layers", {}).get("cultural", {}).get("tips"):
                stats["data_completeness"]["with_tips"] += 1
        
        return stats


async def main():
    """Entry point"""
    pipeline = DataCollectionPipeline(output_dir="./hanoi_tourism_data")
    
    result = await pipeline.run(city="Hanoi")
    
    print("\n" + "="*60)
    print("Data Collection Complete!")
    print("="*60)
    print(f"Total locations collected: {len(result)}")
    print("Check ./hanoi_tourism_data/ for results")


if __name__ == "__main__":
    asyncio.run(main())
