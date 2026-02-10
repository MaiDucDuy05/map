import { MongoClient } from 'mongodb';
import { Conversation } from '../db/models/conversation';
import { createLocationMention } from '../db/models/location-mention';
import { HanoiTravelRAG, getRAGInstance } from '../langchain/rag-service';
import { Document } from "@langchain/core/documents";

interface ProcessQueryResult {
  response: string;
  sources: Array<{
    name: string;
    content: string;
    coordinates?: { lat: number; lng: number };
    category?: string;
    tips?: string[];
  }>;
  conversationId: string;
  extractedLocations?: Array<{
    name: string;
    coordinates: { lat: number; lng: number };
    category: string;
    nearbyRestaurants?: string[];
    visitDuration?: string;
  }>;
  debugInfo?: {
    contextUsed: string;
    retrievedDocs: number;
    preferences: any;
    documentsUsed?: Array<{
      name: string;
      relevanceScore?: number;
    }>;
  };
}

/**
 * Integrated Conversational RAG Service
 * Kết hợp: Python RAG + MongoDB Memory + Entity Tracking
 */
export class ConversationalRAG {
  private mongoClient: MongoClient;
  private ragService: HanoiTravelRAG;
  
  constructor(mongoClient: MongoClient, ragService: HanoiTravelRAG) {
    this.mongoClient = mongoClient;
    this.ragService = ragService;
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

    // Step 2: Build context
    const contextWindow = this.buildContextWindow(conversation.messages, 3);

    // Step 3: Enhance query if needed
    const enhancedQuery = this.shouldUseContext(userQuery, contextWindow) 
      ? this.enhanceQueryWithContext(userQuery, contextWindow, conversation.user_preferences)
      : userQuery;

    console.log(`Query: "${userQuery}"`);
    if (enhancedQuery !== userQuery) {
      console.log(`Enhanced with context`);
    }

    // Step 4: RAG query
    const ragResponse = await this.ragService.query(enhancedQuery);


    //  Extract rich metadata from context documents
    const extractedLocations = this.extractLocationData(ragResponse.context);
    
    // : Enhance sources with coordinates and metadata
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

    // Step 5: Extract & save entities (Enhanced với context)
    const entities = await this.extractEntities(
      userQuery, 
      ragResponse.answer,
      ragResponse.context
    );
    
    if (entities.length > 0 && extractedLocations) {
      await this.saveLocationMentions(sessionId, entities, userQuery, userId,extractedLocations );
    }

    // Step 6: Update preferences
    const updatedPreferences = this.updateUserPreferences(
      conversation.user_preferences || {},
      entities
    );

    // Step 7: Save conversation
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
                  sources: ragResponse.sources.map(s => s.name),
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

    return {
      response: ragResponse.answer,
      sources: enhancedSources,
      extractedLocations,
      conversationId: conversation._id?.toString() || '',
      debugInfo: {
        contextUsed: contextWindow,
        retrievedDocs: ragResponse.context.length,
        preferences: updatedPreferences,
        documentsUsed: ragResponse.context.map(doc => ({
          name: doc.metadata?.name || 'Unknown',
          relevanceScore: doc.metadata?.score,
        }))
      }
    };
  }

  // ========== HELPER METHODS ==========

  private buildContextWindow(messages: any[], windowSize: number = 3): string {
    if (messages.length === 0) return '';
    const recentMessages = messages.slice(-windowSize * 2);
    return recentMessages
      .map(msg => `${msg.role === 'user' ? 'Người dùng' : 'Trợ lý'}: ${msg.content}`)
      .join('\n');
  }

  private shouldUseContext(query: string, context: string): boolean {
    if (!context) return false;
    const pronouns = ['đó', 'này', 'nó', 'ở đây', 'vậy', 'thế'];
    return pronouns.some(p => query.toLowerCase().includes(p)) || query.length < 50;
  }

  private enhanceQueryWithContext(query: string, context: string, preferences?: any): string {
    let enhanced = `Dựa trên cuộc hội thoại:\n${context}\n\nCâu hỏi: ${query}`;
    if (preferences?.preferred_categories?.length) {
      enhanced += `\n(Sở thích: ${preferences.preferred_categories.join(', ')})`;
    }
    return enhanced;
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

  // ✨ NEW: Parse coordinates from document content
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

  async getConversation(sessionId: string): Promise<Conversation | null> {
    const db = this.mongoClient.db();
    return db.collection<Conversation>('conversations').findOne({ session_id: sessionId });
  }
}

export async function createIntegratedRAG(mongoClient: MongoClient): Promise<ConversationalRAG> {
  const ragService = await getRAGInstance();
  return new ConversationalRAG(mongoClient, ragService);
}

export default ConversationalRAG;