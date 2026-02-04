// Model types
export interface AIModel {
  id: string;
  name: string;
  provider: string;
  description: string;
  available: boolean;
}

// Response from model
export interface ModelResponse {
  modelId: string;
  blindName: string; // "模型 A", "模型 B", "模型 C"
  response: string;
  timestamp: number;
  isLoading: boolean;
}

// Ranking result
export interface RankingResult {
  modelId: string;
  blindName: string;
  rank: number; // 1, 2, or 3
}

// Single round/match data
export interface MatchRound {
  id: string;
  prompt: string;
  responses: ModelResponse[];
  rankings: RankingResult[];
  timestamp: number;
  revealed: boolean;
}

// Full session history
export interface ArenaSession {
  id: string;
  selectedModels: AIModel[];
  rounds: MatchRound[];
  startTime: number;
  endTime?: number;
  completed: boolean;
}

// Statistics for analytics
export interface ModelStats {
  modelId: string;
  modelName: string;
  totalRounds: number;
  averageRank: number;
  firstPlaceCount: number;
  secondPlaceCount: number;
  thirdPlaceCount: number;
}

// User feedback
export interface UserFeedback {
  sessionId: string;
  comments: Record<string, string>; // modelId -> comment
  overallComment: string;
  timestamp: number;
}

// Global anonymous data for future DB integration
export interface AnonymousRankingData {
  modelIds: string[];
  ranks: number[];
  timestamp: number;
}
