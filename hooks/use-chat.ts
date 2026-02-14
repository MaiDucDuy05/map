// hooks/useChat.ts
import { useState, useCallback, useEffect } from 'react';

// Type definitions
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: any[];
  extractedLocations?: ExtractedLocation[];
  mapActions?: MapAction[];
}

export interface ExtractedLocation {
  name: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  category: string;
  nearbyRestaurants?: string[];
  visitDuration?: string;
}

export interface MapAction {
  type: 'add_map_marker' | 'create_route' | 'fly_to' | 'add_polygon' | 'clear_markers';
  args: {
    lat?: number;
    lng?: number;
    title?: string;
    description?: string;
    start?: [number, number];
    end?: [number, number];
    zoom?: number;
    points?: [number, number][];
  };
}

export interface UseChatOptions {
  sessionId?: string;
  userId?: string;
  onError?: (error: Error) => void;
  persistSession?: boolean;
  storageKey?: string;
  onMapAction?: (action: MapAction) => void; // ✨ NEW: Callback for map actions
}

// Storage helper functions remain the same...
const STORAGE_KEY_PREFIX = 'hanoi-travel-chat-session';

const getStorageKey = (userId?: string, customKey?: string): string => {
  if (customKey) return customKey;
  return userId ? `${STORAGE_KEY_PREFIX}-${userId}` : STORAGE_KEY_PREFIX;
};

const saveSessionToStorage = (sessionId: string, storageKey: string): void => {
  try {
    localStorage.setItem(storageKey, sessionId);
    localStorage.setItem(`${storageKey}-timestamp`, new Date().toISOString());
  } catch (error) {
    console.error('Failed to save session to localStorage:', error);
  }
};

const loadSessionFromStorage = (storageKey: string): string | null => {
  try {
    const sessionId = localStorage.getItem(storageKey);
    const timestamp = localStorage.getItem(`${storageKey}-timestamp`);
    
    if (sessionId && timestamp) {
      const sessionAge = Date.now() - new Date(timestamp).getTime();
      const MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
      
      if (sessionAge > MAX_AGE) {
        console.log('Session expired, creating new session');
        clearSessionFromStorage(storageKey);
        return null;
      }
    }
    
    return sessionId;
  } catch (error) {
    console.error('Failed to load session from localStorage:', error);
    return null;
  }
};

const clearSessionFromStorage = (storageKey: string): void => {
  try {
    localStorage.removeItem(storageKey);
    localStorage.removeItem(`${storageKey}-timestamp`);
  } catch (error) {
    console.error('Failed to clear session from localStorage:', error);
  }
};

/**
 * Custom hook cho chat với conversational memory và map integration
 */
export function useChat(options: UseChatOptions = {}) {
  const {
    sessionId: initialSessionId,
    userId,
    onError,
    persistSession = true,
    storageKey: customStorageKey,
    onMapAction // ✨ NEW
  } = options;

  const storageKey = getStorageKey(userId, customStorageKey);
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>(() => {
    if (initialSessionId) return initialSessionId;
    if (persistSession) {
      const stored = loadSessionFromStorage(storageKey);
      return stored || undefined;
    }
    return undefined;
  });

  useEffect(() => {
    if (sessionId) {
      loadConversation(sessionId);
    }
  }, [sessionId]);

  useEffect(() => {
    if (sessionId && persistSession) {
      saveSessionToStorage(sessionId, storageKey);
    }
  }, [sessionId, persistSession, storageKey]);

  const loadConversation = async (sid: string) => {
    try {
      const response = await fetch(`/api/chat?sessionId=${sid}`);
      const data = await response.json();

      if (data.success) {
        const history = data.data.messages.map((msg: any) => ({
          id: msg.msg_id,
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.timestamp),
          sources: msg.metadata?.sources,
          extractedLocations: msg.metadata?.extractedLocations,
          mapActions: msg.metadata?.mapActions
        }));
        setMessages(history);
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  };

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          sessionId,
          userId: userId
        })
      });

      const data = await response.json();

      if (data.success) {
        if (!sessionId && data.data.sessionId) {
          setSessionId(data.data.sessionId);
        }

        const assistantMessage: Message = {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: data.data.response,
          timestamp: new Date(),
          sources: data.data.sources,
          extractedLocations: data.data.extractedLocations, // ✨ NEW
          mapActions: data.data.mapActions // ✨ NEW
        };
        
        setMessages(prev => [...prev, assistantMessage]);

        // ✨ Execute map actions if callback provided
        if (data.data.mapActions && onMapAction) {
          data.data.mapActions.forEach((action: MapAction) => {
            onMapAction(action);
          });
        }
      } else {
        throw new Error(data.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Send message error:', error);
      onError?.(error as Error);
      setMessages(prev => prev.filter(m => m.id !== userMessage.id));
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, userId, onError, onMapAction]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setSessionId(undefined);
    
    if (persistSession) {
      clearSessionFromStorage(storageKey);
    }
  }, [persistSession, storageKey]);

  const startNewSession = useCallback(() => {
    setMessages([]);
    setSessionId(undefined);
    
    if (persistSession) {
      clearSessionFromStorage(storageKey);
    }
  }, [persistSession, storageKey]);

  return {
    messages,
    isLoading,
    sessionId,
    sendMessage,
    clearChat,
    startNewSession,
  };
}

/**
 * Custom hook cho feedback
 */
export function useFeedback() {
  const submitFeedback = useCallback(async (
    sessionId: string,
    messageId: string,
    query: string,
    response: string,
    feedbackType: 'thumbs_up' | 'thumbs_down' | 'correction',
    options?: {
      userCorrection?: string;
      missingTopic?: string;
      errorType?: string;
    }
  ) => {
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          messageId,
          query,
          response,
          feedbackType,
          ...options
        })
      });

      const data = await res.json();

      if (data.success) {
        return data.data;
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Submit feedback error:', error);
      throw error;
    }
  }, []);

  return { submitFeedback };
}

/**
 * Custom hook cho heatmap data
 */
export function useHeatmap(days: number = 7) {
  const [heatmapData, setHeatmapData] = useState<any>(null);
  const [trending, setTrending] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadHeatmap = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/heatmap?days=${days}`);
      const data = await response.json();

      if (data.success) {
        setHeatmapData(data.data.geoJSON);
      }
    } catch (error) {
      console.error('Load heatmap error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [days]);

  const loadTrending = useCallback(async (limit: number = 10) => {
    try {
      const response = await fetch(
        `/api/heatmap?type=trending&days=${days}&limit=${limit}`
      );
      const data = await response.json();

      if (data.success) {
        setTrending(data.data.trending);
      }
    } catch (error) {
      console.error('Load trending error:', error);
    }
  }, [days]);

  useEffect(() => {
    loadHeatmap();
    loadTrending();
  }, [loadHeatmap, loadTrending]);

  return {
    heatmapData,
    trending,
    isLoading,
    refresh: () => {
      loadHeatmap();
      loadTrending();
    }
  };
}

/**
 * Custom hook cho itinerary
 */
export function useItinerary(userId: string) {
  const [itineraries, setItineraries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadItineraries = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/itinerary?userId=${userId}`);
      const data = await response.json();

      if (data.success) {
        setItineraries(data.data.itineraries);
      }
    } catch (error) {
      console.error('Load itineraries error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  const createItinerary = useCallback(async (
    title: string,
    places: any[],
    options?: { description?: string; autoOptimize?: boolean }
  ) => {
    try {
      const response = await fetch('/api/itinerary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          title,
          places,
          ...options
        })
      });

      const data = await response.json();

      if (data.success) {
        await loadItineraries(); // Reload list
        return data.data.itinerary;
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Create itinerary error:', error);
      throw error;
    }
  }, [userId, loadItineraries]);

  const deleteItinerary = useCallback(async (itineraryId: string) => {
    try {
      const response = await fetch(`/api/itinerary?id=${itineraryId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        setItineraries(prev => prev.filter(i => i._id !== itineraryId));
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Delete itinerary error:', error);
      throw error;
    }
  }, []);

  useEffect(() => {
    if (userId) {
      loadItineraries();
    }
  }, [userId, loadItineraries]);

  return {
    itineraries,
    isLoading,
    createItinerary,
    deleteItinerary,
    refresh: loadItineraries
  };
}