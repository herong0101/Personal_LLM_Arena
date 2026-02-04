import { AIModel } from '@/types';

// Available models configuration
// Add new models here as they become available
export const AVAILABLE_MODELS: AIModel[] = [
  {
    id: 'gpt-4',
    name: 'GPT-4',
    provider: 'OpenAI',
    description: 'OpenAI 最強大的語言模型，擅長複雜推理與創意寫作',
    available: true,
  },
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'OpenAI',
    description: '更快速的 GPT-4 版本，具有更長的上下文視窗',
    available: true,
  },
  {
    id: 'claude-3-opus',
    name: 'Claude 3 Opus',
    provider: 'Anthropic',
    description: 'Anthropic 的旗艦模型，以安全性和深度分析著稱',
    available: true,
  },
  {
    id: 'claude-3-sonnet',
    name: 'Claude 3 Sonnet',
    provider: 'Anthropic',
    description: '平衡效能與速度的 Claude 模型',
    available: true,
  },
  {
    id: 'gemini-pro',
    name: 'Gemini Pro',
    provider: 'Google',
    description: 'Google 的多模態 AI 模型',
    available: true,
  },
  {
    id: 'gemini-ultra',
    name: 'Gemini Ultra',
    provider: 'Google',
    description: 'Google 最強大的 AI 模型',
    available: true,
  },
  {
    id: 'llama-3-70b',
    name: 'Llama 3 70B',
    provider: 'Meta',
    description: 'Meta 開源的大型語言模型',
    available: true,
  },
  {
    id: 'mistral-large',
    name: 'Mistral Large',
    provider: 'Mistral AI',
    description: '歐洲領先的開源語言模型',
    available: true,
  },
];

// Arena configuration
export const ARENA_CONFIG = {
  maxModelsPerRound: 3,
  minModelsPerRound: 1,
  maxRoundsPerSession: 10,
  mockResponseDelay: { min: 1000, max: 3000 }, // ms
};

// Blind names for models
export const BLIND_NAMES = ['模型 A', '模型 B', '模型 C'];

// Local storage keys
export const STORAGE_KEYS = {
  currentSession: 'arena_current_session',
  sessionHistory: 'arena_session_history',
  userPreferences: 'arena_user_preferences',
};
