# Tourism Data Collection Pipeline

Pipeline thu thập dữ liệu du lịch Hà Nội từ nhiều nguồn cho RAG Chatbot.

##  Tính năng

-  **OpenStreetMap**: Lấy tọa độ, tên địa điểm chính xác
- **Wikipedia**: Thêm thông tin lịch sử, văn hóa phong phú
- **Web Crawling**: Thu thập tips, reviews từ web Travel
- **Cấu trúc dữ liệu phân tầng**: Tối ưu cho RAG
- **Metadata đầy đủ**: Hỗ trợ filtering và ranking

## Cài đặt

```bash
pip install -r requirements.txt --break-system-packages

# Hoặc với venv
python -m venv venv
source venv/bin/activate 
pip install -r requirements.txt
```

## Sử dụng

### Chạy full pipeline

```bash
python main.py
```

### Chạy từng module riêng lẻ

**1. Test OSM Collector:**
```bash
python osm_collector.py
```

**2. Test Wikipedia Enricher:**
```bash
python wikipedia_enricher.py
```

**3. Test Web Crawler:**
```bash
python web_crawler.py
```

**4. Test Data Processor:**
```bash
python data_processor.py
```

## 📊 Output

Dữ liệu sẽ được lưu trong thư mục `./hanoi_tourism_data/`:

```
hanoi_tourism_data/
├── 01_osm_raw.json              # Dữ liệu thô từ OSM
├── 02_wikipedia_enriched.json   # Đã thêm Wikipedia
├── 03_web_crawled.json          # Đã thêm web data
├── 04_final_rag_ready.json      # ★ File cuối cùng để dùng cho RAG
└── statistics.json              # Thống kê
```

##  Cấu trúc dữ liệu RAG

Mỗi địa điểm có cấu trúc:

```json
{
  "id": "way_123456",
  "name": "Văn Miếu - Quốc Tử Giám",
  "location": {
    "lat": 21.029,
    "lon": 105.835,
    "address": "..."
  },
  "layers": {
    "basic": {
      "category": "historic",
      "short_description": "..."
    },
    "historical": {
      "wikipedia_summary": "...",
      "significance": "...",
      "related_articles": [...]
    },
    "practical": {
      "opening_hours": "...",
      "tips": [...],
      "best_time_to_visit": "..."
    },
    "cultural": {
      "events": [...],
      "nearby_attractions": [...]
    }
  },
  "metadata": {
    "category": "historic",
    "has_wikipedia": true,
    "data_quality_score": 0.95,
    "tags": [...],
    "suitable_for": ["families", "students"]
  },
  "searchable_content": "Full text for search..."
}
```

## Tùy chỉnh

### Thêm/bớt categories

Trong `main.py`, chỉnh sửa:

```python
categories = [
    "historic",
    "tourism", 
    "museum",
    # Thêm category khác
]
```

### Thay đổi khu vực

Trong `osm_collector.py`, chỉnh sửa `CITY_BOUNDS`:

```python
CITY_BOUNDS = {
    "Hanoi": {
        "south": 20.95,
        "north": 21.15,
        "west": 105.70,
        "east": 105.90
    },
 
}
```

### Thêm nguồn web khác

Trong `web_crawler.py`, thêm vào `SOURCES`:

```python
SOURCES = {
    "vnexpress_travel": {...},
    "your_source": {
        "base_url": "...",
        "enabled": True
    }
}
```

## Workflow đề xuất

1. **Thu thập dữ liệu** (chạy 1 lần/tháng):
   ```bash
   python main.py
   ```

2. **Import vào Vector DB** (Chroma/Qdrant/...):
   ```python
   import json
   
   with open('hanoi_tourism_data/04_final_rag_ready.json') as f:
       documents = json.load(f)
   
   for doc in documents:
       text = doc['searchable_content']
       embedding = embed_function(text)
       vector_db.add(embedding, metadata=doc)
   ```

3. **Sử dụng trong RAG Chatbot**:
   ```python
   query = "Địa điểm lịch sử nào ở Hà Nội phù hợp cho gia đình?"
   
   results = vector_db.search(query, k=3, 
       filter={"suitable_for": "families"})
   
   # Generate answer với LLM
   context = "\n\n".join([r['searchable_content'] for r in results])
   answer = llm.generate(query, context)
   ```

## Cải thiện chất lượng

### Tăng độ phủ
- Mở rộng bounding box trong `CITY_BOUNDS`
- Thêm nhiều categories trong OSM query
- Crawl thêm nhiều website

### Tăng độ chính xác
- Verify thông tin chéo giữa các nguồn
- Thêm manual review cho POI quan trọng
- Cập nhật định kỳ

### Tối ưu RAG
- Embed từng layer riêng để search chính xác hơn
- Dùng hybrid search (semantic + keyword)
- Implement reranking với cross-encoder

## Xử lý lỗi thường gặp

**1. Overpass API timeout:**
- Script tự động retry với các server khác
- Nếu vẫn lỗi, giảm kích thước bounding box

**2. Wikipedia không tìm thấy:**
- Bình thường, không phải tất cả địa điểm đều có trên Wikipedia
- Script sẽ bỏ qua và tiếp tục

**3. Web crawler bị block:**
- Script có rate limiting (2s/request)
- Nếu vẫn bị block, tăng delay trong `web_crawler.py`

## Logs

Check file `data_collection.log` để xem chi tiết quá trình chạy.

