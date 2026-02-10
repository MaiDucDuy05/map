import { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { PromptTemplate } from "@langchain/core/prompts";
import { Document } from "@langchain/core/documents";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";
import "dotenv/config";


interface RAGResponse {
  answer: string;
  context: Document[];
  sources: Array<{
    name: string;
    content: string;
  }>;
}




export class HanoiTravelRAG {
  private vectorStore: Chroma | null = null;
  private qaChain: any = null;
  private isInitialized = false;

  constructor() {}


  async initialize(): Promise<void> {
    try {
      console.log("Đang khởi động Chatbot Du lịch Hà Nội...");

      // 1. Setup embeddings (same as Python)
      const embeddings = new GoogleGenerativeAIEmbeddings({
        model: "models/gemini-embedding-001",
        apiKey: process.env.GOOGLE_API_KEY,
      });

      // 2. Load existing Chroma database
      this.vectorStore = await Chroma.fromExistingCollection(embeddings, {
        collectionName: "langchain",
        url: process.env.CHROMA_URL,
        collectionMetadata: {
          "hnsw:space": "l2", 
        },
      });


      // 3. Initialize LLM (Gemini)
      const llm = new ChatGoogleGenerativeAI({
        model: "models/gemini-flash-latest",
        temperature: 0.3,
        maxOutputTokens: 2048,
        apiKey: process.env.GOOGLE_API_KEY,
      });

      // 4. Create prompt template (exact translation from Python)
      const promptTemplate = PromptTemplate.fromTemplate(`Bạn là một hướng dẫn viên du lịch Hà Nội thân thiện và am hiểu.
          Hãy sử dụng thông tin ngữ cảnh dưới đây để trả lời câu hỏi của người dùng.

          Nếu thông tin không có trong ngữ cảnh, hãy nói thật là bạn không biết, đừng cố bịa ra.
          Câu trả lời cần ngắn gọn, xúc tích nhưng đầy đủ thông tin (địa chỉ, giá vé, tips nếu có).

          Ngữ cảnh (Thông tin tìm được):
          {context}

          Câu hỏi của khách: {question}

          Câu trả lời:`);

      // 5. Create retriever (k=3 like Python)
      const retriever = this.vectorStore.asRetriever({
        k: 3,
        searchType: "similarity",
      });

      // 6. Create RAG chain using LCEL (LangChain Expression Language)
      // This is equivalent to Python's create_retrieval_chain
      const formatDocs = (docs: Document[]) => {
        return docs.map((doc, i) => `[Tài liệu ${i + 1}]\n${doc.pageContent}`).join("\n\n");
      };

      this.qaChain = RunnableSequence.from([
        {
          context: RunnableSequence.from([
          (input: { question: string }) => input.question,
          retriever,
          formatDocs
        ]),
          question: (input: { question: string }) => input.question,
        },
        promptTemplate,
        llm,
        new StringOutputParser(),
      ]);

      this.isInitialized = true;
      console.log(" RAG System initialized successfully!");

    } catch (error) {
      console.error("Failed to initialize RAG system:", error);
      throw error;
    }
  }


  /**
   * Query the RAG system (main interface)
   */
  async query(question: string): Promise<RAGResponse> {
    if (!this.isInitialized || !this.qaChain) {
      throw new Error("RAG system not initialized. Call initialize() first.");
    }

    console.log("🔍 Đang tìm kiếm thông tin...");

    try {
      // Step 1: Get relevant documents
      const retriever = this.vectorStore!.asRetriever({ k: 3 });
      const contextDocs = await retriever.invoke(question);

      // Step 2: Generate answer using chain
      const answer = await this.qaChain.invoke({ question });

      
      // Step 3: Format sources
      const sources = contextDocs.map((doc: Document, i: number) => ({
        name: doc.metadata?.name || `Nguồn ${i + 1}`,
        content: doc.pageContent.replace(/\n/g, ' ').substring(0, 200) + '...',
      }));

      return {
        answer,
        context: contextDocs,
        sources,
      };

    } catch (error: any) {
      console.error("❌ Query error:", error);
      throw new Error(`RAG query failed: ${error.message}`);
    }
  }

  /**
   * Get detailed context for debugging (like Python DEBUG output)
   */
  async queryWithDebug(question: string): Promise<{
    response: RAGResponse;
    debug: {
      contextCount: number;
      documents: Array<{
        source: string;
        preview: string;
        fullContent: string;
      }>;
    };
  }> {
    const response = await this.query(question);



    const debug = {
      contextCount: response.context.length,
      documents: response.context.map((doc, i) => ({
        source: doc.metadata?.name || 'Nguồn ẩn',
        preview: doc.pageContent.substring(0, 200) + '...',
        fullContent: doc.pageContent,
      })),
    };

    return { response, debug };
  }


  /**
   * Similarity search only (no LLM generation)
   */
  async similaritySearch(
    query: string,
    k: number = 3
  ): Promise<Document[]> {
    if (!this.vectorStore) {
      throw new Error("Vector store not initialized");
    }

    return this.vectorStore.similaritySearch(query, k);
  }

  /**
   * Add new documents to vector store
   */
  async addDocuments(docs: Document[]): Promise<void> {
    if (!this.vectorStore) {
      throw new Error("Vector store not initialized");
    }

    await this.vectorStore.addDocuments(docs);
    console.log(`✅ Added ${docs.length} documents to vector store`);
  }

  /**
   * Check if system is ready
   */
  isReady(): boolean {
    return this.isInitialized && this.qaChain !== null;
  }
}

// Singleton instance
let ragInstance: HanoiTravelRAG | null = null;

/**
 * Get or create RAG instance
 */
export async function getRAGInstance(): Promise<HanoiTravelRAG> {
  if (!ragInstance) {
    ragInstance = new HanoiTravelRAG();
    await ragInstance.initialize();
  }
  return ragInstance;
}

export default HanoiTravelRAG;

