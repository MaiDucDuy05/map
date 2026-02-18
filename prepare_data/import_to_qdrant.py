# import_to_qdrant.py
import os
import json
import logging
import re
import time
from pathlib import Path
from typing import List, Dict, Any
from datetime import datetime

# Import LangChain components
from langchain_core.documents import Document
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_qdrant import QdrantVectorStore
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct

from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ========================= CONFIGURATION =========================
BASE_DIR = Path(__file__).parent
DATA_PATH = BASE_DIR / "hanoi_tourism_data" / "04_final_rag_ready.json"

# Qdrant Cloud Configuration
QDRANT_URL = os.getenv("QDRANT_URL") 
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")
COLLECTION_NAME = "langchain"

# Google API
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

# Embedding Configuration
EMBEDDING_MODEL = "models/gemini-embedding-001" 
EMBEDDING_DIMENSION = 3072  

# Processing Configuration
BATCH_SIZE = 10
DELAY_SECONDS = 2
MAX_RETRIES = 3


def load_documents_from_json(file_path: Path) -> List[Document]:
    """
    Load documents from JSON file and convert to LangChain Document format
    """
    if not file_path.exists():
        raise FileNotFoundError(f"Không tìm thấy file dữ liệu: {file_path}")

    logger.info(f" Đang đọc dữ liệu từ: {file_path}")
    
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    documents = []
    for item in data:
        lines = []
        lines.append(f"Địa điểm: {item['name']}")
        
        # Name variants
        variants = item.get('name_variants', {})
        if variants.get('en'):
            lines.append(f"Tên tiếng Anh: {variants['en']}")
        
        # Location
        loc = item.get('location', {})
        lines.append(f"Tọa độ: {loc.get('lat')}, {loc.get('lon')}")
        if loc.get('address'):
            lines.append(f"Địa chỉ: {loc.get('address')}")

        # Layer: Basic
        basic = item.get('layers', {}).get('basic', {})
        if basic.get('category'):
            lines.append(f"Danh mục: {basic['category']}")
        if basic.get('type'):
            lines.append(f"Loại hình: {basic['type']}")

        # Layer: Historical
        hist = item.get('layers', {}).get('historical', {})
        if hist.get('historical_period'):
            lines.append(f"Giai đoạn lịch sử: {hist['historical_period']}")
        if hist.get('significance'):
            lines.append(f"Ý nghĩa: {hist['significance']}")
        
        articles = hist.get('related_articles', [])
        if articles:
            lines.append("\nThông tin chi tiết từ bài viết:")
            for art in articles:
                lines.append(f"- {art.get('title')}: {art.get('summary')}")

        # Layer: Practical
        prac = item.get('layers', {}).get('practical', {})
        tips = prac.get('tips', [])
        if tips:
            lines.append("\nLưu ý khi tham quan (Tips):")
            for tip in tips:
                lines.append(f"- {tip}")
        
        if prac.get('opening_hours'):
            lines.append(f"Giờ mở cửa: {prac['opening_hours']}")
        if prac.get('estimated_visit_duration'):
            lines.append(f"Thời gian tham quan dự kiến: {prac['estimated_visit_duration']}")

        # Layer: Cultural (Food recommendations)
        cult = item.get('layers', {}).get('cultural', {})
        foods = cult.get('food_recommendations', [])
        if foods:
            lines.append("\nĐề xuất quán ăn ngon lân cận:")
            for food in foods:
                f_info = f"- {food.get('name')}"
                if food.get('address'):
                    f_info += f" tại {food['address']}"
                if food.get('price_range') and "Đang cập nhật" not in food['price_range']:
                    f_info += f". Giá: {food['price_range']}"
                lines.append(f_info)

        full_content = "\n".join(lines)

        # Metadata
        metadata = {
            "id": item.get("id", ""),
            "name": item.get("name", ""),
            "name_en": variants.get("en", ""),
            "category": basic.get("category", "unknown"),
            "type": basic.get("type", ""),
            "lat": float(loc.get("lat", 0.0)),
            "lon": float(loc.get("lon", 0.0)),
            "address": loc.get("address", ""),
            "tags": ", ".join(item.get("metadata", {}).get("tags", [])),
            "quality_score": float(item.get("metadata", {}).get("data_quality_score", 0.0)),
            "historical_period": hist.get("historical_period", ""),
            "opening_hours": prac.get("opening_hours", ""),
            "visit_duration": prac.get("estimated_visit_duration", ""),
            "tips": tips,
            "nearby_restaurants": [f.get("name") for f in foods],
        }

        doc = Document(
            page_content=full_content,
            metadata=metadata
        )
        documents.append(doc)
    
    logger.info(f"Đã load {len(documents)} documents từ JSON")
    return documents


def initialize_qdrant_client() -> QdrantClient:
    """
    Initialize Qdrant Cloud client
    """
    if not QDRANT_URL or not QDRANT_API_KEY:
        raise ValueError("QDRANT_URL và QDRANT_API_KEY phải được cấu hình trong .env")
    
    logger.info(f"🔗 Đang kết nối đến Qdrant Cloud: {QDRANT_URL}")
    
    client = QdrantClient(
        url=QDRANT_URL,
        api_key=QDRANT_API_KEY,
        timeout=60
    )
    
    # Test connection
    try:
        collections = client.get_collections()
        logger.info(f"✅ Kết nối thành công! Số collections hiện có: {len(collections.collections)}")
    except Exception as e:
        logger.error(f"❌ Không thể kết nối đến Qdrant Cloud: {e}")
        raise
    
    return client


def create_collection_if_not_exists(client: QdrantClient):
    """
    Create collection if it doesn't exist
    """
    try:
        # Check if collection exists
        collections = client.get_collections()
        collection_names = [col.name for col in collections.collections]
        
        if COLLECTION_NAME in collection_names:
            logger.info(f"📦 Collection '{COLLECTION_NAME}' đã tồn tại")
            
            # Get collection info
            collection_info = client.get_collection(COLLECTION_NAME)
            logger.info(f"   └─ Số vectors hiện có: {collection_info.points_count}")
            logger.info(f"   └─ Vector dimension: {collection_info.config.params.vectors.size}")
            
            return collection_info.points_count
        else:
            # Create new collection
            logger.info(f"🆕 Tạo collection mới: '{COLLECTION_NAME}'")
            
            client.create_collection(
                collection_name=COLLECTION_NAME,
                vectors_config=VectorParams(
                    size=EMBEDDING_DIMENSION,
                    distance=Distance.COSINE
                )
            )
            
            logger.info(f"✅ Đã tạo collection '{COLLECTION_NAME}' thành công")
            return 0
            
    except Exception as e:
        logger.error(f"❌ Lỗi khi tạo/kiểm tra collection: {e}")
        raise


def import_to_qdrant_with_langchain(
    documents: List[Document],
    embeddings: GoogleGenerativeAIEmbeddings,
    existing_count: int = 0
):
    """
    Import documents to Qdrant using LangChain integration
    """
    total_docs = len(documents)
    
    if existing_count >= total_docs:
        logger.info("Dữ liệu đã đầy đủ. Không cần import thêm!")
        return
    
    # Calculate documents to process
    if existing_count > 0:
        logger.info(f"Đã có {existing_count} documents. Sẽ import {total_docs - existing_count} documents còn lại...")
        docs_to_process = documents[existing_count:]
    else:
        docs_to_process = documents
    
    logger.info(f" Bắt đầu import {len(docs_to_process)} documents vào Qdrant Cloud")
    
    # Process in batches
    success_count = 0
    
    for i in range(0, len(docs_to_process), BATCH_SIZE):
        batch = docs_to_process[i : i + BATCH_SIZE]
        current_idx = existing_count + i
        batch_num = (current_idx // BATCH_SIZE) + 1
        
        success = False
        retry_count = 0
        
        while not success and retry_count < MAX_RETRIES:
            try:
                vector_store = QdrantVectorStore.from_documents(
                    documents=batch,
                    embedding=embeddings,
                    url=QDRANT_URL,
                    api_key=QDRANT_API_KEY,
                    collection_name=COLLECTION_NAME,
                    force_recreate=False 
                )
                
                success_count += len(batch)
                
                logger.info(
                    f"Batch {batch_num}: Import thành công {len(batch)} docs "
                    f"({success_count}/{len(docs_to_process)} - "
                    f"{success_count/len(docs_to_process)*100:.1f}%)"
                )
                
                # Delay to avoid rate limiting
                if i + BATCH_SIZE < len(docs_to_process):
                    logger.info(f"⏳ Nghỉ {DELAY_SECONDS}s...")
                    time.sleep(DELAY_SECONDS)
                
                success = True
                
            except Exception as e:
                error_msg = str(e)
                retry_count += 1
                
                # Calculate wait time
                wait_time = 10
                match = re.search(r"retry in (\d+\.?\d*)s", error_msg)
                if match:
                    wait_time = float(match.group(1)) + 5
                
                logger.error(f"Lỗi batch {batch_num} (Lần {retry_count}/{MAX_RETRIES}): {e}")
                
                if retry_count < MAX_RETRIES:
                    logger.info(f"Đợi {wait_time:.1f}s để thử lại...")
                    time.sleep(wait_time)
                else:
                    logger.error(f" Dừng tại batch {batch_num} sau {MAX_RETRIES} lần thử")
                    return success_count
    
    logger.info(f"🎉 Import hoàn tất! Đã import {success_count}/{len(docs_to_process)} documents")
    return success_count


def verify_import(client: QdrantClient):
    """
    Verify the import by checking collection stats
    """
    logger.info(" Đang kiểm tra kết quả import...")
    
    try:
        collection_info = client.get_collection(COLLECTION_NAME)
        
        logger.info("=" * 60)
        logger.info(f"THỐNG KÊ COLLECTION: {COLLECTION_NAME}")
        logger.info("=" * 60)
        logger.info(f"  Tổng số vectors: {collection_info.points_count}")
        logger.info(f"   Vector dimension: {collection_info.config.params.vectors.size}")
        logger.info(f"   Distance metric: {collection_info.config.params.vectors.distance}")
        logger.info(f"   Vector storage: {collection_info.config.params.vectors}")
        logger.info("=" * 60)
        
        # Sample query to test
        logger.info("\n Test query: 'Hồ Gươm'")
        
        embeddings = GoogleGenerativeAIEmbeddings(
            model=EMBEDDING_MODEL,
            task_type="retrieval_query",
            google_api_key=GOOGLE_API_KEY
        )
        
        vector_store = QdrantVectorStore(
            client=client,
            collection_name=COLLECTION_NAME,
            embedding=embeddings
        )
        
        results = vector_store.similarity_search("Hồ Gươm", k=3)
        
        logger.info(f"✅ Tìm thấy {len(results)} kết quả:")
        for i, doc in enumerate(results, 1):
            logger.info(f"\n  {i}. {doc.metadata.get('name')}")
            logger.info(f"     Category: {doc.metadata.get('category')}")
            logger.info(f"     Score: {doc.metadata.get('quality_score')}")
        
    except Exception as e:
        logger.error(f" Lỗi khi verify: {e}")


def main():
    """
    Main function to orchestrate the import process
    """
    start_time = time.time()
    
    logger.info("=" * 60)
    logger.info("🚀 BẮT ĐẦU IMPORT DỮ LIỆU LÊN QDRANT CLOUD")
    logger.info("=" * 60)

    documents = load_documents_from_json(DATA_PATH)

    print(documents[0])

    for i, doc in enumerate(documents[:3], 1):
        logger.info(f"   Document {i} ({doc.metadata['name']}): {len(doc.page_content)} ký tự")


    
    # try:
    #     # 1. Load documents
    #     documents = load_documents_from_json(DATA_PATH)
    #     total_docs = len(documents)
    #     logger.info(f" Tổng số documents: {total_docs}")
        
    #     # 2. Initialize Qdrant client
    #     client = initialize_qdrant_client()
        
    #     # 3. Create collection if not exists
    #     existing_count = create_collection_if_not_exists(client)
        
    #     # 4. Initialize embeddings
    #     logger.info(" Khởi tạo Google Embeddings...")
    #     embeddings = GoogleGenerativeAIEmbeddings(
    #         model=EMBEDDING_MODEL,
    #         task_type="retrieval_document",
    #         google_api_key=GOOGLE_API_KEY
    #     )
    #     logger.info(f" Sử dụng model: {EMBEDDING_MODEL}")
        
    #     # 5. Import documents
    #     success_count = import_to_qdrant_with_langchain(
    #         documents=documents,
    #         embeddings=embeddings,
    #         existing_count=existing_count
    #     )
        
    #     # 6. Verify import
    #     verify_import(client)
        
    #     # 7. Summary
    #     elapsed_time = time.time() - start_time
    #     logger.info("\n" + "=" * 60)
    #     logger.info("HOÀN THÀNH!")
    #     logger.info("=" * 60)
    #     logger.info(f"  ⏱  Thời gian: {elapsed_time:.2f}s")
    #     logger.info(f"  Documents: {success_count}/{total_docs}")
    #     logger.info(f"   Collection: {COLLECTION_NAME}")
    #     logger.info(f"   Qdrant URL: {QDRANT_URL}")
    #     logger.info("=" * 60)
        
    # except Exception as e:
    #     logger.error(f"\n LỖI NGHIÊM TRỌNG: {e}")
    #     import traceback
    #     traceback.print_exc()
    #     raise



if __name__ == "__main__":
    main()