import { MongoClient, Db } from 'mongodb';
import { conversationIndexes } from './models/conversation';
import { feedbackIndexes } from './models/feedback';
import { locationMentionIndexes } from './models/location-mention';
import { itineraryIndexes } from './models/itinerary';

/**
 * Initialize MongoDB collections và create indexes
 */
export async function initializeDatabase(mongoClient: MongoClient): Promise<void> {
  const db = mongoClient.db();

  console.log('🔧 Initializing MongoDB collections and indexes...');

  try {
    // Create collections if they don't exist
    const collections = await db.listCollections().toArray();
    const existingCollections = new Set(collections.map(c => c.name));

    const requiredCollections = [
      'conversations',
      'feedback',
      'location_mentions',
      'itineraries',
      'training_data'
    ];

    for (const collName of requiredCollections) {
      if (!existingCollections.has(collName)) {
        await db.createCollection(collName);
        console.log(`✅ Created collection: ${collName}`);
      }
    }

    // Create indexes
    await createIndexes(db);

    console.log('✅ Database initialization completed!');

  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

/**
 * Create all necessary indexes
 */
async function createIndexes(db: Db): Promise<void> {
  // Conversations indexes
  const conversations = db.collection('conversations');
  for (const index of conversationIndexes) {
    try {
      await conversations.createIndex(index.key, { 
        unique: index.unique,
        background: true 
      });
      console.log(`✅ Created index on conversations:`, index.key);
    } catch (error: any) {
      if (error.code !== 85 && error.code !== 86) { // Ignore if index already exists
        console.error('Failed to create index:', error);
      }
    }
  }

  // Feedback indexes
  const feedback = db.collection('feedback');
  for (const index of feedbackIndexes) {
    try {
      await feedback.createIndex(index.key, { background: true });
      console.log(` Created index on feedback:`, index.key);
    } catch (error: any) {
      if (error.code !== 85 && error.code !== 86) {
        console.error('Failed to create index:', error);
      }
    }
  }

  // Location mentions indexes (including geospatial)
  const locationMentions = db.collection('location_mentions');
  for (const index of locationMentionIndexes) {
    try {
      await locationMentions.createIndex(index.key as any, { background: true });
      console.log(`✅ Created index on location_mentions:`, index.key);
    } catch (error: any) {
      if (error.code !== 85 && error.code !== 86) {
        console.error('Failed to create index:', error);
      }
    }
  }

  // Itineraries indexes
  const itineraries = db.collection('itineraries');
  for (const index of itineraryIndexes) {
    try {
      await itineraries.createIndex(index.key, { background: true });
      console.log(`✅ Created index on itineraries:`, index.key);
    } catch (error: any) {
      if (error.code !== 85 && error.code !== 86) {
        console.error('Failed to create index:', error);
      }
    }
  }

  // Training data indexes
  const trainingData = db.collection('training_data');
  await trainingData.createIndex({ created_at: -1 }, { background: true });
  await trainingData.createIndex({ source: 1 }, { background: true });
  await trainingData.createIndex({ quality_score: -1 }, { background: true });
  console.log(`✅ Created indexes on training_data`);
}

/**
 * Cleanup old data (chạy định kỳ)
 */
export async function cleanupOldData(
  mongoClient: MongoClient,
  options: {
    conversationsDays?: number;
    feedbackDays?: number;
    locationMentionsDays?: number;
  } = {}
): Promise<{
  conversationsDeleted: number;
  feedbackDeleted: number;
  locationMentionsDeleted: number;
}> {
  const db = mongoClient.db();
  const {
    conversationsDays = 90,
    feedbackDays = 180,
    locationMentionsDays = 90
  } = options;

  console.log('🧹 Starting cleanup...');

  const conversationsCutoff = new Date(Date.now() - conversationsDays * 24 * 60 * 60 * 1000);
  const feedbackCutoff = new Date(Date.now() - feedbackDays * 24 * 60 * 60 * 1000);
  const locationsCutoff = new Date(Date.now() - locationMentionsDays * 24 * 60 * 60 * 1000);

  const [convResult, feedbackResult, locationsResult] = await Promise.all([
    db.collection('conversations').deleteMany({
      last_active: { $lt: conversationsCutoff }
    }),
    db.collection('feedback').deleteMany({
      timestamp: { $lt: feedbackCutoff },
      processed: true
    }),
    db.collection('location_mentions').deleteMany({
      timestamp: { $lt: locationsCutoff }
    })
  ]);

  console.log(`✅ Cleanup completed:
    - Conversations: ${convResult.deletedCount}
    - Feedback: ${feedbackResult.deletedCount}
    - Location mentions: ${locationsResult.deletedCount}
  `);

  return {
    conversationsDeleted: convResult.deletedCount,
    feedbackDeleted: feedbackResult.deletedCount,
    locationMentionsDeleted: locationsResult.deletedCount
  };
}

/**
 * Get database statistics
 */
export async function getDatabaseStats(mongoClient: MongoClient): Promise<any> {
  const db = mongoClient.db();

  const [
    conversationsCount,
    feedbackCount,
    locationsCount,
    itinerariesCount,
    trainingDataCount
  ] = await Promise.all([
    db.collection('conversations').countDocuments(),
    db.collection('feedback').countDocuments(),
    db.collection('location_mentions').countDocuments(),
    db.collection('itineraries').countDocuments(),
    db.collection('training_data').countDocuments()
  ]);

  // Get storage size
  const stats = await db.stats();

  return {
    collections: {
      conversations: conversationsCount,
      feedback: feedbackCount,
      locationMentions: locationsCount,
      itineraries: itinerariesCount,
      trainingData: trainingDataCount
    },
    storage: {
      totalSizeMB: (stats.dataSize / 1024 / 1024).toFixed(2),
      indexSizeMB: (stats.indexSize / 1024 / 1024).toFixed(2)
    }
  };
}

/**
 * Backup specific collections
 */
export async function exportCollection(
  mongoClient: MongoClient,
  collectionName: string,
  outputPath: string
): Promise<void> {
  const db = mongoClient.db();
  const collection = db.collection(collectionName);
  
  const documents = await collection.find({}).toArray();
  
  // Write to file (sử dụng fs trong Node.js environment)
  const fs = require('fs');
  fs.writeFileSync(
    outputPath,
    JSON.stringify(documents, null, 2)
  );

  console.log(`✅ Exported ${documents.length} documents from ${collectionName} to ${outputPath}`);
}