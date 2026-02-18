// app/api/search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getVectorStore } from '@/lib/langchain/agent/vectorStore';

export async function POST(request: NextRequest) {
  try {
    const { query, k = 5 } = await request.json();

    // Tự động dùng store theo VECTOR_STORE_TYPE
    const vectorStore = await getVectorStore();
    
    const results = await vectorStore.similaritySearchWithScore(query, k);


    return NextResponse.json({
      success: true,
      data: {
        results: results.map(([doc, score]) => ({
          name: doc.metadata.name,
          content: doc.pageContent,
          score,
          metadata: doc.metadata,
        })),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}