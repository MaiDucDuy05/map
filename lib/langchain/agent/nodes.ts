// langchain/agent/nodes.ts
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { Document } from "@langchain/core/documents";
import { SystemMessage } from "@langchain/core/messages";
import { AgentStateType } from "./state";
import { allTools } from "./tools";
import { extractAllLocations } from "../utils/extractors";
import { END } from "@langchain/langgraph";

let vectorStoreInstance: Chroma | null = null;
let isVectorStoreInitialized = false;

async function getVectorStore(): Promise<Chroma> {
  if (!vectorStoreInstance || !isVectorStoreInitialized) {
    
    const embeddings = new GoogleGenerativeAIEmbeddings({
      model: "models/gemini-embedding-001",
      apiKey: process.env.GOOGLE_API_KEY,
    });

    vectorStoreInstance = await Chroma.fromExistingCollection(embeddings, {
      collectionName: "langchain",
      url: process.env.CHROMA_URL,
      collectionMetadata: {
        "hnsw:space": "l2",
      },
    });

    isVectorStoreInitialized = true;
    console.log("Vector Store initialized");
  }

  return vectorStoreInstance;
}


// ===== NODE 1: ROUTER =====
export async function routerNode(state: AgentStateType) {
  const lastMessage = state.messages[state.messages.length - 1];
  const query = lastMessage.content as string;

  console.log("Router analyzing query...");

  const llm = new ChatGoogleGenerativeAI({
    model: "models/gemini-2.5-flash-preview-tts",
    temperature: 0, 
    maxOutputTokens: 10,
    apiKey: process.env.GOOGLE_API_KEY,
  });

  const routerPrompt = `Bạn là một bộ phân loại câu hỏi du lịch Hà Nội.

Nhiệm vụ: Xác định câu hỏi có cần tra cứu cơ sở dữ liệu địa điểm không.

Trả lời "YES" nếu câu hỏi:
- Hỏi về địa điểm, quán ăn, nhà hàng, cafe cụ thể
- Hỏi về địa chỉ, giờ mở cửa, giá vé
- Hỏi về gợi ý tham quan, ăn uống
- Hỏi về đường đi, cách di chuyển
- Hỏi về lịch trình du lịch

Trả lời "NO" nếu câu hỏi:
- Chào hỏi thông thường (xin chào, hi, hello...)
- Hỏi về bạn là ai
- Câu hỏi không liên quan đến địa điểm du lịch
- Cảm ơn, tạm biệt

Câu hỏi: "${query}"

Chỉ trả lời YES hoặc NO:`;

  try {
    const response = await llm.invoke(routerPrompt);
    const decision = (response.content as string).trim().toUpperCase();
    const needsRetrieval = decision.includes("YES");

    console.log(`Router decision: ${decision} → needsRetrieval = ${needsRetrieval}`);

    return {
      query,
      needsRetrieval,
    };
  } catch (error) {
    console.error("Router LLM error, fallback to regex:", error);

    const needsRetrieval = 
      /địa điểm|quán|nhà hàng|chùa|đền|bảo tàng|hồ|phố|cafe|ăn uống|tham quan|du lịch/i.test(query) ||
      /nào|đâu|gì|như thế nào|làm sao|ở đâu|gần/i.test(query);

    return {
      query,
      needsRetrieval,
    };
  }
}

// ===== NODE 2: RETRIEVAL =====
export async function retrievalNode(state: AgentStateType) {
  if (!state.needsRetrieval) {
    console.log("Skipping retrieval");
    return { retrievedDocs: [], extractedLocations: [] };
  }

  try {
    const vectorStore = await getVectorStore();
    const retriever = vectorStore.asRetriever({
      k: 3,
      searchType: "similarity",
    });

    const contextDocs = await retriever.invoke(state.query); 
    
    const extractedLocations = extractAllLocations(contextDocs);

    
    return { 
      retrievedDocs: contextDocs,
      extractedLocations,
    };
  } catch (error: any) {
    console.error("Retrieval error:", error);
    return { 
      retrievedDocs: [], 
      extractedLocations: [] 
    };
  }
}

// ===== NODE 3: AGENT LLM =====
export async function agentNode(state: AgentStateType) {
  console.log("Agent processing...");
  const llm = new ChatGoogleGenerativeAI({
    model: "models/gemini-flash-lite-latest",
    temperature: 0.3,
    maxOutputTokens: 2048, 
    apiKey: process.env.GOOGLE_API_KEY,
  });

  const llmWithTools = llm.bindTools(allTools);

  const formatDocs = (docs: Document[]) => {
    return docs
      .map((doc, i) => `[Tài liệu ${i + 1}]\n${doc.pageContent}`)
      .join("\n\n");
  };

  let contextStr = "";
  
  if (state.retrievedDocs && state.retrievedDocs.length > 0) {
    const formattedContext = formatDocs(state.retrievedDocs);
    contextStr = `\n\nNgữ cảnh (Thông tin tìm được):\n${formattedContext}`;
  }

  if (state.conversationContext) {
    contextStr = `\n\nCuộc hội thoại trước:\n${state.conversationContext}` + contextStr;
  }

  if (state.userPreferences && Object.keys(state.userPreferences).length > 0) {
    contextStr += `\n\nSở thích người dùng: ${JSON.stringify(state.userPreferences)}`;
  }

  const systemMessage = new SystemMessage(`Bạn là một hướng dẫn viên du lịch Hà Nội thân thiện và am hiểu.

Hãy sử dụng thông tin ngữ cảnh dưới đây để trả lời câu hỏi của người dùng.

**Nguyên tắc trả lời:**
- Nếu thông tin không có trong ngữ cảnh, hãy nói thật là bạn không biết, đừng cố bịa ra.
- Câu trả lời cần ngắn gọn, xúc tích nhưng đầy đủ thông tin (địa chỉ, giá vé, tips nếu có).
- Trả lời bằng Markdown format: sử dụng headings (##), lists, **bold** để dễ đọc.

**Công cụ khả dụng:**
1. vector_search - Tìm kiếm thêm thông tin về địa điểm
2. mongo_search - Tìm lịch sử người dùng
3. get_user_preferences - Lấy sở thích người dùng
4. add_map_marker - Thêm marker lên bản đồ
5. navigate_map - Điều hướng bản đồ đến vị trí
6. create_route - Tạo đường đi giữa 2 điểm
7. save_location_mention - Lưu địa điểm vào lịch sử

**Hành động tự động:**
- Khi có tọa độ, hãy tự động navigate hoặc thêm marker để người dùng dễ xem
- Khi gợi ý nhiều địa điểm, add markers cho tất cả
- Luôn thân thiện, nhiệt tình bằng tiếng Việt

${contextStr}`);
  const response = await llmWithTools.invoke([
    systemMessage,
    ...state.messages,
  ]);

  console.log(` Agent response generated`);

  return {
    messages: [response],
  };
}

// ===== NODE 4: EXTRACT MAP ACTIONS =====
export async function extractMapActionsNode(state: AgentStateType) {
  const lastMessage = state.messages[state.messages.length - 1];
  const mapActions: any[] = [];

  if (lastMessage && 'tool_calls' in lastMessage && lastMessage.tool_calls) {
    for (const toolCall of lastMessage.tool_calls) {
      if (['add_map_marker', 'navigate_map', 'create_route'].includes(toolCall.name)) {
        mapActions.push({
          type: toolCall.name,
          args: toolCall.args,
        });
      }
    }
    
    console.log(`📍 Extracted ${mapActions.length} map actions`);
  }

  return { mapActions };
}

// ===== CONDITIONAL EDGES =====
export function shouldContinue(state: AgentStateType) {
  const lastMessage = state.messages[state.messages.length - 1];
  
  if (lastMessage && 'tool_calls' in lastMessage && lastMessage.tool_calls?.length) {
    console.log(`🔧 Routing to tools (${lastMessage.tool_calls.length} calls)`);
    return "tools";
  }
  
  console.log("✅ Ending workflow");
  return END;
}

export function shouldRetrieve(state: AgentStateType) {
  return state.needsRetrieval ? "retrieval" : "agent";
}