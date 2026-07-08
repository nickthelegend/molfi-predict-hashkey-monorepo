// MongoDB Collections Schema for Molfi

export interface AgentDocument {
  _id?: string;
  appId: number;                    // Contract address / id from AgentRegistry (HashKey Chain)
  evmAddress: string;               // On-chain creator address (EVM address)
  name: string;
  description: string;
  category: string;
  priceHsk: number;                 // Price in HSK (wei)
  createdAt: Date;
  updatedAt: Date;
  onChainRound: number;             // Block round when registered
  txId: string;                     // Registration transaction ID
  reputationScore: number;          // Cached from AgentReputation contract
  executionCount: number;           // Cached from AgentExecutor contract
  isActive: boolean;
}

export interface ExecutionDocument {
  _id?: string;
  appId: number;                    // AgentExecutor App ID
  agentAppId: number;               // Which AgentRegistry entry
  callerAddress: string;
  input: string;                    // The actual prompt text
  output: string;                   // The AI response text
  inputHash: string;                // Hash of the input payload for chain
  outputHash: string;               // Hash of the output for chain
  txId: string;
  round: number;
  executedAt: Date;
  status: 'pending' | 'success' | 'failed';
  cost: number;                     // HSK (wei) spent
}

export interface ReputationDocument {
  _id?: string;
  agentAppId: number;
  raterAddress: string;
  score: number;                    // 1-5
  txId: string;
  round: number;
  ratedAt: Date;
}

export interface UserDocument {
  _id?: string;
  evmAddress: string;
  displayName?: string;
  avatarUrl?: string;
  totalAgentsPublished: number;
  totalExecutions: number;
  reputationScore: number;
  joinedAt: Date;
  lastActiveAt: Date;
}

export type CollectionName = 'agents' | 'executions' | 'reputations' | 'users';
