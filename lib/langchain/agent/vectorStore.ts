import { QdrantVectorStore } from '@langchain/qdrant';
import { QdrantClient } from '@qdrant/js-client-rest';
import { Chroma } from '@langchain/community/vectorstores/chroma';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';

// Singleton instances
let vectorStoreInstance: QdrantVectorStore | Chroma | null = null;
let isVectorStoreInitialized = false;

// Vector store type from environment
const VECTOR_STORE_TYPE = process.env.VECTOR_STORE_TYPE || 'qdrant';

/**
 VECTOR_STORE_TYPE in .env to choose: 'qdrant' or 'chroma'
 */
export async function getVectorStore(): Promise<QdrantVectorStore | Chroma> {
  if (!vectorStoreInstance || !isVectorStoreInitialized) {
    
    const embeddings = new GoogleGenerativeAIEmbeddings({
      model: "models/gemini-embedding-001",
      apiKey: process.env.GOOGLE_API_KEY,
    });

    if (VECTOR_STORE_TYPE === 'qdrant') {
      console.log('Initializing Qdrant Vector Store...');
      
      const client = new QdrantClient({
        url: process.env.QDRANT_URL,
        apiKey: process.env.QDRANT_API_KEY,
      });

      vectorStoreInstance = await QdrantVectorStore.fromExistingCollection(
        embeddings,
        {
          client,
          collectionName: process.env.QDRANT_COLLECTION_NAME || "langchain",
          contentPayloadKey: "page_content",
        }
      );

      console.log('Qdrant Vector Store initialized');
      
    } else if (VECTOR_STORE_TYPE === 'chroma') {
      console.log('Initializing Chroma Vector Store...');
      
      vectorStoreInstance = await Chroma.fromExistingCollection(embeddings, {
        collectionName: process.env.CHROMA_COLLECTION_NAME || "langchain",
        url: process.env.CHROMA_URL,
        collectionMetadata: {
          "hnsw:space": "cosine",
        },
      });

      console.log('Chroma Vector Store initialized');
      
    } else {
      throw new Error(`Unsupported VECTOR_STORE_TYPE: ${VECTOR_STORE_TYPE}. Use 'qdrant' or 'chroma'`);
    }

    isVectorStoreInitialized = true;
  }

  return vectorStoreInstance;
}

/**
 * Reset vector store (useful for testing or switching stores)
 */
export function resetVectorStore() {
  vectorStoreInstance = null;
  isVectorStoreInitialized = false;
  console.log('Vector Store reset');
}

/**
 * Get current vector store type
 */
export function getVectorStoreType(): 'qdrant' | 'chroma' {
  return VECTOR_STORE_TYPE as 'qdrant' | 'chroma';
}

/**
 * Check if vector store is initialized
 */
export function isInitialized(): boolean {
  return isVectorStoreInitialized;
}