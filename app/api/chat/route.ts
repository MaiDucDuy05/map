import { NextRequest, NextResponse } from 'next/server';
import { getMongoClient } from '@/lib/db/mongo';
import { createIntegratedRAG } from '@/lib/services/conversational-rag';
import { v4 as uuidv4 } from 'uuid';

// Cache RAG instance globally
let ragInstance: any = null;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, sessionId, userId } = body;

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Generate session ID nếu chưa có
    const session = sessionId || uuidv4();

    // Initialize services (reuse instance)
    const mongoClient = await getMongoClient();
    
    if (!ragInstance) {
      console.log('Initializing RAG service...');
      ragInstance = await createIntegratedRAG(mongoClient);
      console.log('RAG service ready');
    }

    // Process query với conversation memory + RAG
    const result = await ragInstance.processQuery(message, session, userId);

    return NextResponse.json({
      success: true,
      data: {
        response: result.response,
        sessionId: session,
        conversationId: result.conversationId,
        sources: result.sources,
        debug: result.debugInfo // Include debug info
      }
    });

  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET: Lấy lịch sử conversation
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

    const mongoClient = await getMongoClient();
    const ragService =  await createIntegratedRAG(mongoClient);

    const conversation = await ragService.getConversation(sessionId);

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        sessionId: conversation.session_id,
        messages: conversation.messages,
        preferences: conversation.user_preferences,
        createdAt: conversation.created_at,
        lastActive: conversation.last_active
      }
    });

  } catch (error) {
    console.error('Get conversation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

