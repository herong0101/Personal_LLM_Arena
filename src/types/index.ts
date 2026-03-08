// Arena modes
export type ArenaMode = 'blind' | 'open';
export type ModelSource = 'cloud' | 'local';
export type ModelSpeed = 'fast' | 'medium' | 'slow';

// Model types
export interface AIModel {
  id: string;
  name: string;
  provider: string;
  description: string;
  available: boolean;
  source?: ModelSource;
  speed?: ModelSpeed;
  serverLabel?: string;
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
  mode: ArenaMode;
  selectedModels: AIModel[];
  rounds: MatchRound[];
  startTime: number;
  endTime?: number;
  completed: boolean;
  feedback?: UserFeedback;
  lastExport?: ExportMetadata;
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

export interface LeaderboardEntry extends ModelStats {
  position: number;
  sharedPosition: boolean;
}

// User feedback
export interface UserFeedback {
  sessionId: string;
  comments: Record<string, string>; // modelId -> comment
  overallComment: string;
  timestamp: number;
}

export interface ExportMetadata {
  exportedAt: number;
  filePath: string;
  fileName: string;
}

export interface SessionSummaryRound {
  roundNumber: number;
  prompt: string;
  revealed: boolean;
  responses: Array<{
    blindName: string;
    modelId: string;
    modelName: string;
    response: string;
  }>;
  rankings: Array<{
    rank: number;
    blindName: string;
    modelId: string;
    modelName: string;
  }>;
  winners: string[];
}

export interface SessionSummary {
  exportedAt?: string;
  sessionId: string;
  mode: ArenaMode;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  totalRounds: number;
  selectedModels: AIModel[];
  leaders: Array<{
    modelId: string;
    modelName: string;
    averageRank: number;
    firstPlaceCount: number;
    position: number;
    sharedPosition: boolean;
  }>;
  leaderboard: LeaderboardEntry[];
  feedback: UserFeedback | null;
  rounds: SessionSummaryRound[];
}

// Global anonymous data for future DB integration
export interface AnonymousRankingData {
  modelIds: string[];
  ranks: number[];
  timestamp: number;
}
