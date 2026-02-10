import { NextRequest, NextResponse } from 'next/server';
import { getMongoClient } from '@/lib/db/mongo';
import { FeedbackProcessor } from '@/lib/services/feedback-processor';
import { FeedbackType } from '@/lib/db/models/feedback';

// POST: Submit feedback
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      sessionId,
      messageId,
      query,
      response,
      feedbackType,
      userCorrection,
      missingTopic,
      errorType
    } = body;

    // Validation
    if (!sessionId || !messageId || !feedbackType) {
      return NextResponse.json(
        { error: 'sessionId, messageId, and feedbackType are required' },
        { status: 400 }
      );
    }

    if (!['thumbs_up', 'thumbs_down', 'correction', 'flag'].includes(feedbackType)) {
      return NextResponse.json(
        { error: 'Invalid feedbackType' },
        { status: 400 }
      );
    }

    const mongoClient =  await getMongoClient();
    const processor = new FeedbackProcessor(mongoClient);

    const feedbackId = await processor.saveFeedback(
      sessionId,
      messageId,
      query,
      response,
      feedbackType as FeedbackType,
      {
        userCorrection,
        missingTopic,
        errorType
      }
    );

    return NextResponse.json({
      success: true,
      data: {
        feedbackId,
        message: userCorrection 
          ? 'Cảm ơn bạn! Đóng góp của bạn sẽ giúp tôi cải thiện.'
          : 'Cảm ơn phản hồi của bạn!'
      }
    });

  } catch (error) {
    console.error('Feedback API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET: Get feedback stats hoặc knowledge gaps
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type'); // 'stats' hoặc 'gaps'
    const days = parseInt(searchParams.get('days') || '7');

    const mongoClient = await getMongoClient();
    const processor = new FeedbackProcessor(mongoClient);

    if (type === 'gaps') {
      const gaps = await processor.detectKnowledgeGaps(days);
      
      return NextResponse.json({
        success: true,
        data: {
          knowledgeGaps: gaps,
          timeRange: `${days} days`
        }
      });
    }

    if (type === 'stats') {
      const stats = await processor.getFeedbackStats(days);
      
      return NextResponse.json({
        success: true,
        data: stats
      });
    }

    if (type === 'report') {
      const report = await processor.generateWeeklyReport();
      
      return NextResponse.json({
        success: true,
        data: report
      });
    }

    // Default: return unprocessed feedback
    const unprocessed = await processor.getUnprocessedFeedback(50);
    
    return NextResponse.json({
      success: true,
      data: {
        unprocessed,
        count: unprocessed.length
      }
    });

  } catch (error) {
    console.error('Get feedback error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}