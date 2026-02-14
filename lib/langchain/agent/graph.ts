// langchain/agent/graph.ts
import { StateGraph, END } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { AgentState } from "./state";
import { allTools } from "./tools";
import {
  routerNode,
  retrievalNode,
  agentNode,
  extractMapActionsNode,
  shouldContinue,
  shouldRetrieve,
} from "./nodes";

export function createHanoiTravelAgent() {
  const toolNode = new ToolNode(allTools);

  const workflow = new StateGraph(AgentState)
    // Add nodes
    .addNode("router", routerNode)
    .addNode("retrieval", retrievalNode)
    .addNode("agent", agentNode)
    .addNode("tools", toolNode)
    .addNode("extractMapActions", extractMapActionsNode)
    
    // Add edges
    .addEdge("__start__", "router")
    .addConditionalEdges("router", shouldRetrieve)
    .addEdge("retrieval", "agent")
    .addConditionalEdges("agent", shouldContinue)
    .addEdge("tools", "agent")
    .addEdge("agent", "extractMapActions");

  return workflow.compile();
}