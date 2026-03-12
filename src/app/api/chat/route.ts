import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AzureOpenAI } from 'openai';
import type { ArenaOrchestrationConfig } from '@/types';

const DEFAULT_AZURE_OPENAI_ENDPOINT = 'https://9n00400.openai.azure.com/';
const DEFAULT_AZURE_OPENAI_DEPLOYMENT = 'gpt-5.2';
const DEFAULT_AZURE_OPENAI_API_VERSION = '2024-12-01-preview';
const PROJECT_04_AZURE_OPENAI_ENDPOINT = 'https://project-04-openai-service.openai.azure.com/';
const PROJECT_04_AZURE_OPENAI_API_VERSION = '2025-04-01-preview';
const PROJECT_04_AZURE_OPENAI_GPT_54_DEPLOYMENT = 'project-04-gpt-5.4';
const PROJECT_04_AZURE_OPENAI_GPT_54_PRO_DEPLOYMENT = 'project-04-gpt-5.4-pro';
const ARENA_SPECIAL_EXPERT_MODEL_ID = 'arena-special-expert-discussion';
const ARENA_SPECIAL_DEBATE_MODEL_ID = 'arena-special-debate';
const ARENA_SPECIAL_PRESSURE_TEST_MODEL_ID = 'arena-special-pressure-test';

const DEFAULT_ANTHROPIC_BASE_URL =
  'https://project3-docai-resource.services.ai.azure.com/anthropic/';
const DEFAULT_ANTHROPIC_DEPLOYMENT = 'claude-opus-4-5';
const SONNET_46_ANTHROPIC_BASE_URL = 'https://9h00200-act-aifoundry.openai.azure.com/anthropic/';
const SONNET_46_ANTHROPIC_DEPLOYMENT = 'project-04-claude-sonnet-4-6';
const LOCAL_OLLAMA_4090_API_URL = 'http://10.61.16.31:11434/api';
const LOCAL_OLLAMA_5090_API_URL = 'http://10.61.16.119:11434/api';
const ARENA_SYSTEM_PROMPT =
  '請一律使用繁體中文回答。不要輸出表格、Markdown 語法或簡體中文，且回答清晰簡潔。只輸出最終答案，不要輸出思考過程、推理步驟、內部提示、thought、thinking、<think>、<unused> 或任何類似標記。';

const DEFAULT_RESPONSE_TOKEN_LIMIT = 4096;
const DEFAULT_TEMPERATURE = 0.3;
const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_TEXT_MODEL_IDS = new Set([
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-3-flash-preview',
  'gemini-3-pro-preview',
  'gemini-3.1-pro-preview',
  'gemini-3.1-flash-lite-preview',
]);

interface ProviderRequestOptions {
  systemPrompt?: string;
  responseTokenLimit?: number;
  temperature?: number;
}

interface GeneratedImagePayload {
  mimeType: string;
  data: string;
}

interface ImageGenerationResponse {
  response: string;
  images: GeneratedImagePayload[];
}

interface AzureOpenAIModelConfig {
  endpoint: string;
  deployment: string;
  apiVersion: string;
  apiKeyEnvNames: string[];
  requestMode: 'chat-completions' | 'responses';
}

interface AnthropicModelConfig {
  baseUrl: string;
  deployment: string;
  apiKeyEnvNames: string[];
}

type LocalRuntimeConfig =
  | { kind: 'ollama'; apiUrl: string; model: string }
  | { kind: 'vllm'; apiUrl: string; model: string };

const LOCAL_MODEL_CONFIGS: Record<string, LocalRuntimeConfig> = {
  'local-vllm-4090-gemma-3-27b-it-qat': {
    kind: 'ollama',
    apiUrl: LOCAL_OLLAMA_4090_API_URL,
    model: 'gemma3:27b-it-qat',
  },
  'local-ollama-5090-translategemma-27b': {
    kind: 'ollama',
    apiUrl: LOCAL_OLLAMA_5090_API_URL,
    model: 'translategemma:27b',
  },
  'local-ollama-4090-translategemma-27b': {
    kind: 'ollama',
    apiUrl: LOCAL_OLLAMA_4090_API_URL,
    model: 'translategemma:27b',
  },
  'local-ollama-5090-translategemma-12b': {
    kind: 'ollama',
    apiUrl: LOCAL_OLLAMA_5090_API_URL,
    model: 'translategemma:12b',
  },
  'local-ollama-5090-translategemma-4b': {
    kind: 'ollama',
    apiUrl: LOCAL_OLLAMA_5090_API_URL,
    model: 'translategemma:4b',
  },
  'local-ollama-5090-medgemma-1.5-4b': {
    kind: 'ollama',
    apiUrl: LOCAL_OLLAMA_5090_API_URL,
    model: 'hf.co/unsloth/medgemma-1.5-4b-it-GGUF:Q4_K_M',
  },
  'local-ollama-5090-gpt-oss-20b': {
    kind: 'ollama',
    apiUrl: LOCAL_OLLAMA_5090_API_URL,
    model: 'gpt-oss:20b',
  },
  'local-ollama-5090-mistral-small3.2-24b': {
    kind: 'ollama',
    apiUrl: LOCAL_OLLAMA_5090_API_URL,
    model: 'mistral-small3.2:24b',
  },
  'local-ollama-5090-ministral-3-3b': {
    kind: 'ollama',
    apiUrl: LOCAL_OLLAMA_5090_API_URL,
    model: 'ministral-3:3b',
  },
  'local-ollama-4090-ministral-3-3b': {
    kind: 'ollama',
    apiUrl: LOCAL_OLLAMA_4090_API_URL,
    model: 'ministral-3:3b',
  },
  'local-ollama-5090-ministral-3-8b': {
    kind: 'ollama',
    apiUrl: LOCAL_OLLAMA_5090_API_URL,
    model: 'ministral-3:8b',
  },
  'local-ollama-4090-ministral-3-8b': {
    kind: 'ollama',
    apiUrl: LOCAL_OLLAMA_4090_API_URL,
    model: 'ministral-3:8b',
  },
  'local-ollama-5090-ministral-3-14b': {
    kind: 'ollama',
    apiUrl: LOCAL_OLLAMA_5090_API_URL,
    model: 'ministral-3:14b',
  },
  'local-ollama-4090-ministral-3-14b': {
    kind: 'ollama',
    apiUrl: LOCAL_OLLAMA_4090_API_URL,
    model: 'ministral-3:14b',
  },
  'local-ollama-4090-medgemma-1.5-4b': {
    kind: 'ollama',
    apiUrl: LOCAL_OLLAMA_4090_API_URL,
    model: 'MedAIBase/MedGemma1.5:4b-it-q4_0',
  },
  'local-ollama-4090-llama-breeze2-8b': {
    kind: 'ollama',
    apiUrl: LOCAL_OLLAMA_4090_API_URL,
    model: 'willqiu/Llama-Breeze2-8B-Instruct:latest',
  },
  'local-ollama-4090-phi4': {
    kind: 'ollama',
    apiUrl: LOCAL_OLLAMA_4090_API_URL,
    model: 'phi4:latest',
  },
  'local-ollama-4090-gemma3-latest': {
    kind: 'ollama',
    apiUrl: LOCAL_OLLAMA_4090_API_URL,
    model: 'gemma3:latest',
  },
  'local-ollama-4090-gemma3-270m': {
    kind: 'ollama',
    apiUrl: LOCAL_OLLAMA_4090_API_URL,
    model: 'gemma3:270m',
  },
  'local-ollama-4090-gemma3n-e4b': {
    kind: 'ollama',
    apiUrl: LOCAL_OLLAMA_4090_API_URL,
    model: 'gemma3n:e4b',
  },
  'local-ollama-4090-gemma3-27b-it-qat': {
    kind: 'ollama',
    apiUrl: LOCAL_OLLAMA_4090_API_URL,
    model: 'gemma3:27b-it-qat',
  },
  'local-ollama-5090-gemma3-27b-it-qat': {
    kind: 'ollama',
    apiUrl: LOCAL_OLLAMA_5090_API_URL,
    model: 'gemma3:27b-it-qat',
  },
  'local-ollama-4090-gemma3-12b-it-qat': {
    kind: 'ollama',
    apiUrl: LOCAL_OLLAMA_4090_API_URL,
    model: 'gemma3:12b-it-qat',
  },
  'local-ollama-4090-amoral-gemma3-12b-v2-qat': {
    kind: 'ollama',
    apiUrl: LOCAL_OLLAMA_4090_API_URL,
    model: 'hf.co/soob3123/amoral-gemma3-12B-v2-qat-Q4_0-GGUF:latest',
  },
  'local-ollama-4090-phi4-mini': {
    kind: 'ollama',
    apiUrl: LOCAL_OLLAMA_4090_API_URL,
    model: 'phi4-mini:latest',
  },
  'local-ollama-4090-granite-3.2-vision': {
    kind: 'ollama',
    apiUrl: LOCAL_OLLAMA_4090_API_URL,
    model: 'ollama.com/library/granite3.2-vision:latest',
  },
  'local-ollama-4090-msmall-3.1-q6': {
    kind: 'ollama',
    apiUrl: LOCAL_OLLAMA_4090_API_URL,
    model: 'djdeniro/msmall-3.1-q6:latest',
  },
  'local-ollama-4090-mistral-small': {
    kind: 'ollama',
    apiUrl: LOCAL_OLLAMA_4090_API_URL,
    model: 'mistral-small:latest',
  },
  'local-ollama-4090-mistral-small-3.1-24b-q4-ks': {
    kind: 'ollama',
    apiUrl: LOCAL_OLLAMA_4090_API_URL,
    model: 'cnjack/mistral-samll-3.1:24b-it-q4_K_S',
  },
  'local-ollama-5090-nemotron-3-nano-30b': {
    kind: 'ollama',
    apiUrl: LOCAL_OLLAMA_5090_API_URL,
    model: 'nemotron-3-nano:30b',
  },
  'local-ollama-5090-granite-docling': {
    kind: 'ollama',
    apiUrl: LOCAL_OLLAMA_5090_API_URL,
    model: 'granite-docling:latest',
  },
  'local-ollama-5090-apriel-1.6-15b-thinker': {
    kind: 'ollama',
    apiUrl: LOCAL_OLLAMA_5090_API_URL,
    model: 'Apriel-1.6-15b-Thinker:Q4_K_M',
  },
  'local-ollama-5090-apriel-1.5-15b-thinker': {
    kind: 'ollama',
    apiUrl: LOCAL_OLLAMA_5090_API_URL,
    model: 'Apriel-1.5-15b-Thinker:Q4_K_M',
  },
  'local-ollama-5090-llama3.2-vision-11b': {
    kind: 'ollama',
    apiUrl: LOCAL_OLLAMA_5090_API_URL,
    model: 'llama3.2-vision:11b',
  },
  'local-ollama-5090-gpt-oss-20b-202511': {
    kind: 'ollama',
    apiUrl: LOCAL_OLLAMA_5090_API_URL,
    model: 'gpt-oss:20b-202511',
  },
  'local-ollama-5090-gemma3-27b': {
    kind: 'ollama',
    apiUrl: LOCAL_OLLAMA_5090_API_URL,
    model: 'gemma3:27b',
  },
  'local-ollama-4090-translategemma-12b': {
    kind: 'ollama',
    apiUrl: LOCAL_OLLAMA_4090_API_URL,
    model: 'translategemma:12b',
  },
  'local-ollama-4090-gpt-oss-20b': {
    kind: 'ollama',
    apiUrl: LOCAL_OLLAMA_4090_API_URL,
    model: 'gpt-oss:20b',
  },
  'local-ollama-4090-gemma3-27b': {
    kind: 'ollama',
    apiUrl: LOCAL_OLLAMA_4090_API_URL,
    model: 'gemma3:27b',
  },
  'local-ollama-4090-breeze-7b-instruct-v1-0': {
    kind: 'ollama',
    apiUrl: LOCAL_OLLAMA_4090_API_URL,
    model: 'Breeze-7B-Instruct-v1_0:latest',
  },
  'local-ollama-4090-gemma3-12b': {
    kind: 'ollama',
    apiUrl: LOCAL_OLLAMA_4090_API_URL,
    model: 'gemma3:12b',
  },
};

const AZURE_OPENAI_MODEL_CONFIGS: Record<string, AzureOpenAIModelConfig> = {
  'gpt-5.2': {
    endpoint: DEFAULT_AZURE_OPENAI_ENDPOINT,
    deployment: DEFAULT_AZURE_OPENAI_DEPLOYMENT,
    apiVersion: DEFAULT_AZURE_OPENAI_API_VERSION,
    apiKeyEnvNames: ['AZURE_OPENAI_API_KEY', '5.2_AZURE_OPENAI_API_KEY'],
    requestMode: 'chat-completions',
  },
  'gpt-5.4': {
    endpoint: PROJECT_04_AZURE_OPENAI_ENDPOINT,
    deployment: PROJECT_04_AZURE_OPENAI_GPT_54_DEPLOYMENT,
    apiVersion: PROJECT_04_AZURE_OPENAI_API_VERSION,
    apiKeyEnvNames: ['5.4_AZURE_OPENAI_API_KEY', '5.4_PRO_AZURE_OPENAI_API_KEY', '5.4_pro_AZURE_OPENAI_API_KEY'],
    requestMode: 'responses',
  },
  'gpt-5.4-pro': {
    endpoint: PROJECT_04_AZURE_OPENAI_ENDPOINT,
    deployment: PROJECT_04_AZURE_OPENAI_GPT_54_PRO_DEPLOYMENT,
    apiVersion: PROJECT_04_AZURE_OPENAI_API_VERSION,
    apiKeyEnvNames: ['5.4_PRO_AZURE_OPENAI_API_KEY', '5.4_pro_AZURE_OPENAI_API_KEY', '5.4_AZURE_OPENAI_API_KEY'],
    requestMode: 'responses',
  },
};

const ANTHROPIC_MODEL_CONFIGS: Record<string, AnthropicModelConfig> = {
  'claude-opus-4-5': {
    baseUrl: DEFAULT_ANTHROPIC_BASE_URL,
    deployment: DEFAULT_ANTHROPIC_DEPLOYMENT,
    apiKeyEnvNames: [
      'AZURE_OPUS_4.5_API_KEY',
      'AZURE_OPUS_4_5_API_KEY',
      'AZURE_ANTHROPIC_API_KEY',
      'ANTHROPIC_FOUNDRY_API_KEY',
    ],
  },
  'claude-sonnet-4-6': {
    baseUrl: SONNET_46_ANTHROPIC_BASE_URL,
    deployment: SONNET_46_ANTHROPIC_DEPLOYMENT,
    apiKeyEnvNames: [
      'AZURE_SONNET_4.6_API_KEY',
      'AZURE_SONNET_4_6_API_KEY',
      'ANTHROPIC_FOUNDRY_API_KEY',
    ],
  },
};

function isCloudTextModelId(modelId: string): boolean {
  return modelId in AZURE_OPENAI_MODEL_CONFIGS || modelId in ANTHROPIC_MODEL_CONFIGS || GEMINI_TEXT_MODEL_IDS.has(modelId);
}

function assertCloudTextModelId(modelId: string, role: string): void {
  if (!isCloudTextModelId(modelId)) {
    throw new Error(`${role} 必須使用雲端文字模型，目前收到：${modelId}`);
  }
}

async function handleCloudTextModel(
  prompt: string,
  modelId: string,
  options: ProviderRequestOptions
): Promise<string> {
  if (modelId in AZURE_OPENAI_MODEL_CONFIGS) {
    return handleOpenAI(prompt, modelId, options);
  }

  if (GEMINI_TEXT_MODEL_IDS.has(modelId)) {
    return handleGemini(prompt, modelId, options);
  }

  if (modelId in ANTHROPIC_MODEL_CONFIGS) {
    return handleAnthropic(prompt, modelId, options);
  }

  throw new Error(`Unsupported cloud model: ${modelId}`);
}

function formatOrchestrationFailure(modelId: string, error: unknown): string {
  const message = error instanceof Error ? error.message : '未知錯誤';
  return `[${modelId}] 本輪未取得有效回應：${message}`;
}

function validateExpertDiscussionConfig(orchestration: ArenaOrchestrationConfig | undefined): Extract<ArenaOrchestrationConfig, { kind: 'expert-discussion' }> {
  if (!orchestration || orchestration.kind !== 'expert-discussion') {
    throw new Error('專家討論模式缺少有效設定');
  }

  if (orchestration.memberModelIds.length !== 3) {
    throw new Error('專家討論模式必須指定 3 個成員模型');
  }

  if (new Set(orchestration.memberModelIds).size !== 3) {
    throw new Error('專家討論模式的 3 個成員模型必須互不重複');
  }

  orchestration.memberModelIds.forEach((modelId, index) => {
    assertCloudTextModelId(modelId, `專家成員 ${index + 1}`);
  });
  assertCloudTextModelId(orchestration.synthesisModelId, '專家統整者');

  return orchestration;
}

function validateDebateConfig(orchestration: ArenaOrchestrationConfig | undefined): Extract<ArenaOrchestrationConfig, { kind: 'debate' }> {
  if (!orchestration || orchestration.kind !== 'debate') {
    throw new Error('辯論模式缺少有效設定');
  }

  assertCloudTextModelId(orchestration.propositionModelId, '正方模型');
  assertCloudTextModelId(orchestration.oppositionModelId, '反方模型');
  assertCloudTextModelId(orchestration.judgeModelId, '裁判模型');

  return orchestration;
}

function validatePressureTestConfig(orchestration: ArenaOrchestrationConfig | undefined): Extract<ArenaOrchestrationConfig, { kind: 'pressure-test' }> {
  if (!orchestration || orchestration.kind !== 'pressure-test') {
    throw new Error('壓力測試模式缺少有效設定');
  }

  assertCloudTextModelId(orchestration.targetModelId, '受測模型');

  if (orchestration.attackerModelIds.length !== 2) {
    throw new Error('壓力測試模式必須指定 2 個攻擊模型');
  }

  orchestration.attackerModelIds.forEach((modelId, index) => {
    assertCloudTextModelId(modelId, `攻擊者 ${index + 1}`);
  });

  return orchestration;
}

async function handleArenaExpertDiscussion(
  prompt: string,
  orchestration: ArenaOrchestrationConfig | undefined,
  options: ProviderRequestOptions
): Promise<string> {
  const config = validateExpertDiscussionConfig(orchestration);
  const expertResponses = await Promise.all(
    config.memberModelIds.map(async (modelId) => {
      try {
        const response = await handleCloudTextModel(prompt, modelId, {
          ...options,
          systemPrompt: [
            '你是專家討論會成員。請直接提出你最有判斷力的分析、風險提醒、例外情境與建議。',
            '不要模擬對話，不要提到其他模型，也不要描述你正在參與會議。',
            options.systemPrompt?.trim() ?? '',
          ]
            .filter(Boolean)
            .join('\n\n'),
          responseTokenLimit: Math.min(resolveResponseTokenLimit(options.responseTokenLimit), 3072),
          temperature: 0.35,
        });

        return {
          modelId,
          response: response.trim() || `[${modelId}] 本輪未取得有效文字回應。`,
        };
      } catch (error) {
        return {
          modelId,
          response: formatOrchestrationFailure(modelId, error),
        };
      }
    })
  );

  const synthesisPrompt = [
    '使用者題目如下，後面附上三位專家模型對同一題的意見。',
    '請直接輸出給使用者的單一最終答案。',
    '你必須整合共識、吸收有價值的分歧，補足關鍵限制與建議。',
    '不要提到專家、模型、討論會、正反意見或任何投票過程。',
    `題目：\n${prompt}`,
    ...expertResponses.map((item, index) => `意見 ${index + 1}：\n${item.response}`),
  ].join('\n\n');

  const synthesis = await handleCloudTextModel(synthesisPrompt, config.synthesisModelId, {
    ...options,
    systemPrompt: [
      '你是最終統整者。請把多方專家意見濃縮成像單一高品質模型寫出的最終答案。',
      '不要暴露任何討論過程、來源模型、角色分工或中間筆記。',
      options.systemPrompt?.trim() ?? '',
    ]
      .filter(Boolean)
      .join('\n\n'),
    temperature: 0.3,
  });

  return synthesis.trim() || '本輪統整模型未回傳有效內容，請改用其他模型組合再試一次。';
}

async function handleArenaDebate(
  prompt: string,
  orchestration: ArenaOrchestrationConfig | undefined,
  options: ProviderRequestOptions
): Promise<string> {
  const config = validateDebateConfig(orchestration);

  const propositionResponse = await handleCloudTextModel(prompt, config.propositionModelId, {
    ...options,
    systemPrompt: [
      '你是辯論中的先發主張者。請先提出你認為最合理、最完整的答案。',
      '回答要有論點、依據、限制與建議，但不要提到辯論流程。',
      options.systemPrompt?.trim() ?? '',
    ]
      .filter(Boolean)
      .join('\n\n'),
    temperature: 0.35,
  });

  const oppositionPrompt = [
    `原始題目：\n${prompt}`,
    `先發主張：\n${propositionResponse}`,
    '請扮演反對者，找出上述答案中最值得質疑、挑戰、補充或修正的地方。',
    '你的重點是指出漏洞、錯誤假設、忽略的風險或更好的替代觀點。',
  ].join('\n\n');

  const oppositionResponse = await handleCloudTextModel(oppositionPrompt, config.oppositionModelId, {
    ...options,
    systemPrompt: [
      '你是辯論中的反對者。你的任務是嚴格挑戰前一位模型的答案。',
      '不要客套，不要重述整題，只聚焦在反駁與修正。',
      options.systemPrompt?.trim() ?? '',
    ]
      .filter(Boolean)
      .join('\n\n'),
    temperature: 0.35,
  });

  const judgePrompt = [
    `使用者題目：\n${prompt}`,
    `主張方內容：\n${propositionResponse}`,
    `反對方內容：\n${oppositionResponse}`,
    '請判定哪一方更有道理，並整理成給使用者的最終答案。',
    '輸出應像單一模型的成熟回答，可以先簡短指出哪一方論證更站得住腳，再給出整理後的觀點與建議。',
    '不要逐字轉錄辯論，也不要提到模型名稱。',
  ].join('\n\n');

  const judgedResponse = await handleCloudTextModel(judgePrompt, config.judgeModelId, {
    ...options,
    systemPrompt: [
      '你是辯論裁判。請以證據、邏輯完整性、風險意識與可執行性來判定哪一方較有說服力。',
      '最終輸出要像單一模型的回答，而不是會議紀錄。',
      options.systemPrompt?.trim() ?? '',
    ]
      .filter(Boolean)
      .join('\n\n'),
    temperature: 0.25,
  });

  return judgedResponse.trim() || '本輪裁判模型未回傳有效內容，請改用其他模型組合再試一次。';
}

async function handleArenaPressureTest(
  prompt: string,
  orchestration: ArenaOrchestrationConfig | undefined,
  options: ProviderRequestOptions
): Promise<string> {
  const config = validatePressureTestConfig(orchestration);

  const initialResponse = await handleCloudTextModel(prompt, config.targetModelId, {
    ...options,
    systemPrompt: [
      '你是受測模型。請先就使用者問題給出你目前最完整、最有把握的原始答案。',
      '先正常回答，不要預先替自己辯護，也不要提到壓力測試流程。',
      options.systemPrompt?.trim() ?? '',
    ]
      .filter(Boolean)
      .join('\n\n'),
    temperature: 0.35,
  });

  const attackerResponses = await Promise.all(
    config.attackerModelIds.map(async (modelId, index) => {
      const attackerPrompt = [
        `使用者題目：\n${prompt}`,
        `受測模型原始答案：\n${initialResponse}`,
        '請你從強勢專家或高壓審查者角度，盡可能挑出這份答案最脆弱、最值得攻擊的地方。',
        '你應該指出邏輯漏洞、證據不足、過度自信、忽略情境、風險與反例。',
      ].join('\n\n');

      try {
        const response = await handleCloudTextModel(attackerPrompt, modelId, {
          ...options,
          systemPrompt: [
            `你是攻擊者 ${index + 1}。請自稱為強勢專家、嚴格審查者或高標準顧問。`,
            '你的任務不是平衡討論，而是施加壓力、提出尖銳質疑、逼迫對方修正漏洞。',
            '不要幫受測模型說話。',
            options.systemPrompt?.trim() ?? '',
          ]
            .filter(Boolean)
            .join('\n\n'),
          responseTokenLimit: Math.min(resolveResponseTokenLimit(options.responseTokenLimit), 3072),
          temperature: 0.45,
        });

        return {
          modelId,
          response: response.trim() || `[${modelId}] 本輪未取得有效文字回應。`,
        };
      } catch (error) {
        return {
          modelId,
          response: formatOrchestrationFailure(modelId, error),
        };
      }
    })
  );

  const reconsiderPrompt = [
    `使用者題目：\n${prompt}`,
    `你先前的原始答案：\n${initialResponse}`,
    ...attackerResponses.map((item, index) => `攻擊意見 ${index + 1}：\n${item.response}`),
    '現在請重新審視自己的立場。',
    '如果你認為攻擊成立，就修正答案；如果你認為原本立場仍然成立，就說明為何不改變。',
    '最終輸出必須是給使用者的單一成熟答案，可以自然帶出你是否調整立場，但不要寫成會議紀錄。',
  ].join('\n\n');

  const reconsideredResponse = await handleCloudTextModel(reconsiderPrompt, config.targetModelId, {
    ...options,
    systemPrompt: [
      '你是接受壓力測試後再次作答的模型。',
      '請誠實面對兩位強勢攻擊者的質疑，必要時修正立場，不必要時清楚捍衛原先觀點。',
      '最終輸出要像單一模型在深思後寫出的答案。',
      options.systemPrompt?.trim() ?? '',
    ]
      .filter(Boolean)
      .join('\n\n'),
    temperature: 0.25,
  });

  const normalizedInitialResponse = initialResponse.trim() || '本輪受測模型未回傳有效的初始內容。';
  const normalizedReconsideredResponse =
    reconsideredResponse.trim() || '本輪受測模型在壓力測試後未回傳有效內容，請改用其他模型組合再試一次。';

  return ['初始回應：', normalizedInitialResponse, '被挑戰後的回應：', normalizedReconsideredResponse].join(
    '\n\n'
  );
}

function requireEnv(nameCandidates: string[]): string {
  for (const name of nameCandidates) {
    const value = process.env[name];
    if (value) {
      return value;
    }
  }

  throw new Error(`Missing environment variable. Tried: ${nameCandidates.join(', ')}`);
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`;
}

function extractOpenAIResponsesText(response: { output_text?: string; output?: unknown[] }): string {
  if (typeof response.output_text === 'string' && response.output_text.trim()) {
    return response.output_text.trim();
  }

  if (!Array.isArray(response.output)) {
    return '';
  }

  return response.output
    .flatMap((item) => {
      if (typeof item !== 'object' || item === null || !('content' in item) || !Array.isArray(item.content)) {
        return [] as string[];
      }

      return item.content.flatMap((contentItem) => {
        if (
          typeof contentItem !== 'object' ||
          contentItem === null ||
          !('type' in contentItem) ||
          contentItem.type !== 'output_text' ||
          !('text' in contentItem) ||
          typeof contentItem.text !== 'string'
        ) {
          return [] as string[];
        }

        const text = contentItem.text.trim();
        return text ? [text] : [];
      });
    })
    .join('\n\n')
    .trim();
}

function buildSystemPrompt(systemPrompt?: string): string {
  return systemPrompt ? `${ARENA_SYSTEM_PROMPT}\n\n${systemPrompt}` : ARENA_SYSTEM_PROMPT;
}

function sanitizeModelResponse(rawText: string): string {
  const originalText = rawText.trim();

  if (!originalText) {
    return originalText;
  }

  let sanitizedText = originalText
    .replace(/<\s*think\s*>[\s\S]*?<\s*\/think\s*>/gi, '')
    .replace(/<\s*thinking\s*>[\s\S]*?<\s*\/thinking\s*>/gi, '')
    .trim();

  const unusedThoughtMatch = sanitizedText.match(/^<unused\d+>\s*thought\b[\s\S]*?<unused\d+>([\s\S]*)$/i);

  if (unusedThoughtMatch?.[1]) {
    sanitizedText = unusedThoughtMatch[1].trim();
  }

  sanitizedText = sanitizedText.replace(/<unused\d+>/gi, '').trim();

  return sanitizedText || originalText;
}

function resolveResponseTokenLimit(responseTokenLimit?: number): number {
  if (typeof responseTokenLimit !== 'number' || Number.isNaN(responseTokenLimit)) {
    return DEFAULT_RESPONSE_TOKEN_LIMIT;
  }

  return Math.max(256, Math.min(DEFAULT_RESPONSE_TOKEN_LIMIT, Math.floor(responseTokenLimit)));
}

function resolveTemperature(temperature?: number): number {
  if (typeof temperature !== 'number' || Number.isNaN(temperature)) {
    return DEFAULT_TEMPERATURE;
  }

  return Math.min(1, Math.max(0, temperature));
}

function extractAnthropicText(content: unknown): string {
  if (!Array.isArray(content)) {
    return '';
  }

  return content
    .filter(
      (item): item is { type?: string; text?: string } =>
        typeof item === 'object' && item !== null && 'text' in item
    )
    .map((item) => (item.type === 'text' ? item.text ?? '' : ''))
    .filter(Boolean)
    .join('\n\n')
    .trim();
}

function extractGeminiImageResponse(data: unknown): ImageGenerationResponse {
  const candidates =
    typeof data === 'object' && data !== null && 'candidates' in data && Array.isArray(data.candidates)
      ? data.candidates
      : [];
  const parts: unknown[] =
    candidates.length > 0 &&
    typeof candidates[0] === 'object' &&
    candidates[0] !== null &&
    'content' in candidates[0] &&
    typeof candidates[0].content === 'object' &&
    candidates[0].content !== null &&
    'parts' in candidates[0].content &&
    Array.isArray(candidates[0].content.parts)
      ? candidates[0].content.parts
      : [];

  const response = parts
    .filter(
      (part: unknown): part is { text?: string } =>
        typeof part === 'object' && part !== null && 'text' in part && typeof part.text === 'string'
    )
    .map((part: { text?: string }) => part.text?.trim() ?? '')
    .filter(Boolean)
    .join('\n\n');

  const images = parts
    .map((part: unknown) => {
      if (typeof part !== 'object' || part === null) {
        return null;
      }

      const inlineData =
        'inlineData' in part && typeof part.inlineData === 'object' && part.inlineData !== null
          ? part.inlineData
          : 'inline_data' in part && typeof part.inline_data === 'object' && part.inline_data !== null
            ? part.inline_data
            : null;

      if (!inlineData) {
        return null;
      }

      const mimeType =
        'mimeType' in inlineData && typeof inlineData.mimeType === 'string'
          ? inlineData.mimeType
          : 'mime_type' in inlineData && typeof inlineData.mime_type === 'string'
            ? inlineData.mime_type
            : null;
      const imageData = 'data' in inlineData && typeof inlineData.data === 'string' ? inlineData.data : null;

      if (!mimeType || !imageData) {
        return null;
      }

      return {
        mimeType,
        data: imageData,
      };
    })
    .filter((item: GeneratedImagePayload | null): item is GeneratedImagePayload => item !== null);

  return {
    response,
    images,
  };
}

async function handleOpenAI(
  prompt: string,
  modelId: string,
  options: ProviderRequestOptions
): Promise<string> {
  const modelConfig = AZURE_OPENAI_MODEL_CONFIGS[modelId];

  if (!modelConfig) {
    throw new Error(`Unsupported Azure OpenAI model: ${modelId}`);
  }

  const endpoint = modelConfig.endpoint;
  const apiKey = requireEnv(modelConfig.apiKeyEnvNames);
  const apiVersion = modelConfig.apiVersion;
  const deployment = modelConfig.deployment;
  const systemPrompt = buildSystemPrompt(options.systemPrompt);
  const responseTokenLimit = resolveResponseTokenLimit(options.responseTokenLimit);
  const temperature = resolveTemperature(options.temperature);

  const client = new AzureOpenAI({
    endpoint,
    apiKey,
    apiVersion,
  });

  if (modelConfig.requestMode === 'responses') {
    const response = await client.responses.create({
      model: deployment,
      instructions: systemPrompt,
      input: prompt,
      max_output_tokens: responseTokenLimit,
    });

    return extractOpenAIResponsesText(response);
  }

  const response = await client.chat.completions.create({
    model: deployment,
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    max_completion_tokens: responseTokenLimit,
    temperature,
  });

  return response.choices[0]?.message?.content ?? '';
}

async function handleGemini(prompt: string, modelId: string, options: ProviderRequestOptions): Promise<string> {
  const apiKey = requireEnv(['GEMINI_API_KEY']);
  const genAI = new GoogleGenerativeAI(apiKey);
  const systemPrompt = buildSystemPrompt(options.systemPrompt);
  const responseTokenLimit = resolveResponseTokenLimit(options.responseTokenLimit);
  const temperature = resolveTemperature(options.temperature);
  const model = genAI.getGenerativeModel({
    model: modelId,
    systemInstruction: systemPrompt,
    generationConfig: {
      maxOutputTokens: responseTokenLimit,
      temperature,
    },
  });

  const result = await model.generateContent(prompt);
  return result.response.text();
}

async function handleGeminiImage(
  prompt: string,
  modelId: string,
  options: ProviderRequestOptions
): Promise<ImageGenerationResponse> {
  const apiKey = requireEnv(['GEMINI_API_KEY']);
  const systemPrompt = buildSystemPrompt(options.systemPrompt);
  const responseTokenLimit = resolveResponseTokenLimit(options.responseTokenLimit);
  const temperature = resolveTemperature(options.temperature);

  const response = await fetch(
    `${GEMINI_API_BASE_URL}/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
          temperature,
          maxOutputTokens: responseTokenLimit,
          imageConfig: {
            aspectRatio: '1:1',
          },
        },
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || data.error || 'Gemini image request failed');
  }

  const parsed = extractGeminiImageResponse(data);

  if (parsed.images.length === 0) {
    throw new Error('Gemini image response did not contain image content');
  }

  return parsed;
}

async function handleAnthropic(
  prompt: string,
  modelId: string,
  options: ProviderRequestOptions
): Promise<string> {
  const modelConfig = ANTHROPIC_MODEL_CONFIGS[modelId];

  if (!modelConfig) {
    throw new Error(`Unsupported Anthropic model: ${modelId}`);
  }

  const baseUrl = ensureTrailingSlash(modelConfig.baseUrl);
  const apiKey = requireEnv(modelConfig.apiKeyEnvNames);
  const deployment = modelConfig.deployment;
  const systemPrompt = buildSystemPrompt(options.systemPrompt);
  const responseTokenLimit = resolveResponseTokenLimit(options.responseTokenLimit);
  const temperature = resolveTemperature(options.temperature);

  const response = await fetch(new URL('v1/messages', baseUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: deployment,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: responseTokenLimit,
      temperature,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || data.error || 'Anthropic request failed');
  }

  const text = extractAnthropicText(data.content);

  if (!text) {
    throw new Error('Anthropic response did not contain text content');
  }

  return text;
}

async function handleLocalOllama(
  prompt: string,
  config: Extract<LocalRuntimeConfig, { kind: 'ollama' }>,
  options: ProviderRequestOptions
): Promise<string> {
  const systemPrompt = buildSystemPrompt(options.systemPrompt);
  const responseTokenLimit = resolveResponseTokenLimit(options.responseTokenLimit);
  const temperature = resolveTemperature(options.temperature);

  const response = await fetch(new URL('generate', ensureTrailingSlash(config.apiUrl)), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      prompt,
      system: systemPrompt,
      stream: false,
      options: {
        num_predict: responseTokenLimit,
        temperature,
      },
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `Ollama request failed (${response.status})`);
  }

  const text = typeof data.response === 'string' ? data.response.trim() : '';

  if (!text) {
    throw new Error('Ollama response did not contain text content');
  }

  return text;
}

async function handleLocalVllm(
  prompt: string,
  config: Extract<LocalRuntimeConfig, { kind: 'vllm' }>,
  options: ProviderRequestOptions
): Promise<string> {
  const systemPrompt = buildSystemPrompt(options.systemPrompt);
  const responseTokenLimit = resolveResponseTokenLimit(options.responseTokenLimit);
  const temperature = resolveTemperature(options.temperature);

  const response = await fetch(new URL('v1/chat/completions', ensureTrailingSlash(config.apiUrl)), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: responseTokenLimit,
      temperature,
      stream: false,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || data.error || `vLLM request failed (${response.status})`);
  }

  const text = data.choices?.[0]?.message?.content?.trim();

  if (!text) {
    throw new Error('vLLM response did not contain text content');
  }

  return text;
}

async function handleLocalModel(prompt: string, modelId: string, options: ProviderRequestOptions): Promise<string> {
  const config = LOCAL_MODEL_CONFIGS[modelId];

  if (!config) {
    throw new Error(`Unsupported local model: ${modelId}`);
  }

  if (config.kind === 'ollama') {
    return handleLocalOllama(prompt, config, options);
  }

  return handleLocalVllm(prompt, config, options);
}

export async function POST(request: NextRequest) {
  try {
    const { modelId, prompt, systemPrompt, responseTokenLimit, temperature, orchestration } =
      (await request.json()) as {
        modelId?: string;
        prompt?: string;
        systemPrompt?: string;
        responseTokenLimit?: number;
        temperature?: number;
        orchestration?: ArenaOrchestrationConfig;
      };

    if (!prompt || !modelId) {
      return NextResponse.json(
        { error: 'Missing required fields: modelId and prompt' },
        { status: 400 }
      );
    }

    const options: ProviderRequestOptions = {
      systemPrompt,
      responseTokenLimit,
      temperature,
    };

    let response: string | undefined;
    let imageResponse: ImageGenerationResponse | null = null;

    switch (modelId) {
      case ARENA_SPECIAL_EXPERT_MODEL_ID:
        response = await handleArenaExpertDiscussion(prompt, orchestration, options);
        break;
      case ARENA_SPECIAL_DEBATE_MODEL_ID:
        response = await handleArenaDebate(prompt, orchestration, options);
        break;
      case ARENA_SPECIAL_PRESSURE_TEST_MODEL_ID:
        response = await handleArenaPressureTest(prompt, orchestration, options);
        break;
      case 'gpt-5.2':
      case 'gpt-5.4':
      case 'gpt-5.4-pro':
        response = await handleOpenAI(prompt, modelId, options);
        break;
      case 'gemini-2.5-pro':
      case 'gemini-2.5-flash':
      case 'gemini-3-flash-preview':
      case 'gemini-3-pro-preview':
      case 'gemini-3.1-pro-preview':
      case 'gemini-3.1-flash-lite-preview':
        response = await handleGemini(prompt, modelId, options);
        break;
      case 'gemini-3.1-flash-image-preview':
        imageResponse = await handleGeminiImage(prompt, modelId, options);
        break;
      case 'claude-opus-4-5':
      case 'claude-sonnet-4-6':
        response = await handleAnthropic(prompt, modelId, options);
        break;
      default:
        if (modelId in LOCAL_MODEL_CONFIGS) {
          response = await handleLocalModel(prompt, modelId, options);
          break;
        }

        return NextResponse.json({ error: `Unsupported model: ${modelId}` }, { status: 400 });
    }

    if (imageResponse) {
      return NextResponse.json(imageResponse);
    }

    if (typeof response === 'string') {
      response = sanitizeModelResponse(response);
    }

    return NextResponse.json({ response });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

