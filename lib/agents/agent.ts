// Import required modules from LangChain ecosystem
import { ChatGoogleGenerativeAI } from "@langchain/google-genai" // Google's Gemini AI model
import { AIMessage, BaseMessage, HumanMessage } from "@langchain/core/messages" // Message types for conversations
import { StateGraph } from "@langchain/langgraph"              // State-based workflow orchestration
import { Annotation } from "@langchain/langgraph"              // Type annotations for state management
import { ToolNode } from "@langchain/langgraph/prebuilt"       // Pre-built node for executing tools
import { MongoDBSaver } from "@langchain/langgraph-checkpoint-mongodb" // For saving conversation state
import { MongoClient } from "mongodb"                          // MongoDB database client
import "dotenv/config"   
import {prompt} from "./utils/prompt"
import {creatMapLookupTool} from "./tools"
import { retryWithBackoff } from "./utils/retryWithBackoff"

// Main function that creates and runs the AI agent
export async function callAgent(client: MongoClient, query: string, thread_id: string) {
  try {
    // Database configuration
    const dbName = "inventory_database"        // Name of the MongoDB database
    const db = client.db(dbName)              // Get database instance
    const collection = db.collection("map") 

    // Define the state structure for the agent workflow
   const GraphState = Annotation.Root({
      messages: Annotation<BaseMessage[]>({
        reducer: (x, y) => x.concat(y), 
      }),

 

      recursionCount: Annotation<number>({
        default: () => 0,
        reducer: (prev, next) => next !== undefined ? next : prev,
      })
      
    })

    const courseLookupTool = creatMapLookupTool(collection);


    // Array of all available tools (just one in this case)
        const tools = [courseLookupTool]
        // Create a tool execution node for the workflow
        const toolNode = new ToolNode<typeof GraphState.State>(tools)
    
        // Initialize the AI model (Google's Gemini)
        const model = new ChatGoogleGenerativeAI({
          model: "models/gemini-flash-latest",         
          temperature: 0,                  
          maxRetries: 0,                 
          apiKey: process.env.GOOGLE_API_KEY, 
        }).bindTools(tools)              
    
      
        function shouldContinue(state: typeof GraphState.State) {
          const messages = state.messages                          
          const lastMessage = messages[messages.length - 1] as AIMessage 

          if (lastMessage.tool_calls?.length) {
            return "tools" 
          }
          return "__end__"  
        }
    
        // Function that calls the AI model with retry logic
        async function callModel(state: typeof GraphState.State) {
          return retryWithBackoff(async () => { 
            const formattedPrompt = await prompt.formatMessages({
              time: new Date().toISOString(), 
              messages: state.messages,    
            })
    
            const result = await model.invoke(formattedPrompt)
            return { messages: [result] }
          })
        }
    
        // Build the workflow graph
        const workflow = new StateGraph(GraphState)
          .addNode("agent", callModel)                    // Add AI model node
          .addNode("tools", toolNode)                     // Add tool execution node
          .addEdge("__start__", "agent")                  // Start workflow at agent
          .addConditionalEdges("agent", shouldContinue)   // Agent decides: tools or end
          .addEdge("tools", "agent")                      // After tools, go back to agent
    
        // Initialize conversation state persistence
        const checkpointer = new MongoDBSaver({ client, dbName })
        // Compile the workflow with state saving
        const app = workflow.compile({ checkpointer })
    
        // Execute the workflow
        const finalState = await app.invoke(
          {
            messages: [new HumanMessage(query)], 
          },
          { 
            recursionLimit: 15,                  
            configurable: { thread_id: thread_id } 
          }
        )
    
        // Extract the final response from the conversation
        const response = finalState.messages[finalState.messages.length - 1].content
        console.log("Agent response:", response)
    
        return response // Return the AI's final response
    
      } catch (error: any) {
        // Handle different types of errors with user-friendly messages
        console.error("Error in callAgent:", error.message)
        
        if (error.status === 429) { // Rate limit error
          throw new Error("Service temporarily unavailable due to rate limits. Please try again in a minute.")
        } else if (error.status === 401) { // Authentication error
          throw new Error("Authentication failed. Please check your API configuration.")
        } else { // Generic error
          throw new Error(`Agent failed: ${error.message}`)
        }
      }
    }