import os
import json
import logging
import re
import shutil
from pathlib import Path
import time
from typing import List

# Import LangChain components
from langchain_core.documents import Document
from langchain_text_splitters import CharacterTextSplitter, RecursiveCharacterTextSplitter
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_chroma import Chroma

from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).parent
DATA_PATH = BASE_DIR / "hanoi_tourism_data" / "04_final_rag_ready.json"
CHROMA_PATH = BASE_DIR / "chroma_db_langchain"
GOOGLE_API_KEY = os.environ["GOOGLE_API_KEY"]


def load_documents_from_json(file_path: Path) -> List[Document]:

    if not file_path.exists():
        raise FileNotFoundError(f"Không tìm thấy file dữ liệu: {file_path}")

    logger.info(f" Đang đọc dữ liệu từ: {file_path}")
    
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    documents = []
    for item in data:
        lines = []
        lines.append(f"Địa điểm: {item['name']}")
        
        variants = item.get('name_variants', {})
        if variants.get('en'):
            lines.append(f"Tên tiếng Anh: {variants['en']}")
        
        loc = item.get('location', {})
        lines.append(f"Tọa độ: {loc.get('lat')}, {loc.get('lon')}")
        if loc.get('address'):
            lines.append(f"Địa chỉ: {loc.get('address')}")

        # --- Layer Basic ---
        basic = item.get('layers', {}).get('basic', {})
        if basic.get('category'):
            lines.append(f"Danh mục: {basic['category']}")
        if basic.get('type'):
            lines.append(f"Loại hình: {basic['type']}")

        # --- Layer Historical  ---
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

        # --- Layer Practical  ---
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

        metadata = {
            "id": item.get("id"),
            "name": item.get("name"),
            "category": item.get("metadata", {}).get("category", "unknown"),
            "lat": item.get("location", {}).get("lat", 0.0),
            "lon": item.get("location", {}).get("lon", 0.0),
            "tags": ", ".join(item.get("metadata", {}).get("tags", [])),
            "quality_score": item.get("metadata", {}).get("data_quality_score", 0.0)
        }

        doc = Document(
            page_content=full_content, 
            metadata=metadata
        )
        documents.append(doc)
    
    logger.info(f"Đã load {len(documents)} documents từ JSON với đầy đủ thông tin chi tiết.")
    return documents


def main():
    # 1. Load & Split (Vẫn load lại từ đầu để đảm bảo khớp thứ tự)
    docs = load_documents_from_json(DATA_PATH)
    
    # text_splitter = CharacterTextSplitter(
    #     separator="\n\n",
    #     chunk_size=2000,
    #     chunk_overlap=200,
    #     length_function=len,
    #     is_separator_regex=False,
    # )
    
    logger.info(" Đang chuẩn bị dữ liệu...")
    all_split_docs = docs
    # all_split_docs = text_splitter.split_documents(docs)
    total_docs = len(all_split_docs)
    logger.info(f"   => Tổng số lượng chunks gốc: {total_docs}")

    # # 3. Khởi tạo Embedding
    logger.info(" Khởi tạo Google Embeddings ")
    embeddings = GoogleGenerativeAIEmbeddings(
        model="models/gemini-embedding-001",
        task_type="retrieval_document",
        google_api_key=GOOGLE_API_KEY
    )

    
    vector_store = Chroma(
        embedding_function=embeddings,
        persist_directory=str(CHROMA_PATH)
    )
    
    # Kiểm tra xem đã làm được bao nhiêu rồi
    try:
        existing_count = vector_store._collection.count()
        logger.info(f"Database đang có sẵn: {existing_count} chunks.")
    except:
        existing_count = 0
        logger.info("Database chưa có dữ liệu.")

    # 5. TÍNH TOÁN ĐIỂM BẮT ĐẦU (RESUME LOGIC)
    if existing_count > 0:
        if existing_count >= total_docs:
            logger.info(" Dữ liệu đã đầy đủ (Full). Không cần chạy nữa!")
            return
        
        logger.info(f"Đã làm xong {existing_count} cái. Sẽ bỏ qua và chạy tiếp từ cái thứ {existing_count + 1}...")
        docs_to_process = all_split_docs[existing_count:]
    else:
        docs_to_process = all_split_docs

    logger.info(f"Bắt đầu import {len(docs_to_process)} chunks còn lại.")

    # 6. CHẠY TIẾP (Batching)
    BATCH_SIZE = 5
    DELAY_SECONDS = 5  # Nghỉ 5 giây cho an toàn

    for i in range(0, len(docs_to_process), BATCH_SIZE):
        batch = docs_to_process[i : i + BATCH_SIZE]
        
        current_idx = existing_count + i
        
        success = False
        retry_count = 0
        
        while not success and retry_count < 3:
            try:
                vector_store.add_documents(documents=batch)
                logger.info(f" Batch {(current_idx)//BATCH_SIZE + 1}: Xong {len(batch)} chunks. Nghỉ {DELAY_SECONDS}s...")
                time.sleep(DELAY_SECONDS)
                success = True
            except Exception as e:
                error_msg = str(e)
                retry_count += 1
                
                wait_time = 65 
                match = re.search(r"retry in (\d+\.?\d*)s", error_msg)
                if match:
                    wait_time = float(match.group(1)) + 5
                
                logger.error(f"Lỗi (Lần {retry_count}): {e}")
                logger.info(f"Đợi {wait_time:.1f}s để Google mở lại cổng...")
                time.sleep(wait_time)

        if not success:
            logger.error(f"Dừng tại chunk {current_idx} vì lỗi quá 3 lần.")
            break 

    logger.info("Import hoàn tất!")

if __name__ == "__main__":
    main()