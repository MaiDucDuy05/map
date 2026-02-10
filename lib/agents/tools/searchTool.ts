import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { Collection } from "mongodb";

// Factory function: nhận collection để tạo tool
export function creatMapLookupTool(collection: Collection) {
  return (tool as any)(
      // The actual function that will be executed when tool is called
      async ({ query, n = 10 }: { query: string; n?: number }) => {
        try {
          console.log("Item lookup tool called with query:", query)

          // Check if database has any data at all
          const totalCount = await collection.countDocuments()
          console.log(`Total documents in collection: ${totalCount}`)

          // Early return if database is empty
          if (totalCount === 0) {
            console.log("Collection is empty")
            return JSON.stringify({ 
              error: "No items found in inventory", 
              message: "The inventory database appears to be empty",
              count: 0 
            })
          }

          const dbConfig = {
            collection: collection,          
            indexName: "vector_index",      
            textKey: "embedding_text",     
            embeddingKey: "embedding",       
          }

          const vectorStore = new MongoDBAtlasVectorSearch(
            new GoogleGenerativeAIEmbeddings({
              apiKey: process.env.GOOGLE_API_KEY,
              model: "text-embedding-004",  
            }),
            dbConfig
          )

          console.log("Performing vector search...")
          // Perform semantic search using vector embeddings
          const result = await vectorStore.similaritySearchWithScore(query, n)
          console.log(`Vector search returned ${result.length} results`)
          
          // If vector search returns no results, fall back to text search
          if (result.length === 0) {
            console.log("Vector search returned no results, trying text search...")
            // MongoDB text search using regular expressions
            const textResults = await collection.find({
              $or: [ // OR condition - match any of these fields
                { name: { $regex: query, $options: 'i' } },        // Case-insensitive search in item name
                { level: { $regex: query, $options: 'i' } }, // Case-insensitive search in description
                { description: { $regex: query, $options: 'i' } },       // Case-insensitive search in categories
                { bandTarget: { $regex: query, $options: 'i' } }    // Case-insensitive search in embedding text
              ]
            }).limit(n).toArray() // Limit results and convert to array
            
            console.log(`Text search returned ${textResults.length} results`)
            // Return text search results as JSON string
            return JSON.stringify({
              results: textResults,
              searchType: "text",    // Indicate this was a text search
              query: query,
              count: textResults.length
            })
          }

          // Return vector search results as JSON string
          return JSON.stringify({
            results: result,
            searchType: "vector",   // Indicate this was a vector search
            query: query,
            count: result.length
          })
          
        } catch (error: any) {
          // Log detailed error information for debugging
          console.error("Error in item lookup:", error)
          console.error("Error details:", {
            message: error.message,
            stack: error.stack,
            name: error.name
          })
          
          // Return error information as JSON string
          return JSON.stringify({ 
            error: "Failed to search inventory", 
            details: error.message,
            query: query
          })
        }
      },
      // Tool metadata and schema definition
      {
        name: "courses_lookup",                                    // Tên tool
        description: "Tìm kiếm thông tin các khóa học trong cơ sở dữ liệu", // Mô tả tool
        schema: z.object({                                        // Xác thực dữ liệu đầu vào
          query: z.string().describe("Từ khóa tìm kiếm khóa học"), // Tham số bắt buộc: từ khóa tìm kiếm
          n: z.number().optional().default(10)                    // Tham số tùy chọn: số lượng kết quả trả về
            .describe("Số lượng kết quả muốn trả về"),
        }),
      }
    )
}