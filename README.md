# Travel Assistant - Interactive Map

Ứng dụng bản đồ tương tác thông minh hỗ trợ du lịch Hà Nội với AI, tích hợp chatbot trả lời câu hỏi bằng tiếng Việt và thao tác trực tiếp trên bản đồ.

##  Tính năng

###  Bản đồ tương tác
- **Vẽ shapes**: Hình chữ nhật, hình tròn, mũi tên, text
- **Tùy chỉnh màu sắc**: Stroke color và fill color với bảng màu đa dạng
- **Quản lý layers**: Ẩn/hiện, ghim, sắp xếp thứ tự layers
- **Điều hướng**: Pan, zoom, chọn điểm trên bản đồ

### AI Chatbot (RAG)
- Trả lời câu hỏi về du lịch Hà Nội bằng tiếng Việt
- Tìm kiếm địa điểm, gợi ý lịch trình
- **Thao tác trực tiếp trên bản đồ**:
  - Thêm marker địa điểm
  - Tạo lộ trình di chuyển
  - Zoom đến vị trí cụ thể
  - Vẽ vùng polygon

###  Tính năng Routing
- Tính tuyến đường với OpenRouteService API
- Hỗ trợ các phương tiện: ô tô, đi bộ, xe đạp
- Hiển thị chỉ dẫn từng bước (step-by-step directions)
- Đo khoảng cách và thời gian di chuyển

### Thống kê POI
- Phân tích các địa điểm (POI) trong vùng được vẽ
- Lấy dữ liệu từ OpenStreetMap qua Overpass API
- Hiển thị số lượng theo loại: nhà hàng, khách sạn, điểm du lịch,...

### Chế độ Presentation
- Hỗ trợ nhiều slides (slides control)
- Chế độ trình chiếu toàn màn hình
- Điều hướng bằng phím mũi tên

### ↩ Undo/Redo
- Hỗ trợ undo/redo đầy đủ (Ctrl+Z, Ctrl+Y)
- Lưu lịch sử các thao tác: tạo layer, xóa, ẩn/hiện, ghim, sắp xếp

### Lưu trữ dữ liệu
- MongoDB lưu trữ lịch sử hội thoại
- Vector Database (Qdrant/ChromaDB) cho RAG
- LangChain/LangGraph cho AI agent orchestration

---

## Cài đặt

```
bash
# Cài đặt dependencies
npm install

# Chạy development server
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000) để xem ứng dụng.

---

## ⚙️ Cấu hình biến môi trường

Tạo file `.env`:

```
env
# MongoDB
MONGODB_URI=mongodb://localhost:27017/hanoi_travel

# OpenRouteService (Routing)
NEXT_PUBLIC_ORS_API_KEY=your_ors_api_key

# Google Generative AI (LLM)
GOOGLE_API_KEY=your_google_api_key

# Vector Database (Qdrant)
QDRANT_HOST=localhost
QDRANT_PORT=6333
QDRANT_API_KEY=your_qdrant_api_key
```

---

## Cấu trúc dự án

```
├── app/                        # Next.js App Router
│   ├── api/                    # API Routes
│   │   ├── chat/               # Chat API (RAG)
│   │   ├── feedback/           # Feedback API
│   │   ├── heatmap/            # Heatmap API
│   │   └── itinerary/          # Itinerary API
│   ├── contexts.tsx            # React Contexts
│   ├── page.tsx                # Main page
│   └── history-stack.ts        # Undo/redo implementation
│
├── components/                 # React Components
│   ├── home/                   # Map components
│   │   ├── map.tsx             # Main map
│   │   ├── toolbar.tsx         # Drawing toolbar
│   │   ├── sidebar.tsx         # Sidebar
│   │   ├── routing-panel.tsx   # Route planning
│   │   ├── drawing-layer.tsx   # Drawing shapes
│   │   └── ...
│   └── ui/                     # UI components
│
├── hooks/                      # Custom React Hooks
│   ├── useChat.ts              # Chat logic
│   ├── useRouting.ts           # Route calculation
│   └── useWeatherData.ts       # Weather data
│
├── lib/                        # Core libraries
│   ├── db/                     # MongoDB models
│   │   └── models/              # Data models
│   ├── langchain/              # LangChain integration
│   │   ├── agent/               # AI Agent
│   │   │   ├── graph.ts        # LangGraph
│   │   │   ├── nodes.ts        # Agent nodes
│   │   │   └── tools.ts        # Custom tools
│   │   └── services/           # AI Services
│   └── services/               # Business services
│
├── prepare_data/               # Data collection pipeline
│   ├── osm_collector.py        # OSM data collector
│   ├── wikipedia_enricher.py    # Wikipedia enrichment
│   ├── web_crawler.py          # Web scraping
│   └── import_to_vectordb.py   # Import to vector DB
│
├── types/                      # TypeScript types
└── utils/                      # Utility functions
```

---

##  Công nghệ sử dụng

| Category | Technology |
|----------|------------|
| Framework | Next.js 16, React 19 |
| Language | TypeScript |
| Styling | TailwindCSS |
| Maps | Leaflet, React-Leaflet |
| AI/ML | LangChain, LangGraph, Google Generative AI |
| Database | MongoDB |
| Vector DB | Qdrant, ChromaDB |
| Routing | OpenRouteService API |
| Maps Data | OpenStreetMap (Overpass API) |

---

## Hướng dẫn sử dụng

### 1. Sử dụng bản đồ

- **Chọn công cụ vẽ**: Click các nút Rect, Circle, Arrow, Text trên toolbar
- **Chọn màu**: Click vào nút Stroke/Fill để chọn màu
- **Vẽ hình**: Click và kéo trên bản đồ
- **Quản lý layers**: Sử dụng panel bên phải để ẩn/hiện, ghim, xóa layers
- **Hand tool**: Click Hand để di chuyển bản đồ

### 2. Sử dụng AI Chatbot

- Click nút chatbot ở góc phải màn hình để mở chat
- Hỏi về địa điểm du lịch Hà Nội
- Chatbot sẽ:
  - Trả lời bằng tiếng Việt
  - Hiển thị các địa điểm được tìm thấy
  - Cho phép xem nguồn tham khảo
  - **Thao tác trực tiếp trên bản đồ** (thêm marker, tạo route, zoom)

### 3. Tính khoảng cách

1. Click nút mở sidebar (nếu đang đóng)
2. Chọn "Chọn Điểm Bắt Đầu" và click trên bản đồ
3. Chọn "Chọn Điểm Kết Thúc" và click trên bản đồ
4. Route sẽ được hiển thị với thông tin khoảng cách và thời gian

### 4. Phân tích vùng

1. Vẽ một polygon (hình đa giác) trên bản đồ
2. Hệ thống sẽ tự động phân tích các POI trong vùng
3. Xem kết quả trong panel thống kê

### 5. Chế độ Presentation

1. Click nút "Present" trên toolbar
2. Sử dụng mũi phải/trái để điều hướng giữa các layers
3. Nhấn ESC để thoát

---

## API Endpoints

### Chat API
```
POST /api/chat
Body: { message: string, sessionId?: string, userId?: string }
Response: { response: string, sessionId: string, sources: [], mapActions: [] }
```

### Feedback API
```
POST /api/feedback
Body: { sessionId, messageId, userMessage, aiMessage, feedbackType }
```

### Heatmap API
```
POST /api/heatmap
Body: { bounds: { north, south, east, west } }
Response: { heatmapData: [] }
```

### Itinerary API
```
POST /api/itinerary
Body: { locations: [], preferences: {} }
Response: { itinerary: {} }
```

---

## 📦 Data Pipeline

Xem chi tiết tại [prepare_data/README.md](prepare_data/README.md)

### Thu thập dữ liệu du lịch

```
bash
cd prepare_data
pip install -r requirements.txt
python main.py
```

Output: `hanoi_tourism_data/04_final_rag_ready.json`

---

## Các tham chiếu

- CSS Triangles: https://stackoverflow.com/questions/7073484/how-do-css-triangles-work
- Optimize Rerender: https://react.dev/reference/react/useContext#optimizing-re-renders-when-passing-objects-and-functions
