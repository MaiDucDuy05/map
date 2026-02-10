import { NextRequest, NextResponse } from 'next/server';
import { getMongoClient } from '@/lib/db/mongo';
import { 
  Itinerary, 
  createItinerary,
  optimizePlaceOrder,
  calculateRouteInfo
} from '@/lib/db/models/itinerary';

// GET: List user's itineraries hoặc get specific itinerary
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const itineraryId = searchParams.get('id');

    if (!userId && !itineraryId) {
      return NextResponse.json(
        { error: 'userId or id is required' },
        { status: 400 }
      );
    }

    const mongoClient = await getMongoClient();
    const db = mongoClient.db();
    const itineraries = db.collection<Itinerary>('itineraries');

    // Get specific itinerary
    if (itineraryId) {
      const itinerary = await itineraries.findOne({ 
        _id: itineraryId as any 
      });

      if (!itinerary) {
        return NextResponse.json(
          { error: 'Itinerary not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: itinerary
      });
    }

    // List user's itineraries
    const status = searchParams.get('status') as any;
    const query: any = { user_id: userId };
    if (status) {
      query.status = status;
    }

    const userItineraries = await itineraries
      .find(query)
      .sort({ created_at: -1 })
      .limit(50)
      .toArray();

    return NextResponse.json({
      success: true,
      data: {
        itineraries: userItineraries,
        count: userItineraries.length
      }
    });

  } catch (error) {
    console.error('Get itinerary error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: Create new itinerary
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userId,
      title,
      description,
      places,
      sourceSession,
      autoOptimize = true
    } = body;

    if (!userId || !title || !places || places.length === 0) {
      return NextResponse.json(
        { error: 'userId, title, and places are required' },
        { status: 400 }
      );
    }

    // Validate places structure
    for (const place of places) {
      if (!place.place_id || !place.name || !place.coordinates) {
        return NextResponse.json(
          { error: 'Each place must have place_id, name, and coordinates' },
          { status: 400 }
        );
      }
    }

    const mongoClient = await getMongoClient();
    const db = mongoClient.db();

    // Optimize route nếu được yêu cầu
    let optimizedPlaces = places;
    if (autoOptimize && places.length > 2) {
      optimizedPlaces = optimizePlaceOrder(places);
    }

    // Calculate route info
    const routeInfo = calculateRouteInfo(optimizedPlaces);

    // Create itinerary
    const itinerary = createItinerary(userId, title, optimizedPlaces);
    itinerary.description = description;
    itinerary.source_session = sourceSession;
    itinerary.route = routeInfo;

    const result = await db.collection<Itinerary>('itineraries').insertOne(itinerary);

    return NextResponse.json({
      success: true,
      data: {
        itineraryId: result.insertedId.toString(),
        itinerary: {
          ...itinerary,
          _id: result.insertedId
        },
        message: 'Lịch trình đã được lưu thành công!'
      }
    });

  } catch (error) {
    console.error('Create itinerary error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT: Update itinerary
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      itineraryId,
      title,
      description,
      places,
      status
    } = body;

    if (!itineraryId) {
      return NextResponse.json(
        { error: 'itineraryId is required' },
        { status: 400 }
      );
    }

    const mongoClient = await getMongoClient();
    const db = mongoClient.db();
    const itineraries = db.collection<Itinerary>('itineraries');

    const updates: any = {
      updated_at: new Date()
    };

    if (title) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (status) updates.status = status;
    
    if (places && places.length > 0) {
      const optimized = optimizePlaceOrder(places);
      updates.places = optimized;
      updates.route = calculateRouteInfo(optimized);
    }

    const result = await itineraries.findOneAndUpdate(
      { _id: itineraryId as any },
      { $set: updates },
      { returnDocument: 'after' }
    );

    if (!result) {
      return NextResponse.json(
        { error: 'Itinerary not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result,
      message: 'Lịch trình đã được cập nhật!'
    });

  } catch (error) {
    console.error('Update itinerary error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE: Delete itinerary
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const itineraryId = searchParams.get('id');

    if (!itineraryId) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      );
    }

    const mongoClient = await getMongoClient();
    const db = mongoClient.db();

    const result = await db.collection('itineraries').deleteOne({
      _id: itineraryId as any
    });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: 'Itinerary not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Lịch trình đã được xóa!'
    });

  } catch (error) {
    console.error('Delete itinerary error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}