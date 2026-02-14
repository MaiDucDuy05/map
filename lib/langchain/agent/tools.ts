// langchain/agent/tools.ts
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { MongoClient } from "mongodb";
import "dotenv/config";

// ===== VECTOR SEARCH TOOL =====
export const vectorSearchTool = tool(
  async ({ query }: { query: string }) => {
    try {
      const embeddings = new GoogleGenerativeAIEmbeddings({
        model: "models/gemini-embedding-001",
        apiKey: process.env.GOOGLE_API_KEY,
      });

      const vectorStore = await Chroma.fromExistingCollection(embeddings, {
        collectionName: "langchain",
        url: process.env.CHROMA_URL,
      });

      const docs = await vectorStore.similaritySearch(query, 3);
      
      return JSON.stringify({
        success: true,
        count: docs.length,
        documents: docs.map(doc => ({
          content: doc.pageContent,
          metadata: doc.metadata,
        })),
      });
    } catch (error) {
      return JSON.stringify({ success: false, error: String(error) });
    }
  },
  {
    name: "vector_search",
    description: "Search Hanoi travel knowledge base for locations, restaurants, and tourist information. Returns detailed information including coordinates, tips, and nearby restaurants.",
    schema: z.object({
      query: z.string().describe("Search query for Hanoi travel information"),
    }),
  }
);

// ===== MONGODB SEARCH TOOL =====
export const mongoSearchTool = tool(
  async ({ locationName }: { locationName: string }) => {
    try {
      const mongoClient = new MongoClient(process.env.MONGODB_URI!);
      await mongoClient.connect();
      
      const db = mongoClient.db();
      

      const mentions = await db.collection('location_mentions')
        .find({
          location_name: { $regex: locationName, $options: 'i' }
        })
        .limit(5)
        .toArray();

      await mongoClient.close();
      
      return JSON.stringify({
        success: true,
        mentions: mentions.map(m => ({
          name: m.location_name,
          context: m.context,
          coordinates: m.coordinates,
          timestamp: m.timestamp,
        })),
      });
    } catch (error) {
      return JSON.stringify({ success: false, error: String(error) });
    }
  },
  {
    name: "mongo_search",
    description: "Search user's previous location mentions and queries from MongoDB. Useful for personalized recommendations based on user history.",
    schema: z.object({
      locationName: z.string().describe("Location name to search in history"),
    }),
  }
);

// ===== USER PREFERENCES TOOL =====
export const getUserPreferencesTool = tool(
  async ({ userId }: { userId: string }) => {
    try {
      const mongoClient = new MongoClient(process.env.MONGODB_URI!);
      await mongoClient.connect();
      
      const db = mongoClient.db();
      const conversation = await db.collection('conversations').findOne({ user_id: userId });
      
      await mongoClient.close();
      
      return JSON.stringify({
        success: true,
        preferences: conversation?.user_preferences || {},
      });
    } catch (error) {
      return JSON.stringify({ success: false, error: String(error) });
    }
  },
  {
    name: "get_user_preferences",
    description: "Get user's saved preferences (favorite categories, visited places, etc.)",
    schema: z.object({
      userId: z.string().describe("User ID to fetch preferences"),
    }),
  }
);

// ===== MAP TOOLS =====
export const addMapMarkerTool = tool(
  async ({ lat, lng, title, description }: { 
    lat: number; 
    lng: number; 
    title: string; 
    description?: string;
  }) => {
    return JSON.stringify({
      action: "addMarker",
      data: { lat, lng, title, description },
    });
  },
  {
    name: "add_map_marker",
    description: "Add a marker to the map at specified coordinates. Use this when user asks to mark or highlight a location.",
    schema: z.object({
      lat: z.number().describe("Latitude coordinate"),
      lng: z.number().describe("Longitude coordinate"),
      title: z.string().describe("Marker title/name"),
      description: z.string().optional().describe("Marker description"),
    }),
  }
);

export const navigateMapTool = tool(
  async ({ lat, lng, zoom }: { lat: number; lng: number; zoom?: number }) => {
    return JSON.stringify({
      action: "flyTo",
      data: { lat, lng, zoom: zoom || 17 },
    });
  },
  {
    name: "navigate_map",
    description: "Navigate/pan the map to a specific location. Use when user asks to 'show me', 'take me to', or 'navigate to' a place.",
    schema: z.object({
      lat: z.number().describe("Latitude coordinate"),
      lng: z.number().describe("Longitude coordinate"),
      zoom: z.number().optional().describe("Zoom level (default: 17)"),
    }),
  }
);

export const createRouteTool = tool(
  async ({
    start,
    end,
  }: {
    start: number[];
    end: number[];
  }) => {
    return JSON.stringify({
      action: "setRoute",
      data: {
        start,
        end,
      },
    });
  },
  {
    name: "create_route",
    description:
      "Create a route between two locations on the map. Use when user asks for directions or 'how to get from A to B'.",
    schema: z.object({
      start: z
        .array(z.number())
        .length(2)
        .describe("Start coordinates as [lat, lng]"),

      end: z
        .array(z.number())
        .length(2)
        .describe("End coordinates as [lat, lng]"),
    }),
  }
);



// ===== SAVE TO MONGODB TOOL =====
export const saveLocationMentionTool = tool(
  async ({ sessionId, locationName, context, coordinates, userId }: {
    sessionId: string;
    locationName: string;
    context: string;
    coordinates?: { lat: number; lng: number };
    userId?: string;
  }) => {
    try {
      const mongoClient = new MongoClient(process.env.MONGODB_URI!);
      await mongoClient.connect();
      
      const db = mongoClient.db();
      await db.collection('location_mentions').insertOne({
        session_id: sessionId,
        location_name: locationName,
        context,
        coordinates,
        user_id: userId,
        timestamp: new Date(),
      });
      
      await mongoClient.close();
      
      return JSON.stringify({ success: true });
    } catch (error) {
      return JSON.stringify({ success: false, error: String(error) });
    }
  },
  {
    name: "save_location_mention",
    description: "Save a location mention to user's history for future personalization",
    schema: z.object({
      sessionId: z.string(),
      locationName: z.string(),
      context: z.string(),
      coordinates: z.object({
        lat: z.number(),
        lng: z.number(),
      }).optional(),
      userId: z.string().optional(),
    }),
  }
);

export const allTools = [
  vectorSearchTool,
  mongoSearchTool,
  getUserPreferencesTool,
  addMapMarkerTool,
  navigateMapTool,
  createRouteTool,
  saveLocationMentionTool,
];