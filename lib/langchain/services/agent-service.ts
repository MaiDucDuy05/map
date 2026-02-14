// langchain/services/agent-service.ts
import { runHanoiTravelAgent, AgentResponse } from "../agent";

export class HanoiTravelAgentService {
  private isInitialized = false;

  async initialize(): Promise<void> {
    console.log(" Hanoi Travel Agent Service initialized!");
    this.isInitialized = true;
  }

  async query(
    query: string,
    sessionId: string,
    options?: {
      userId?: string;
      conversationContext?: string;
      userPreferences?: any;
    }
  ): Promise<AgentResponse> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return runHanoiTravelAgent(
      query,
      sessionId,
      options?.userId,
      options?.conversationContext,
      options?.userPreferences
    );
  }

  isReady(): boolean {
    return this.isInitialized;
  }
}

// Singleton
let agentInstance: HanoiTravelAgentService | null = null;

export async function getAgentInstance(): Promise<HanoiTravelAgentService> {
  if (!agentInstance) {
    agentInstance = new HanoiTravelAgentService();
    await agentInstance.initialize();
  }
  return agentInstance;
}