import { Annotation } from "@langchain/langgraph";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";

export const AgentState = Annotation.Root({
  messages: Annotation<(HumanMessage | AIMessage | SystemMessage)[]>({
    reducer: (x, y) => x.concat(y),
  }),
  query: Annotation<string>,
  needsRetrieval: Annotation<boolean>,
  retrievedDocs: Annotation<any[]>,
  
  mapActions: Annotation<any[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  
  sessionId: Annotation<string>,
  userId: Annotation<string | undefined>,
  conversationContext: Annotation<string>,


  extractedLocations: Annotation<any[]>({
    reducer: (current, update) => update ?? current, 
    default: () => [],
  }),

  userPreferences: Annotation<any>({
    reducer: (current, update) => update ?? current,
    default: () => ({}),
  }),

});

export type AgentStateType = typeof AgentState.State;