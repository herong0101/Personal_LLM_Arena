import { AIModel, ModelCapability, ModelSpeed, StudioMode } from '@/types';

const STUDIO_TEXT_CAPABILITIES: ModelCapability[] = [
  'chat',
  'document',
  'reasoning',
  'expert',
  'memory',
];

const STUDIO_IMAGE_CAPABILITIES: ModelCapability[] = ['image'];

function createLocalModel(config: {
  id: string;
  name: string;
  serverLabel: string;
  speed: ModelSpeed;
  description: string;
}): AIModel {
  return {
    ...config,
    provider: '地端模型',
    available: true,
    source: 'local',
    capabilities: STUDIO_TEXT_CAPABILITIES,
  };
}

export const MODEL_SPEED_LABELS: Record<ModelSpeed, string> = {
  fast: '快',
  medium: '中',
  slow: '慢',
};

const MODEL_SPEED_PRIORITY: Record<ModelSpeed, number> = {
  fast: 0,
  medium: 1,
  slow: 2,
};

function dedupeLocalModelsByName(models: AIModel[]): AIModel[] {
  const dedupedModels = new Map<string, AIModel>();
  const modelOrder: string[] = [];

  models.forEach((model) => {
    const key = model.name.trim().toLowerCase();
    const existing = dedupedModels.get(key);

    if (!existing) {
      dedupedModels.set(key, model);
      modelOrder.push(key);
      return;
    }

    const existingPriority = existing.speed ? MODEL_SPEED_PRIORITY[existing.speed] : Number.POSITIVE_INFINITY;
    const nextPriority = model.speed ? MODEL_SPEED_PRIORITY[model.speed] : Number.POSITIVE_INFINITY;

    if (nextPriority < existingPriority) {
      dedupedModels.set(key, model);
    }
  });

  return modelOrder.map((key) => dedupedModels.get(key)!).filter(Boolean);
}

const LOCAL_MODELS: AIModel[] = dedupeLocalModelsByName([
  createLocalModel({
    id: 'local-vllm-4090-gemma-3-27b-it-qat',
    name: 'Gemma 3 27B IT QAT',
    serverLabel: 'vLLM 4090',
    speed: 'fast',
    description: '地端 vLLM 4090，回應極快，適合即時比較大型模型。',
  }),
  createLocalModel({
    id: 'local-ollama-5090-translategemma-27b',
    name: 'TranslateGemma 27B',
    serverLabel: 'Ollama 5090',
    speed: 'fast',
    description: '地端 Ollama 5090，回應速度快，適合翻譯工作。',
  }),
  createLocalModel({
    id: 'local-ollama-5090-translategemma-4b',
    name: 'TranslateGemma 4B',
    serverLabel: 'Ollama 5090',
    speed: 'fast',
    description: '地端 Ollama 5090，小模型回應快，適合短問答。',
  }),
  createLocalModel({
    id: 'local-ollama-5090-medgemma-1.5-4b',
    name: 'MedGemma 1.5 4B',
    serverLabel: 'Ollama 5090',
    speed: 'fast',
    description: '地端 Ollama 5090，醫療相關模型，回應速度快。',
  }),
  createLocalModel({
    id: 'local-ollama-5090-gpt-oss-20b',
    name: 'gpt-oss 20B',
    serverLabel: 'Ollama 5090',
    speed: 'fast',
    description: '地端 Ollama 5090，20B 級中大型模型，維持快速回覆。',
  }),
  createLocalModel({
    id: 'local-ollama-5090-mistral-small3.2-24b',
    name: 'Mistral Small 3.2 24B',
    serverLabel: 'Ollama 5090',
    speed: 'fast',
    description: '地端 Ollama 5090，適合通用型對話與摘要任務。',
  }),
  createLocalModel({
    id: 'local-ollama-4090-medgemma-1.5-4b',
    name: 'MedGemma 1.5 4B Q4',
    serverLabel: 'Ollama 4090',
    speed: 'medium',
    description: '地端 Ollama 4090，醫療相關模型，速度中等。',
  }),
  createLocalModel({
    id: 'local-ollama-4090-llama-breeze2-8b',
    name: 'Llama Breeze 2 8B',
    serverLabel: 'Ollama 4090',
    speed: 'medium',
    description: '地端 Ollama 4090，繁中表現友善，回應時間中等。',
  }),
  createLocalModel({
    id: 'local-ollama-4090-phi4',
    name: 'Phi-4',
    serverLabel: 'Ollama 4090',
    speed: 'medium',
    description: '地端 Ollama 4090，適合一般知識與短篇推理。',
  }),
  createLocalModel({
    id: 'local-ollama-4090-gemma3-latest',
    name: 'Gemma 3 Latest',
    serverLabel: 'Ollama 4090',
    speed: 'medium',
    description: '地端 Ollama 4090，適合測試 Gemma 3 系列整體表現。',
  }),
  createLocalModel({
    id: 'local-ollama-4090-translategemma-12b',
    name: 'TranslateGemma 12B',
    serverLabel: 'Ollama 4090',
    speed: 'slow',
    description: '地端 Ollama 4090，回應偏慢，適合翻譯工作。',
  }),
  createLocalModel({
    id: 'local-ollama-4090-gpt-oss-20b',
    name: 'gpt-oss 20B',
    serverLabel: 'Ollama 4090',
    speed: 'slow',
    description: '地端 Ollama 4090，大模型品質型回應，速度較慢。',
  }),
  createLocalModel({
    id: 'local-ollama-4090-gemma3-27b',
    name: 'Gemma 3 27B',
    serverLabel: 'Ollama 4090',
    speed: 'slow',
    description: '地端 Ollama 4090，27B 大模型，適合高強度比較。',
  }),
]);

export const AVAILABLE_MODELS: AIModel[] = [
  {
    id: 'gpt-5.2',
    name: 'GPT-5.2',
    provider: 'Azure OpenAI',
    description: '使用 Azure OpenAI 部署的 GPT-5.2，適合通用對話、推理與長篇生成。',
    available: true,
    source: 'cloud',
    capabilities: STUDIO_TEXT_CAPABILITIES,
  },
  {
    id: 'gpt-5.4',
    name: 'GPT-5.4',
    provider: 'Azure OpenAI',
    description: '使用 Azure OpenAI 專案部署的 GPT-5.4，最新版本的通用對話與分析模型。',
    available: true,
    source: 'cloud',
    capabilities: STUDIO_TEXT_CAPABILITIES,
  },
  {
    id: 'gpt-5.4-pro',
    name: 'GPT-5.4 Pro',
    provider: 'Azure OpenAI',
    description: '使用 Azure OpenAI 專案部署的 GPT-5.4 Pro，最新高強度的推理、分析與長文生成模型（思考時常極長）。',
    available: true,
    source: 'cloud',
    capabilities: STUDIO_TEXT_CAPABILITIES,
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'Google',
    description: 'Gemini 2.5 Pro，適合需要較強推理與長文理解的任務。',
    available: true,
    source: 'cloud',
    capabilities: STUDIO_TEXT_CAPABILITIES,
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'Google',
    description: 'Gemini 2.5 Flash，偏向更快的互動回應與日常問答。',
    available: true,
    source: 'cloud',
    capabilities: STUDIO_TEXT_CAPABILITIES,
  },
  {
    id: 'gemini-3-flash-preview',
    name: 'Gemini 3 Flash Preview',
    provider: 'Google',
    description: 'Gemini 3 Flash，主打速度與新世代 Gemini 能力。',
    available: true,
    source: 'cloud',
    capabilities: STUDIO_TEXT_CAPABILITIES,
  },
  {
    id: 'gemini-3-pro-preview',
    name: 'Gemini 3 Pro Preview',
    provider: 'Google',
    description: 'Gemini 3 Pro，適合更複雜的綜合型任務。',
    available: true,
    source: 'cloud',
    capabilities: STUDIO_TEXT_CAPABILITIES,
  },
  {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro Preview',
    provider: 'Google',
    description: 'Google Gemini 3.1 Pro，強調多面向理解與整體回答品質。',
    available: true,
    source: 'cloud',
    capabilities: STUDIO_TEXT_CAPABILITIES,
  },
  {
    id: 'gemini-3.1-flash-lite-preview',
    name: 'Gemini 3.1 Flash Lite Preview',
    provider: 'Google',
    description: 'Gemini 3.1 Flash Lite，適合成本與速度優先的情境。',
    available: true,
    source: 'cloud',
    capabilities: STUDIO_TEXT_CAPABILITIES,
  },
  {
    id: 'gemini-3.1-flash-image-preview',
    name: 'Gemini 3.1 Flash Image Preview',
    provider: 'Google',
    description: 'Gemini 3.1 Flash Image Preview，可直接生成圖片，適合在 Chat Studio 中做快速視覺草圖與素材測試。',
    available: true,
    source: 'cloud',
    capabilities: STUDIO_IMAGE_CAPABILITIES,
  },
  {
    id: 'claude-opus-4-5',
    name: 'Claude Opus 4.5',
    provider: 'Anthropic Foundry',
    description: '透過 Azure AI Foundry 提供的 Claude Opus 4.5，適合深度分析與高品質文字生成。',
    available: true,
    source: 'cloud',
    capabilities: STUDIO_TEXT_CAPABILITIES,
  },
  {
    id: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    provider: 'Anthropic Foundry',
    description: '透過 Azure AI Foundry 提供的 Claude Sonnet 4.6，最新高品質通用對話與分析任務模型。',
    available: true,
    source: 'cloud',
    capabilities: STUDIO_TEXT_CAPABILITIES,
  },
  ...LOCAL_MODELS,
];

export const STUDIO_DEFAULT_MODEL_ID = 'gpt-5.2';
export const STUDIO_DEFAULT_IMAGE_MODEL_ID = 'gemini-3.1-flash-image-preview';

export const STUDIO_DEFAULT_EXPERT_MODEL_IDS = [
  'gpt-5.2',
  'gemini-2.5-pro',
  'claude-opus-4-5',
];

export const STUDIO_MODE_LABELS: Record<StudioMode, string> = {
  chat: '一般對話',
  reasoning: '推理摘要',
  expert: '專家討論',
  image: '圖片生成',
};

export const ARENA_CONFIG = {
  maxModelsPerRound: 3,
  minModelsPerRound: 1,
  maxRoundsPerSession: 10,
};

export const BLIND_NAMES = ['模型 A', '模型 B', '模型 C'];

export const STORAGE_KEYS = {
  currentSession: 'arena_current_session',
  sessionHistory: 'arena_session_history',
  userPreferences: 'arena_user_preferences',
  studioConversations: 'studio_conversations_v1',
  studioActiveConversation: 'studio_active_conversation_v1',
};

export const ARENA_MODE_LABELS = {
  blind: '盲測模式',
  open: '非盲測模式',
} as const;
