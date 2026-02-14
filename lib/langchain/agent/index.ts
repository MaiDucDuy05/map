// langchain/agent/index.ts
import { HumanMessage } from "@langchain/core/messages";
import { createHanoiTravelAgent } from "./graph";
import { formatSources } from "../utils/formatters";

export interface AgentResponse {
  answer: string;
  sources: any[];
  mapActions: any[];
  context: any[];
  toolCalls: any[];
}

export async function runHanoiTravelAgent(
  query: string,
  sessionId: string,
  userId?: string,
  conversationContext?: string,
  userPreferences?: any
): Promise<AgentResponse> {

  const agent = createHanoiTravelAgent();

  const initialState = {
    messages: [new HumanMessage(query)],
    query,
    needsRetrieval: false,
    retrievedDocs: [],
    mapActions: [],
    sessionId,
    userId,
    conversationContext: conversationContext || "",
    extractedLocations: [],
    userPreferences: userPreferences || {},
  };

  const result = await agent.invoke(initialState);

  // Extract final answer
  const lastMessage = result.messages[result.messages.length - 1];
  const answer = lastMessage.content as string;

  const contextDocs = result.retrievedDocs;

  // Format sources with full metadata
  const sources = formatSources(contextDocs|| []);

  // Extract tool calls
  const toolCalls = result.messages
    .filter((msg: any) => msg.tool_calls?.length)
    .flatMap((msg: any) => msg.tool_calls);


  return {
    answer,
    sources,
    mapActions: result.mapActions || [],
    context: contextDocs,
    toolCalls,
  };
}