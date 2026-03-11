import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AzureOpenAI } from 'openai';

const DEFAULT_AZURE_OPENAI_ENDPOINT = 'https://9n00400.openai.azure.com/';
const DEFAULT_AZURE_OPENAI_DEPLOYMENT = 'gpt-5.2';
const DEFAULT_AZURE_OPENAI_API_VERSION = '2024-12-01-preview';
const PROJECT_04_AZURE_OPENAI_ENDPOINT = 'https://project-04-openai-service.openai.azure.com/';
const PROJECT_04_AZURE_OPENAI_API_VERSION = '2025-04-01-preview';
const PROJECT_04_AZURE_OPENAI_GPT_54_DEPLOYMENT = 'project-04-gpt-5.4';
const PROJECT_04_AZURE_OPENAI_GPT_54_PRO_DEPLOYMENT = 'project-04-gpt-5.4-pro';

const DEFAULT_ANTHROPIC_BASE_URL =
  'https://project3-docai-resource.services.ai.azure.com/anthropic/';
const DEFAULT_ANTHROPIC_DEPLOYMENT = 'claude-opus-4-5';
const SONNET_46_ANTHROPIC_BASE_URL = 'https://9h00200-act-aifoundry.openai.azure.com/anthropic/';
const SONNET_46_ANTHROPIC_DEPLOYMENT = 'project-04-claude-sonnet-4-6';
const LOCAL_OLLAMA_4090_API_URL = 'http://10.61.16.31:11434/api';
const LOCAL_OLLAMA_5090_API_URL = 'http://10.61.16.119:11434/api';
const LOCAL_VLLM_4090_API_URL = 'http://10.61.16.101:8000';

const ARENA_SYSTEM_PROMPT =
  '請一律使用繁體中文回答。不要輸出表格、Markdown 語法或簡體中文，且回答清晰簡潔。只輸出最終答案，不要輸出思考過程、推理步驟、內部提示、thought、thinking、<think>、<unused> 或任何類似標記。';

const DEFAULT_RESPONSE_TOKEN_LIMIT = 4096;
const DEFAULT_TEMPERATURE = 0.3;
const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

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
    kind: 'vllm',
    apiUrl: LOCAL_VLLM_4090_API_URL,
    model: '/mnt/model/gemma-3-27b-it-qat-compressed-tensors',
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
    model: 'gemma3:27-it-qat',
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
    const { modelId, prompt, systemPrompt, responseTokenLimit, temperature } =
      (await request.json()) as {
        modelId?: string;
        prompt?: string;
        systemPrompt?: string;
        responseTokenLimit?: number;
        temperature?: number;
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

