import { ObjectId } from 'mongodb';

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface LocationMention {
  _id?: ObjectId;
  session_id: string;
  user_id?: string;
  location_name: string;
  coordinates?: Coordinates;
  address?: string;
  place_id?: string; // Google Place ID hoặc ID nội bộ
  category?: string; // cafe, restaurant, tourist_spot, etc.
  timestamp: Date;
  context: string; // Câu hỏi gốc của user
  metadata?: {
    intent?: string; // search, navigate, save, etc.
    sentiment?: 'positive' | 'neutral' | 'negative';
    is_recommendation?: boolean;
  };
}

export const createLocationMention = (
  session_id: string,
  location_name: string,
  context: string,
  coordinates?: Coordinates
): LocationMention => ({
  session_id,
  location_name,
  context,
  coordinates,
  timestamp: new Date()
});

// Indexes for geospatial queries
export const locationMentionIndexes = [
  { key: { coordinates: '2dsphere' } },
  { key: { session_id: 1 } },
  { key: { timestamp: -1 } },
  { key: { location_name: 'text' } },
  { key: { category: 1 } },
  { key: { place_id: 1 } }
];

// Aggregation helpers
export const getHeatmapData = (days: number = 7) => [
  {
    $match: {
      timestamp: { 
        $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) 
      },
      coordinates: { $exists: true }
    }
  },
  {
    $group: {
      _id: {
        lat: { $round: ['$coordinates.lat', 4] },
        lng: { $round: ['$coordinates.lng', 4] }
      },
      location_name: { $first: '$location_name' },
      mention_count: { $sum: 1 },
      categories: { $addToSet: '$category' },
      recent_contexts: { $push: { $substr: ['$context', 0, 100] } }
    }
  },
  {
    $sort: { mention_count: -1 }
  },
  {
    $limit: 200
  }
];

export const getTrendingLocations = (days: number = 7, limit: number = 10) => [
  {
    $match: {
      timestamp: { 
        $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) 
      }
    }
  },
  {
    $group: {
      _id: '$location_name',
      mention_count: { $sum: 1 },
      coordinates: { $first: '$coordinates' },
      category: { $first: '$category' },
      latest_mention: { $max: '$timestamp' }
    }
  },
  {
    $sort: { mention_count: -1 }
  },
  {
    $limit: limit
  }
];