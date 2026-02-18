// lib/services/conversational-rag.ts
import { MongoClient } from 'mongodb';
import { Conversation } from '../db/models/conversation';
import { createLocationMention } from '../db/models/location-mention';
import { getAgentInstance } from '@/lib/langchain/services/agent-service';
import { Document } from "@langchain/core/documents";

interface ProcessQueryResult {
  response: string;
  sources: Array<{
    name: string;
    content: string;
    coordinates?: { lat: number; lng: number };
    category?: string;
    tips?: string[];
    nearbyRestaurants?: string[];
  }>;
  conversationId: string;
  extractedLocations: Array<{
    name: string;
    coordinates: { lat: number; lng: number };
    category: string;
    nearbyRestaurants?: string[];
    visitDuration?: string;
  }>;
  mapActions: Array<{
    type: string;
    args: any;
  }>;
  debugInfo?: {
    contextUsed: string;
    retrievedDocs: number;
    preferences: any;
    toolCallsCount: number;
    documentsUsed?: Array<{
      name: string;
      relevanceScore?: number;
    }>;
  };
}

/**
 * Conversational RAG Service with LangGraph Agent
 * Integrates: LangGraph Agent + MongoDB Memory + Entity Tracking
 */
export class ConversationalRAG {
  private mongoClient: MongoClient;
  
  constructor(mongoClient: MongoClient) {
    this.mongoClient = mongoClient;
  }

  /**
   * Main processing pipeline
   */
  async processQuery(
    userQuery: string,
    sessionId: string,
    userId?: string
  ): Promise<ProcessQueryResult> {
    const db = this.mongoClient.db();
    const conversations = db.collection<Conversation>('conversations');

    // Step 1: Load/create conversation
    let conversation = await conversations.findOne({ session_id: sessionId });
    
    if (!conversation) {
      conversation = {
        session_id: sessionId,
        user_id: userId,
        created_at: new Date(),
        last_active: new Date(),
        messages: [],
        user_preferences: {},
        metadata: { total_turns: 0, language: 'vi' }
      };
      await conversations.insertOne(conversation);
    }

    // Step 2: Build context window
    const contextWindow = this.buildContextWindow(conversation.messages, 3);


    // Step 3: Get user preferences
    const userPreferences = conversation?.user_preferences || {};


    // Step 4: Run LangGraph Agent
    const agent = await getAgentInstance();
    const ragResponse = await agent.query(userQuery, sessionId, {
      userId,
      conversationContext: contextWindow,
      userPreferences,
    });

    const extractedLocations = this.extractLocationData(ragResponse.context);

    const enhancedSources = ragResponse.sources.map((source, idx) => {
      const doc = ragResponse.context[idx];
      if (!doc) return source;
      
      return {
        ...source,
        coordinates: this.parseCoordinates(doc.pageContent),
        category: this.extractCategory(doc.pageContent),
        tips: this.extractTips(doc.pageContent),
      };
    });


    // Step 5: Extract entities from response
    const entities = await this.extractEntities(
      userQuery, 
      ragResponse.answer,
      ragResponse.context
    );

    // Step 6: Save location mentions to MongoDB
    if (entities.length > 0 && extractedLocations) {
      await this.saveLocationMentions(sessionId, entities, userQuery, userId,extractedLocations );
    }

    // Step 7: Update user preferences based on entities
    const updatedPreferences = this.updateUserPreferences(
      userPreferences,
      entities,
    );

    // Step 8: Save conversation to MongoDB
    await conversations.updateOne(
      { session_id: sessionId },
      {
        $push: {
          messages: {
            $each: [
              {
                msg_id: `msg_${Date.now()}_user`,
                role: 'user' as const,
                content: userQuery,
                timestamp: new Date(),
                metadata: { extracted_entities: entities.map(e => e.text) }
              },
              {
                msg_id: `msg_${Date.now()}_assistant`,
                role: 'assistant' as const,
                content: ragResponse.answer,
                timestamp: new Date(),
                metadata: {
                  sources:enhancedSources,
                  context_used: contextWindow.length > 0,
                  locations_found: extractedLocations.length
                }
              }
            ]
          }
        },
        $set: {
          last_active: new Date(),
          user_preferences: updatedPreferences,
          'metadata.total_turns': (conversation.metadata?.total_turns || 0) + 1
        }
      }
    );


    // Step 9: Return formatted result
    return {
      response: ragResponse.answer,
      sources: enhancedSources,
      extractedLocations,
      mapActions: ragResponse.mapActions,
      conversationId: conversation._id?.toString() || '',
      debugInfo: {
        contextUsed: contextWindow,
        retrievedDocs: ragResponse.sources.length,
        preferences: updatedPreferences,
        toolCallsCount: ragResponse.toolCalls.length,
        documentsUsed: ragResponse.context.map(doc => ({
          name: doc.metadata?.name || 'Unknown',
          relevanceScore: doc.metadata?.score,
        }))
      }
    };
  }

  /**
   * Get conversation by sessionId
   */
  async getConversation(sessionId: string): Promise<Conversation | null> {
    const db = this.mongoClient.db();
    return db.collection<Conversation>('conversations').findOne({ 
      session_id: sessionId 
    });
  }

  /**
   * Get conversation statistics
   */
  async getConversationStats(sessionId: string) {
    const conversation = await this.getConversation(sessionId);
    
    if (!conversation) {
      return null;
    }

    const totalMessages = conversation.messages.length;
    const userMessages = conversation.messages.filter(m => m.role === 'user').length;
    const assistantMessages = conversation.messages.filter(m => m.role === 'assistant').length;

    return {
      sessionId: conversation.session_id,
      totalMessages,
      userMessages,
      assistantMessages,
      totalTurns: conversation.metadata?.total_turns || 0,
      createdAt: conversation.created_at,
      lastActive: conversation.last_active,
      preferences: conversation.user_preferences,
    };
  }

  // ========== PRIVATE HELPER METHODS ==========

  /**
   * Build context window from recent messages
   */
   private buildContextWindow(messages: any[], windowSize: number = 3): string {
    if (messages.length === 0) return '';
    const recentMessages = messages.slice(-windowSize * 2);
    return recentMessages
      .map(msg => `${msg.role === 'user' ? 'Người dùng' : 'Trợ lý'}: ${msg.content}`)
      .join('\n');
  }

  //   Extract location data from RAG context documents
  private extractLocationData(documents: Document[]): Array<{
    name: string;
    coordinates: { lat: number; lng: number };
    category: string;
    nearbyRestaurants: string[];
    visitDuration?: string;
  }> {
    return documents.map(doc => {
      const coords = this.parseCoordinates(doc.pageContent);
      const restaurants = this.extractRestaurants(doc.pageContent);
      const duration = this.extractVisitDuration(doc.pageContent);
      
      return {
        name: doc.metadata?.name || this.extractLocationName(doc.pageContent),
        coordinates: coords || { lat: 0, lng: 0 },
        category: this.extractCategory(doc.pageContent),
        nearbyRestaurants: restaurants,
        visitDuration: duration,
      };
    }).filter(loc => loc.coordinates.lat !== 0);
  }

  // NEW: Parse coordinates from document content
  private parseCoordinates(content: string): { lat: number; lng: number } | null {
    const match = content.match(/Tọa độ:\s*([\d.]+),\s*([\d.]+)/);
    if (match) {
      return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
    }
    return null;
  }

  //  NEW: Extract nearby restaurants
  private extractRestaurants(content: string): string[] {
    const restaurantSection = content.match(/Đề xuất quán ăn ngon lân cận:([\s\S]+?)(?=\n\n|$)/);
    if (!restaurantSection) return [];
    
    const restaurants = restaurantSection[1]
      .split('\n')
      .filter(line => line.trim().startsWith('-'))
      .map(line => line.replace(/^-\s*/, '').trim());
    
    return restaurants;
  }

  //Extract travel tips
  private extractTips(content: string): string[] {
    const tipsSection = content.match(/Lưu ý khi tham quan \(Tips\):([\s\S]+?)(?=Thời gian|$)/);
    if (!tipsSection) return [];
    
    return tipsSection[1]
      .split('\n')
      .filter(line => line.trim().startsWith('-'))
      .map(line => line.replace(/^-\s*/, '').trim());
  }

  //Extract visit duration
  private extractVisitDuration(content: string): string | undefined {
    const match = content.match(/Thời gian tham quan dự kiến:\s*([^\n]+)/);
    return match ? match[1].trim() : undefined;
  }

  // Extract category
  private extractCategory(content: string): string {
    const match = content.match(/Danh mục:\s*([^\n]+)/);
    return match ? match[1].trim() : 'unknown';
  }

  //Extract location name
  private extractLocationName(content: string): string {
    const match = content.match(/Địa điểm:\s*([^\n]+)/);
    return match ? match[1].trim() : 'Unknown Location';
  }

  // Extract entities from query, answer AND context documents
  private async extractEntities(
    query: string, 
    response: string,
    contextDocs?: Document[]
  ): Promise<Array<{ text: string; type: string }>> {
    const patterns = [
      /(?:Hồ|Phố|Đường|Quán|Nhà hàng|Chùa|Đền|Bảo tàng|Công viên|Tượng đài|Đài)\s+([A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ][a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ\s]+)/gi,
    ];
    
    const entities: Array<{ text: string; type: string }> = [];
    let combinedText = `${query} ${response}`;
    
    //Add context documents to entity extraction
    if (contextDocs && contextDocs.length > 0) {
      const contextText = contextDocs
        .map(doc => this.extractLocationName(doc.pageContent))
        .join(' ');
      combinedText += ` ${contextText}`;
    }
    
    for (const pattern of patterns) {
      const matches = combinedText.matchAll(pattern);
      for (const match of matches) {
        entities.push({ text: match[0], type: 'LOCATION' });
      }
    }
    
    return Array.from(new Map(entities.map(e => [e.text.toLowerCase(), e])).values());
  }

  private async saveLocationMentions(
      sessionId: string,
      entities: Array<{ text: string; type: string }>,
      context: string,
      userId?: string,
      extractedLocations?: Array<{  // ← NEW parameter
        name: string;
        coordinates: { lat: number; lng: number };
        category: string;
      }>
    ): Promise<void> {
      const db = this.mongoClient.db();
      
      const mentions = entities
        .filter(e => e.type === 'LOCATION')
        .flatMap(entity => {
          const locationData = extractedLocations?.find(
            loc =>
              loc.name.toLowerCase().includes(entity.text.toLowerCase()) ||
              entity.text.toLowerCase().includes(loc.name.toLowerCase())
          );

          if (!locationData?.coordinates) return [];

          return [
            createLocationMention(
              sessionId,
              entity.text,
              context,
              locationData.coordinates
            )
          ];
        });

      
      if (mentions.length > 0) {
        await db.collection('location_mentions').insertMany(
          mentions.map(m => ({ ...m, user_id: userId }))
        );
      }
    }

  private updateUserPreferences(
    current: any, 
    entities: Array<{ text: string; type: string }>
  ): any {
    const newCategories = entities
      .map(e => this.inferCategory(e.text))
      .filter(Boolean);
    
    const merged = [...new Set([...(current.preferred_categories || []), ...newCategories])];
    
    return { 
      ...current, 
      preferred_categories: merged.slice(0, 10) 
    };
  }

  private inferCategory(text: string): string | null {
    const patterns: Record<string, RegExp[]> = {
      cafe: [/cafe|cà phê|coffee/i],
      restaurant: [/nhà hàng|quán ăn|phở|bún|cơm|lẩu/i],
      tourist_spot: [/hồ|đền|chùa|bảo tàng|di tích|tượng đài/i],
      park: [/công viên|vườn/i]
    };
    
    for (const [category, regexes] of Object.entries(patterns)) {
      if (regexes.some(regex => regex.test(text))) return category;
    }
    
    return null;
  }

}

/**
 * Factory function to create ConversationalRAG instance
 */
export async function createIntegratedRAG(mongoClient: MongoClient): Promise<ConversationalRAG> {
  console.log('🔧 Creating ConversationalRAG instance with LangGraph Agent');
  return new ConversationalRAG(mongoClient);
}

export default ConversationalRAG;