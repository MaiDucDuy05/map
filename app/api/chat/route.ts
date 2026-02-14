// import { NextRequest, NextResponse } from 'next/server';
// import { getMongoClient } from '@/lib/db/mongo';
// import { createIntegratedRAG } from '@/lib/services/conversational-rag';
// import { v4 as uuidv4 } from 'uuid';

// // Cache RAG instance globally
// let ragInstance: any = null;

// export async function POST(req: NextRequest) {
//   try {
//     const body = await req.json();
//     const { message, sessionId, userId } = body;

//     if (!message) {
//       return NextResponse.json(
//         { error: 'Message is required' },
//         { status: 400 }
//       );
//     }

//     // Generate session ID nếu chưa có
//     const session = sessionId || uuidv4();

//     // Initialize services (reuse instance)
//     const mongoClient = await getMongoClient();
    
//     if (!ragInstance) {
//       console.log('Initializing RAG service...');
//       ragInstance = await createIntegratedRAG(mongoClient);
//       console.log('RAG service ready');
//     }

//     // Process query với conversation memory + RAG
//     const result = await ragInstance.processQuery(message, session, userId);

//     return NextResponse.json({
//       success: true,
//       data: {
//         response: result.response,
//         sessionId: session,
//         conversationId: result.conversationId,
//         sources: result.sources,
//         debug: result.debugInfo // Include debug info
//       }
//     });

//   } catch (error) {
//     console.error('Chat API error:', error);
//     return NextResponse.json(
//       { 
//         error: 'Internal server error',
//         message: error instanceof Error ? error.message : 'Unknown error'
//       },
//       { status: 500 }
//     );
//   }
// }

// // GET: Lấy lịch sử conversation
// export async function GET(req: NextRequest) {
//   try {
//     const { searchParams } = new URL(req.url);
//     const sessionId = searchParams.get('sessionId');

//     if (!sessionId) {
//       return NextResponse.json(
//         { error: 'sessionId is required' },
//         { status: 400 }
//       );
//     }

//     const mongoClient = await getMongoClient();
//     const ragService =  await createIntegratedRAG(mongoClient);

//     const conversation = await ragService.getConversation(sessionId);

//     if (!conversation) {
//       return NextResponse.json(
//         { error: 'Conversation not found' },
//         { status: 404 }
//       );
//     }

//     return NextResponse.json({
//       success: true,
//       data: {
//         sessionId: conversation.session_id,
//         messages: conversation.messages,
//         preferences: conversation.user_preferences,
//         createdAt: conversation.created_at,
//         lastActive: conversation.last_active
//       }
//     });

//   } catch (error) {
//     console.error('Get conversation error:', error);
//     return NextResponse.json(
//       { error: 'Internal server error' },
//       { status: 500 }
//     );
//   }
// }


// app/api/chat/route.ts

// app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getMongoClient } from '@/lib/db/mongo';
import { createIntegratedRAG } from '@/lib/services/rag';
import { v4 as uuidv4 } from 'uuid';

// Cache RAG instance
let ragInstance: any = null;

/**
 * POST /api/chat - Send a message
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, sessionId, userId } = body;

    // Validation
    if (!message?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Message is required' },
        { status: 400 }
      );
    }

    // Generate session ID if not provided
    const session = sessionId || uuidv4();

    // Initialize services (reuse cached instance)
    const mongoClient = await getMongoClient();
    
    if (!ragInstance) {
      console.log('🔄 Initializing RAG service...');
      ragInstance = await createIntegratedRAG(mongoClient);
      console.log('✅ RAG service ready');
    }

    // Process query with conversation memory + RAG
    const result = await ragInstance.processQuery(message, session, userId);

    // Return response
    return NextResponse.json({
      success: true,
      data: {
        response: result.response,
        sessionId: session,
        conversationId: result.conversationId,
        sources: result.sources,
        extractedLocations: result.extractedLocations,
        mapActions: result.mapActions, // If you add this later
        debugInfo: result.debugInfo,
      },
    });

  } catch (error: any) {
    console.error('❌ Chat API error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Internal server error' 
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/chat?sessionId=xxx - Get conversation history
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    // Validation
    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'sessionId is required' },
        { status: 400 }
      );
    }

    // Get services
    const mongoClient = await getMongoClient();
    const ragService = await createIntegratedRAG(mongoClient);

    // Get conversation
    const conversation = await ragService.getConversation(sessionId);

    if (!conversation) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Return response
    return NextResponse.json({
      success: true,
      data: {
        sessionId: conversation.session_id,
        messages: conversation.messages,
        preferences: conversation.user_preferences,
        createdAt: conversation.created_at,
        lastActive: conversation.last_active,
        metadata: conversation.metadata,
      },
    });

  } catch (error: any) {
    console.error('❌ Get conversation error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Internal server error' 
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/chat?sessionId=xxx - Clear conversation
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    // Validation
    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'sessionId is required' },
        { status: 400 }
      );
    }

    // Get MongoDB client
    const mongoClient = await getMongoClient();
    const db = mongoClient.db();

    // Delete conversation
    const result = await db.collection('conversations').deleteOne({ 
      session_id: sessionId 
    });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Also delete location mentions
    await db.collection('location_mentions').deleteMany({ 
      session_id: sessionId 
    });

    // Return response
    return NextResponse.json({
      success: true,
      data: { 
        message: 'Conversation cleared successfully',
        sessionId 
      },
    });

  } catch (error: any) {
    console.error('❌ Delete conversation error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Internal server error' 
      },
      { status: 500 }
    );
  }
}