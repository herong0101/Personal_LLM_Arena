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
  canonicalName?: string;
  benchmarkLatencySeconds?: number;
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
    const key = (model.canonicalName ?? model.name).trim().toLowerCase();
    const existing = dedupedModels.get(key);

    if (!existing) {
      dedupedModels.set(key, model);
      modelOrder.push(key);
      return;
    }

    const existingLatency = existing.benchmarkLatencySeconds ?? Number.POSITIVE_INFINITY;
    const nextLatency = model.benchmarkLatencySeconds ?? Number.POSITIVE_INFINITY;

    if (nextLatency !== existingLatency) {
      if (nextLatency < existingLatency) {
        dedupedModels.set(key, model);
      }
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
    id: 'local-ollama-4090-gemma3-27b-it-qat',
    name: 'Gemma 3 27B IT QAT',
    canonicalName: 'Gemma 3 27B IT QAT',
    benchmarkLatencySeconds: 1.26,
    serverLabel: 'Ollama 4090',
    speed: 'fast',
    description: '地端 Ollama 4090，Gemma 3 27B IT QAT 的已驗證可用路徑。',
  }),
  createLocalModel({
    id: 'local-ollama-5090-translategemma-27b',
    name: 'TranslateGemma 27B',
    canonicalName: 'TranslateGemma 27B',
    benchmarkLatencySeconds: 7.26,
    serverLabel: 'Ollama 5090',
    speed: 'fast',
    description: '地端 Ollama 5090，TranslateGemma 27B。',
  }),
  createLocalModel({
    id: 'local-ollama-4090-translategemma-27b',
    name: 'TranslateGemma 27B',
    canonicalName: 'TranslateGemma 27B',
    benchmarkLatencySeconds: 179.78,
    serverLabel: 'Ollama 4090',
    speed: 'slow',
    description: '地端 Ollama 4090，TranslateGemma 27B。',
  }),
  createLocalModel({
    id: 'local-ollama-5090-translategemma-12b',
    name: 'TranslateGemma 12B',
    canonicalName: 'TranslateGemma 12B',
    benchmarkLatencySeconds: 10.75,
    serverLabel: 'Ollama 5090',
    speed: 'fast',
    description: '地端 Ollama 5090，TranslateGemma 12B。',
  }),
  createLocalModel({
    id: 'local-ollama-4090-translategemma-12b',
    name: 'TranslateGemma 12B',
    canonicalName: 'TranslateGemma 12B',
    benchmarkLatencySeconds: 80.91,
    serverLabel: 'Ollama 4090',
    speed: 'slow',
    description: '地端 Ollama 4090，TranslateGemma 12B。',
  }),
  createLocalModel({
    id: 'local-ollama-5090-translategemma-4b',
    name: 'TranslateGemma 4B',
    canonicalName: 'TranslateGemma 4B',
    benchmarkLatencySeconds: 3.61,
    serverLabel: 'Ollama 5090',
    speed: 'fast',
    description: '地端 Ollama 5090，小模型翻譯路線，回應極快。',
  }),
  createLocalModel({
    id: 'local-ollama-5090-medgemma-1.5-4b',
    name: 'MedGemma 1.5 4B',
    canonicalName: 'MedGemma 1.5 4B',
    benchmarkLatencySeconds: 5.75,
    serverLabel: 'Ollama 5090',
    speed: 'fast',
    description: '地端 Ollama 5090，醫療相關模型，回應速度快。',
  }),
  createLocalModel({
    id: 'local-ollama-4090-medgemma-1.5-4b',
    name: 'MedGemma 1.5 4B',
    canonicalName: 'MedGemma 1.5 4B',
    benchmarkLatencySeconds: 29.06,
    serverLabel: 'Ollama 4090',
    speed: 'medium',
    description: '地端 Ollama 4090，醫療相關模型。',
  }),
  createLocalModel({
    id: 'local-ollama-5090-ministral-3-3b',
    name: 'Ministral 3 3B',
    canonicalName: 'Ministral 3 3B',
    benchmarkLatencySeconds: 2.78,
    serverLabel: 'Ollama 5090',
    speed: 'fast',
    description: '地端 Ollama 5090，Ministral 3 3B。',
  }),
  createLocalModel({
    id: 'local-ollama-4090-ministral-3-3b',
    name: 'Ministral 3 3B',
    canonicalName: 'Ministral 3 3B',
    benchmarkLatencySeconds: 39.73,
    serverLabel: 'Ollama 4090',
    speed: 'medium',
    description: '地端 Ollama 4090，Ministral 3 3B。',
  }),
  createLocalModel({
    id: 'local-ollama-5090-ministral-3-8b',
    name: 'Ministral 3 8B',
    canonicalName: 'Ministral 3 8B',
    benchmarkLatencySeconds: 3.63,
    serverLabel: 'Ollama 5090',
    speed: 'fast',
    description: '地端 Ollama 5090，Ministral 3 8B。',
  }),
  createLocalModel({
    id: 'local-ollama-4090-ministral-3-8b',
    name: 'Ministral 3 8B',
    canonicalName: 'Ministral 3 8B',
    benchmarkLatencySeconds: 93.08,
    serverLabel: 'Ollama 4090',
    speed: 'slow',
    description: '地端 Ollama 4090，Ministral 3 8B。',
  }),
  createLocalModel({
    id: 'local-ollama-5090-ministral-3-14b',
    name: 'Ministral 3 14B',
    canonicalName: 'Ministral 3 14B',
    benchmarkLatencySeconds: 3.01,
    serverLabel: 'Ollama 5090',
    speed: 'fast',
    description: '地端 Ollama 5090，Ministral 3 14B。',
  }),
  createLocalModel({
    id: 'local-ollama-4090-ministral-3-14b',
    name: 'Ministral 3 14B',
    canonicalName: 'Ministral 3 14B',
    benchmarkLatencySeconds: 147.3,
    serverLabel: 'Ollama 4090',
    speed: 'slow',
    description: '地端 Ollama 4090，Ministral 3 14B。',
  }),
  createLocalModel({
    id: 'local-ollama-4090-llama-breeze2-8b',
    name: 'Llama Breeze 2 8B',
    canonicalName: 'Llama Breeze 2 8B',
    benchmarkLatencySeconds: 26.69,
    serverLabel: 'Ollama 4090',
    speed: 'medium',
    description: '地端 Ollama 4090，Llama Breeze 2 8B。',
  }),
  createLocalModel({
    id: 'local-ollama-4090-breeze-7b-instruct-v1-0',
    name: 'Breeze 7B Instruct V1.0',
    canonicalName: 'Breeze 7B Instruct V1.0',
    benchmarkLatencySeconds: 74.33,
    serverLabel: 'Ollama 4090',
    speed: 'slow',
    description: '地端 Ollama 4090，Breeze 7B Instruct V1.0。',
  }),
  createLocalModel({
    id: 'local-ollama-4090-gemma3-270m',
    name: 'Gemma 3 270M',
    canonicalName: 'Gemma 3 270M',
    benchmarkLatencySeconds: 3.52,
    serverLabel: 'Ollama 4090',
    speed: 'fast',
    description: '地端 Ollama 4090，Gemma 3 270M。',
  }),
  createLocalModel({
    id: 'local-ollama-4090-gemma3n-e4b',
    name: 'Gemma 3n E4B',
    canonicalName: 'Gemma 3n E4B',
    benchmarkLatencySeconds: 64.94,
    serverLabel: 'Ollama 4090',
    speed: 'slow',
    description: '地端 Ollama 4090，Gemma 3n E4B。',
  }),
  createLocalModel({
    id: 'local-ollama-5090-gpt-oss-20b',
    name: 'gpt-oss 20B',
    canonicalName: 'gpt-oss 20B',
    benchmarkLatencySeconds: 5,
    serverLabel: 'Ollama 5090',
    speed: 'fast',
    description: '地端 Ollama 5090，gpt-oss 20B。',
  }),
  createLocalModel({
    id: 'local-ollama-4090-gpt-oss-20b',
    name: 'gpt-oss 20B',
    canonicalName: 'gpt-oss 20B',
    benchmarkLatencySeconds: 259.23,
    serverLabel: 'Ollama 4090',
    speed: 'slow',
    description: '地端 Ollama 4090，gpt-oss 20B。',
  }),
  createLocalModel({
    id: 'local-ollama-5090-gpt-oss-20b-202511',
    name: 'gpt-oss 20B 202511',
    canonicalName: 'gpt-oss 20B 202511',
    benchmarkLatencySeconds: 5.55,
    serverLabel: 'Ollama 5090',
    speed: 'fast',
    description: '地端 Ollama 5090，gpt-oss 20B 202511。',
  }),
  createLocalModel({
    id: 'local-ollama-4090-gemma3-12b-it-qat',
    name: 'Gemma 3 12B IT QAT',
    canonicalName: 'Gemma 3 12B IT QAT',
    benchmarkLatencySeconds: 114.85,
    serverLabel: 'Ollama 4090',
    speed: 'slow',
    description: '地端 Ollama 4090，Gemma 3 12B IT QAT。',
  }),
  createLocalModel({
    id: 'local-ollama-4090-amoral-gemma3-12b-v2-qat',
    name: 'Amoral Gemma 3 12B V2 QAT',
    canonicalName: 'Amoral Gemma 3 12B V2 QAT',
    benchmarkLatencySeconds: 46.04,
    serverLabel: 'Ollama 4090',
    speed: 'medium',
    description: '地端 Ollama 4090，Amoral Gemma 3 12B V2 QAT。',
  }),
  createLocalModel({
    id: 'local-ollama-4090-phi4-mini',
    name: 'Phi-4 Mini',
    canonicalName: 'Phi-4 Mini',
    benchmarkLatencySeconds: 16.76,
    serverLabel: 'Ollama 4090',
    speed: 'medium',
    description: '地端 Ollama 4090，Phi-4 Mini。',
  }),
  createLocalModel({
    id: 'local-ollama-4090-granite-3.2-vision',
    name: 'Granite 3.2 Vision',
    canonicalName: 'Granite 3.2 Vision',
    benchmarkLatencySeconds: 17.15,
    serverLabel: 'Ollama 4090',
    speed: 'medium',
    description: '地端 Ollama 4090，Granite 3.2 Vision。',
  }),
  createLocalModel({
    id: 'local-ollama-4090-msmall-3.1-q6',
    name: 'MSmall 3.1 Q6',
    canonicalName: 'MSmall 3.1 Q6',
    benchmarkLatencySeconds: 94.87,
    serverLabel: 'Ollama 4090',
    speed: 'slow',
    description: '地端 Ollama 4090，MSmall 3.1 Q6。',
  }),
  createLocalModel({
    id: 'local-ollama-4090-mistral-small',
    name: 'Mistral Small',
    canonicalName: 'Mistral Small',
    benchmarkLatencySeconds: 68.19,
    serverLabel: 'Ollama 4090',
    speed: 'slow',
    description: '地端 Ollama 4090，Mistral Small。',
  }),
  createLocalModel({
    id: 'local-ollama-5090-mistral-small3.2-24b',
    name: 'Mistral Small 3.2 24B',
    canonicalName: 'Mistral Small 3.2 24B',
    benchmarkLatencySeconds: 6.89,
    serverLabel: 'Ollama 5090',
    speed: 'fast',
    description: '地端 Ollama 5090，Mistral Small 3.2 24B。',
  }),
  createLocalModel({
    id: 'local-ollama-4090-mistral-small-3.1-24b-q4-ks',
    name: 'Mistral Small 3.1 24B Q4 KS',
    canonicalName: 'Mistral Small 3.1 24B Q4 KS',
    benchmarkLatencySeconds: 65.35,
    serverLabel: 'Ollama 4090',
    speed: 'slow',
    description: '地端 Ollama 4090，Mistral Small 3.1 24B Q4 KS。',
  }),
  createLocalModel({
    id: 'local-ollama-5090-nemotron-3-nano-30b',
    name: 'Nemotron 3 Nano 30B',
    canonicalName: 'Nemotron 3 Nano 30B',
    benchmarkLatencySeconds: 9.97,
    serverLabel: 'Ollama 5090',
    speed: 'fast',
    description: '地端 Ollama 5090，Nemotron 3 Nano 30B。',
  }),
  createLocalModel({
    id: 'local-ollama-5090-granite-docling',
    name: 'Granite Docling',
    canonicalName: 'Granite Docling',
    benchmarkLatencySeconds: 5.79,
    serverLabel: 'Ollama 5090',
    speed: 'fast',
    description: '地端 Ollama 5090，Granite Docling。',
  }),
  createLocalModel({
    id: 'local-ollama-5090-apriel-1.6-15b-thinker',
    name: 'Apriel 1.6 15B Thinker',
    canonicalName: 'Apriel 1.6 15B Thinker',
    benchmarkLatencySeconds: 9.41,
    serverLabel: 'Ollama 5090',
    speed: 'fast',
    description: '地端 Ollama 5090，Apriel 1.6 15B Thinker。',
  }),
  createLocalModel({
    id: 'local-ollama-5090-apriel-1.5-15b-thinker',
    name: 'Apriel 1.5 15B Thinker',
    canonicalName: 'Apriel 1.5 15B Thinker',
    benchmarkLatencySeconds: 6.01,
    serverLabel: 'Ollama 5090',
    speed: 'fast',
    description: '地端 Ollama 5090，Apriel 1.5 15B Thinker。',
  }),
  createLocalModel({
    id: 'local-ollama-5090-llama3.2-vision-11b',
    name: 'Llama 3.2 Vision 11B',
    canonicalName: 'Llama 3.2 Vision 11B',
    benchmarkLatencySeconds: 4.44,
    serverLabel: 'Ollama 5090',
    speed: 'fast',
    description: '地端 Ollama 5090，Llama 3.2 Vision 11B。',
  }),
  createLocalModel({
    id: 'local-ollama-5090-gemma3-27b',
    name: 'Gemma 3 27B',
    canonicalName: 'Gemma 3 27B',
    benchmarkLatencySeconds: 7.02,
    serverLabel: 'Ollama 5090',
    speed: 'fast',
    description: '地端 Ollama 5090，Gemma 3 27B。',
  }),
  createLocalModel({
    id: 'local-ollama-4090-gemma3-27b',
    name: 'Gemma 3 27B',
    canonicalName: 'Gemma 3 27B',
    benchmarkLatencySeconds: 295.58,
    serverLabel: 'Ollama 4090',
    speed: 'slow',
    description: '地端 Ollama 4090，Gemma 3 27B。',
  }),
  createLocalModel({
    id: 'local-ollama-4090-phi4',
    name: 'Phi-4',
    canonicalName: 'Phi-4',
    benchmarkLatencySeconds: 44.8,
    serverLabel: 'Ollama 4090',
    speed: 'medium',
    description: '地端 Ollama 4090，Phi-4。',
  }),
  createLocalModel({
    id: 'local-ollama-4090-gemma3-12b',
    name: 'Gemma 3 12B',
    canonicalName: 'Gemma 3 12B',
    benchmarkLatencySeconds: 117.92,
    serverLabel: 'Ollama 4090',
    speed: 'slow',
    description: '地端 Ollama 4090，Gemma 3 12B。',
  }),
  createLocalModel({
    id: 'local-ollama-4090-gemma3-latest',
    name: 'Gemma 3 Latest',
    canonicalName: 'Gemma 3 Latest',
    benchmarkLatencySeconds: 38.69,
    serverLabel: 'Ollama 4090',
    speed: 'medium',
    description: '地端 Ollama 4090，Gemma 3 Latest。',
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
