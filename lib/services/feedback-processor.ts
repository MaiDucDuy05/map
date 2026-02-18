import { MongoClient } from 'mongodb';
import { Feedback, createFeedback, FeedbackType } from '../db/models/feedback';

export interface KnowledgeGap {
  topic: string;
  count: number;
  examples: string[];
  priority: 'high' | 'medium' | 'low';
}

export interface FeedbackStats {
  total_feedback: number;
  thumbs_up: number;
  thumbs_down: number;
  satisfaction_rate: number;
  top_issues: Array<{ type: string; count: number }>;
}

export class FeedbackProcessor {
  private mongoClient: MongoClient;

  constructor(mongoClient: MongoClient) {
    this.mongoClient = mongoClient;
  }

  /**
   * Save user feedback
   */
  async saveFeedback(
    sessionId: string,
    messageId: string,
    query: string,
    response: string,
    feedbackType: FeedbackType,
    options?: {
      userCorrection?: string;
      missingTopic?: string;
      errorType?: string;
    }
  ): Promise<string> {
    const db = this.mongoClient.db();
    const feedbacks = db.collection<Feedback>('feedback');

    const feedback = createFeedback(
      sessionId,
      messageId,
      query,
      response,
      feedbackType
    );

    if (options) {
      feedback.user_correction = options.userCorrection;
      feedback.metadata = {
        missing_topic: options.missingTopic,
        error_type: options.errorType as any
      };
    }

    const result = await feedbacks.insertOne(feedback);
    
    // Nếu có correction, auto-process ngay
    if (options?.userCorrection) {
      await this.processUserCorrection(result.insertedId.toString(), options.userCorrection);
    }

    return result.insertedId.toString();
  }

  /**
   * Phát hiện knowledge gaps
   */
  async detectKnowledgeGaps(
    timeRange: number = 7, // days
    minCount: number = 3
  ): Promise<KnowledgeGap[]> {
    const db = this.mongoClient.db();
    const cutoffDate = new Date(Date.now() - timeRange * 24 * 60 * 60 * 1000);

    const pipeline = [
      {
        $match: {
          feedback_type: 'thumbs_down',
          timestamp: { $gte: cutoffDate }
        }
      },
      {
        $group: {
          _id: '$metadata.missing_topic',
          count: { $sum: 1 },
          examples: { $push: '$query' },
          avg_confidence: { $avg: '$metadata.confidence_score' }
        }
      },
      {
        $match: {
          count: { $gte: minCount },
          _id: { $ne: null }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 20
      }
    ];

    const results = await db.collection('feedback').aggregate(pipeline).toArray();

    return results.map(r => ({
      topic: r._id as string,
      count: r.count,
      examples: r.examples.slice(0, 5), // Top 5 examples
      priority: r.count >= 10 ? 'high' : r.count >= 5 ? 'medium' : 'low'
    }));
  }

  /**
   * Process user correction và tạo training data
   */
  async processUserCorrection(
    feedbackId: string,
    correction: string
  ): Promise<void> {
    const db = this.mongoClient.db();
    const feedbacks = db.collection<Feedback>('feedback');
    const trainingData = db.collection('training_data');

    const feedback = await feedbacks.findOne({ _id: feedbackId as any });
    if (!feedback) return;

    // Create training pair
    const trainingPair = {
      question: feedback.query,
      answer: correction,
      source: 'user_feedback',
      created_at: new Date(),
      quality_score: 1.0, // Assume user corrections are high quality
      metadata: {
        original_response: feedback.response,
        feedback_id: feedbackId
      }
    };

    await trainingData.insertOne(trainingPair);

    // Mark feedback as processed
    await feedbacks.updateOne(
      { _id: feedbackId as any },
      { 
        $set: { 
          processed: true,
          admin_notes: 'Auto-processed: Added to training data'
        } 
      }
    );

    // TODO: Optionally embed vào Vector DB ngay
    // await this.embedToVectorDB(trainingPair);
  }

  /**
   * Get feedback statistics
   */
  async getFeedbackStats(timeRange: number = 30): Promise<FeedbackStats> {
    const db = this.mongoClient.db();
    const cutoffDate = new Date(Date.now() - timeRange * 24 * 60 * 60 * 1000);

    const pipeline = [
      {
        $match: {
          timestamp: { $gte: cutoffDate }
        }
      },
      {
        $facet: {
          by_type: [
            {
              $group: {
                _id: '$feedback_type',
                count: { $sum: 1 }
              }
            }
          ],
          by_error: [
            {
              $match: {
                'metadata.error_type': { $exists: true }
              }
            },
            {
              $group: {
                _id: '$metadata.error_type',
                count: { $sum: 1 }
              }
            },
            {
              $sort: { count: -1 }
            }
          ]
        }
      }
    ];

    const [result] = await db.collection('feedback').aggregate(pipeline).toArray();



    const typeMap = new Map<string, number>();


    const total = Array.from(typeMap.values()).reduce((a, b) => a + b, 0);
    const thumbsUp = typeMap.get('thumbs_up') || 0;
    const thumbsDown = typeMap.get('thumbs_down') || 0;

    return {
      total_feedback: total,
      thumbs_up: thumbsUp,
      thumbs_down: thumbsDown,
      satisfaction_rate: total > 0 ? (thumbsUp / total) * 100 : 0,
      top_issues: result.by_error.map((e: any) => ({
        type: e._id,
        count: e.count
      }))
    };
  }

  /**
   * Get unprocessed feedback cần review
   */
  async getUnprocessedFeedback(limit: number = 50): Promise<Feedback[]> {
    const db = this.mongoClient.db();
    
    return db.collection<Feedback>('feedback')
      .find({ 
        processed: false,
        feedback_type: { $in: ['thumbs_down', 'correction'] }
      })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
  }

  /**
   * Batch process corrections (admin tool)
   */
  async batchProcessCorrections(feedbackIds: string[]): Promise<number> {
    let processed = 0;

    for (const id of feedbackIds) {
      try {
        const db = this.mongoClient.db();
        const feedback = await db.collection<Feedback>('feedback')
          .findOne({ _id: id as any });

        if (feedback?.user_correction) {
          await this.processUserCorrection(id, feedback.user_correction);
          processed++;
        }
      } catch (error) {
        console.error(`Failed to process feedback ${id}:`, error);
      }
    }

    return processed;
  }

  /**
   * Generate weekly report
   */
  async generateWeeklyReport(): Promise<{
    stats: FeedbackStats;
    knowledge_gaps: KnowledgeGap[];
    unprocessed_count: number;
  }> {
    const [stats, gaps, unprocessed] = await Promise.all([
      this.getFeedbackStats(7),
      this.detectKnowledgeGaps(7),
      this.getUnprocessedFeedback(1).then(f => f.length)
    ]);

    return {
      stats,
      knowledge_gaps: gaps,
      unprocessed_count: unprocessed
    };
  }
}

export default FeedbackProcessor;