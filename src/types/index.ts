// Arena modes
export type ArenaMode = 'blind' | 'open';
export type ModelSource = 'cloud' | 'local';
export type ModelSpeed = 'fast' | 'medium' | 'slow';
export type ModelCapability = 'chat' | 'document' | 'reasoning' | 'expert' | 'memory' | 'image';
export type StudioMode = 'chat' | 'reasoning' | 'expert' | 'image';
export type StudioRole = 'user' | 'assistant' | 'system';
export type ArenaSpecialMode = 'expert-discussion' | 'debate' | 'pressure-test';

export type ArenaOrchestrationConfig =
  | {
      kind: 'expert-discussion';
      memberModelIds: string[];
      synthesisModelId: string;
    }
  | {
      kind: 'debate';
      propositionModelId: string;
      oppositionModelId: string;
      judgeModelId: string;
    }
  | {
      kind: 'pressure-test';
      targetModelId: string;
      attackerModelIds: string[];
    };

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
  canonicalName?: string;
  benchmarkLatencySeconds?: number;
  capabilities?: ModelCapability[];
  isArenaSpecial?: boolean;
  orchestration?: ArenaOrchestrationConfig;
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
    rank: number | null;
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

export interface StudioMessage {
  id: string;
  role: StudioRole;
  content: string;
  createdAt: number;
  modelId?: string;
  label?: string;
  images?: StudioGeneratedImage[];
}

export interface StudioGeneratedImage {
  id: string;
  mimeType: string;
  base64Data: string;
}

export interface StudioDocument {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  content: string;
  createdAt: number;
}

export interface StudioMemory {
  summary: string;
  updatedAt?: number;
  sourceMessageCount: number;
}

export interface StudioConversationSettings {
  activeModelId: string;
  mode: StudioMode;
  expertModelIds: string[];
  useLongTermMemory: boolean;
  includeDocuments: boolean;
}

export interface StudioConversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: StudioMessage[];
  documents: StudioDocument[];
  memory: StudioMemory;
  settings: StudioConversationSettings;
}
