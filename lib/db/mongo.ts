import { MongoClient, ServerApiVersion } from 'mongodb';

// Global MongoDB client singleton
let cachedClient: MongoClient | null = null;
let cachedPromise: Promise<MongoClient> | null = null;

/**
 * Get MongoDB client with connection pooling and proper SSL config
 */
export async function getMongoClient(): Promise<MongoClient> {
  // Return cached client if exists
  if (cachedClient) {
    return cachedClient;
  }

  // Return in-progress connection
  if (cachedPromise) {
    return cachedPromise;
  }

  const uri = process.env.MONGODB_ATLAS_URI;

  if (!uri) {
    throw new Error('MONGODB_URI is not defined in environment variables');
  }

  console.log(' Connecting to MongoDB...');

  // Determine if using local or Atlas
  const isAtlas = uri.includes('mongodb+srv://') || uri.includes('mongodb.net');
  const isLocal = uri.includes('localhost') || uri.includes('127.0.0.1');

  // Connection options
  const options: any = {
    maxPoolSize: 10,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  };

  if (isAtlas) {
    console.log('Connecting to MongoDB Atlas...');
    options.tls = true;
    options.tlsAllowInvalidCertificates = false;
    options.tlsAllowInvalidHostnames = false;
    options.serverApi = {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    };
  } else if (isLocal) {
    console.log('Connecting to local MongoDB...');
    options.tls = false; // Disable SSL for local
    options.directConnection = true;
  } else {
    console.log('Connecting to custom MongoDB...');
    options.tls = false; // Disable SSL unless specified
  }

  try {
    // Create connection promise
    cachedPromise = MongoClient.connect(uri, options).then(async (client) => {
      // Test connection
      await client.db('admin').command({ ping: 1 });
      console.log(' MongoDB connected successfully!');
      
      cachedClient = client;
      cachedPromise = null;
      return client;
    });

    return await cachedPromise;

  } catch (error: any) {
    cachedPromise = null;
    
    console.error(' MongoDB connection failed:', error.message);
    
    // Provide helpful error messages
    if (error.message.includes('SSL') || error.message.includes('TLS')) {
      console.error('\n SSL Error - Try these fixes:');
      console.error('1. For local MongoDB: Use mongodb://localhost:27017');
      console.error('2. For Atlas: Check IP whitelist and credentials');
      console.error('3. Add to .env: MONGODB_URI without SSL parameters\n');
    }
    
    throw error;
  }
}

/**
 * Close MongoDB connection (call on app shutdown)
 */
export async function closeMongoConnection(): Promise<void> {
  if (cachedClient) {
    await cachedClient.close();
    cachedClient = null;
    cachedPromise = null;
    console.log(' MongoDB connection closed');
  }
}

/**
 * Get database instance
 */
export async function getDatabase(dbName?: string) {
  const client = await getMongoClient();
  const name = dbName || process.env.MONGODB_DB_NAME;
  return client.db(name);
}

// Handle process termination
if (typeof process !== 'undefined') {
  process.on('SIGINT', async () => {
    await closeMongoConnection();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await closeMongoConnection();
    process.exit(0);
  });
}

export default getMongoClient;