import { IndexSpecification, ObjectId } from 'mongodb';

export type FeedbackType = 'thumbs_up' | 'thumbs_down' | 'correction' | 'flag';

export interface Feedback {
  _id?: ObjectId;
  session_id: string;
  message_id: string;
  query: string;
  response: string;
  feedback_type: FeedbackType;
  user_correction?: string;
  timestamp: Date;
  metadata?: {
    retrieval_sources?: string[];
    confidence_score?: number;
    missing_topic?: string;
    error_type?: 'hallucination' | 'missing_info' | 'incorrect' | 'outdated';
  };
  processed?: boolean;
  admin_notes?: string;
}

export const createFeedback = (
  session_id: string,
  message_id: string,
  query: string,
  response: string,
  feedback_type: FeedbackType
): Feedback => ({
  session_id,
  message_id,
  query,
  response,
  feedback_type,
  timestamp: new Date(),
  processed: false
});

// Indexes
export const feedbackIndexes: {
  key: IndexSpecification;
}[] = [
  { key: { session_id: 1, message_id: 1 } },
  { key: { feedback_type: 1 } },
  { key: { timestamp: -1 } },
  { key: { processed: 1 } },
  { key: { 'metadata.missing_topic': 1 } }
];
