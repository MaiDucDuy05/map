import { IndexSpecification, ObjectId } from 'mongodb';

export interface Message {
  msg_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    extracted_entities?: string[];
    intent?: string;
    sources?: string[];
    confidence?: number;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
}

export interface UserPreferences {
  preferred_categories?: string[];
  budget_range?: string;
  visited_places?: string[];
  preferred_districts?: string[];
  travel_mode?: 'walking' | 'driving' | 'transit';
}

export interface Conversation {
  _id?: ObjectId;
  session_id: string;
  user_id?: string;
  created_at: Date;
  last_active: Date;
  context_summary?: string;
  messages: Message[];
  user_preferences?: UserPreferences;
  metadata?: {
    total_turns: number;
    avg_response_time?: number;
    language?: string;
  };
}

// Helper functions
export const createConversation = (session_id: string, user_id?: string): Conversation => ({
  session_id,
  user_id,
  created_at: new Date(),
  last_active: new Date(),
  messages: [],
  user_preferences: {},
  metadata: {
    total_turns: 0,
    language: 'vi'
  }
});

export const addMessage = (
  conversation: Conversation,
  role: Message['role'],
  content: string,
  metadata?: Message['metadata']
): Conversation => {
  const message: Message = {
    msg_id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    role,
    content,
    timestamp: new Date(),
    metadata
  };

  return {
    ...conversation,
    messages: [...conversation.messages, message],
    last_active: new Date(),
    metadata: {
      ...conversation.metadata,
      total_turns: conversation.metadata!.total_turns + (role === 'user' ? 1 : 0)
    }
  };
};

// MongoDB indexes
export const conversationIndexes: {
  key: IndexSpecification;
  unique?: boolean;
}[] = [
  { key: { session_id: 1 }, unique: true },
  { key: { user_id: 1 } },
  { key: { last_active: -1 } },
  { key: { created_at: -1 } },
  { key: { 'messages.timestamp': -1 } }
];