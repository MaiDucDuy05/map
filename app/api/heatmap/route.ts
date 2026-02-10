import { NextRequest, NextResponse } from 'next/server';
import { getMongoClient } from '@/lib/db/mongo';
import { getHeatmapData, getTrendingLocations } from '@/lib/db/models/location-mention';

// GET: Heatmap data cho map visualization
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get('days') || '7');
    const type = searchParams.get('type') || 'heatmap'; 

    const mongoClient = await getMongoClient();
    const db = mongoClient.db();
    const locations = db.collection('location_mentions');

    if (type === 'trending') {
      const limit = parseInt(searchParams.get('limit') || '10');
      const pipeline = getTrendingLocations(days, limit);
      const trending = await locations.aggregate(pipeline).toArray();

      return NextResponse.json({
        success: true,
        data: {
          trending: trending.map(t => ({
            name: t._id,
            mentionCount: t.mention_count,
            coordinates: t.coordinates,
            category: t.category,
            latestMention: t.latest_mention
          })),
          timeRange: `${days} days`
        }
      });
    }

    // Default: heatmap data
    const pipeline = getHeatmapData(days);
    const heatmapData = await locations.aggregate(pipeline).toArray();

    // Format for Leaflet.js heatmap layer
    const geoJSON = {
      type: 'FeatureCollection',
      features: heatmapData.map(point => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [point._id.lng, point._id.lat] // [lng, lat] for GeoJSON
        },
        properties: {
          weight: point.mention_count,
          locationName: point.location_name,
          categories: point.categories,
          intensity: Math.min(point.mention_count / 10, 1), // Normalize 0-1
          recentContexts: point.recent_contexts?.slice(0, 3) // Top 3 contexts
        }
      }))
    };

    return NextResponse.json({
      success: true,
      data: {
        geoJSON,
        summary: {
          totalPoints: heatmapData.length,
          totalMentions: heatmapData.reduce((sum, p) => sum + p.mention_count, 0),
          timeRange: `${days} days`
        }
      }
    });

  } catch (error) {
    console.error('Heatmap API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: Manual add location mention (admin tool)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      sessionId,
      locationName,
      coordinates,
      category,
      context
    } = body;

    if (!sessionId || !locationName || !context) {
      return NextResponse.json(
        { error: 'sessionId, locationName, and context are required' },
        { status: 400 }
      );
    }

    const mongoClient = await getMongoClient();
    const db = mongoClient.db();

    const mention = {
      session_id: sessionId,
      location_name: locationName,
      coordinates: coordinates || null,
      category: category || null,
      context,
      timestamp: new Date()
    };

    const result = await db.collection('location_mentions').insertOne(mention);

    return NextResponse.json({
      success: true,
      data: {
        id: result.insertedId.toString(),
        message: 'Location mention added successfully'
      }
    });

  } catch (error) {
    console.error('Add location mention error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}