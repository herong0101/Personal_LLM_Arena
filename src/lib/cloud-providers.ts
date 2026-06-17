/**
 * Server-side cloud model provider implementations.
 * Includes streaming generators for real-time token output.
 * Keep this file server-only; do not import from client components.
 */

import { AzureOpenAI } from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { StreamChunk } from '@/types';

// ── Constants ─────────────────────────────────────────────────────────────────

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

const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_RESPONSE_TOKEN_LIMIT = 4096;
const DEFAULT_TEMPERATURE = 0.3;

export const ARENA_SYSTEM_PROMPT =
  '請一律使用繁體中文回答。不要輸出表格、Markdown 語法或簡體中文，且回答清晰簡潔。只輸出最終答案，不要輸出思考過程、推理步驟、內部提示、thought、thinking、<think>、<unused> 或任何類似標記。';

export const GEMINI_TEXT_MODEL_IDS = new Set([
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-3-flash-preview',
  'gemini-3-pro-preview',
  'gemini-3.1-pro-preview',
  'gemini-3.1-flash-lite-preview',
]);

// ── Provider config types ─────────────────────────────────────────────────────

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

export const AZURE_OPENAI_MODEL_CONFIGS: Record<string, AzureOpenAIModelConfig> = {
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

export const ANTHROPIC_MODEL_CONFIGS: Record<string, AnthropicModelConfig> = {
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

// ── Shared utilities ──────────────────────────────────────────────────────────

export interface ProviderOptions {
  systemPrompt?: string;
  responseTokenLimit?: number;
  temperature?: number;
}

export interface GeneratedImagePayload {
  mimeType: string;
  data: string;
}

export function requireEnv(nameCandidates: string[]): string {
  for (const name of nameCandidates) {
    const value = process.env[name];
    if (value) return value;
  }
  throw new Error(`Missing environment variable. Tried: ${nameCandidates.join(', ')}`);
}

export function ensureTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`;
}

export function buildSystemPrompt(systemPrompt?: string): string {
  return systemPrompt ? `${ARENA_SYSTEM_PROMPT}\n\n${systemPrompt}` : ARENA_SYSTEM_PROMPT;
}

export function resolveResponseTokenLimit(responseTokenLimit?: number): number {
  if (typeof responseTokenLimit !== 'number' || Number.isNaN(responseTokenLimit)) {
    return DEFAULT_RESPONSE_TOKEN_LIMIT;
  }
  return Math.max(256, Math.min(DEFAULT_RESPONSE_TOKEN_LIMIT, Math.floor(responseTokenLimit)));
}

export function resolveTemperature(temperature?: number): number {
  if (typeof temperature !== 'number' || Number.isNaN(temperature)) {
    return DEFAULT_TEMPERATURE;
  }
  return Math.min(1, Math.max(0, temperature));
}

export function sanitizeModelResponse(rawText: string): string {
  const originalText = rawText.trim();
  if (!originalText) return originalText;

  let sanitizedText = originalText
    .replace(/<\s*think\s*>[\s\S]*?<\s*\/think\s*>/gi, '')
    .replace(/<\s*thinking\s*>[\s\S]*?<\s*\/thinking\s*>/gi, '')
    .trim();

  const unusedThoughtMatch = sanitizedText.match(/^<unused\d+>\s*thought\b[\s\S]*?<unused\d+>([\s\S]*)$/i);
  if (unusedThoughtMatch?.[1]) sanitizedText = unusedThoughtMatch[1].trim();
  sanitizedText = sanitizedText.replace(/<unused\d+>/gi, '').trim();

  return sanitizedText || originalText;
}

export function isCloudTextModelId(modelId: string): boolean {
  return (
    modelId in AZURE_OPENAI_MODEL_CONFIGS ||
    modelId in ANTHROPIC_MODEL_CONFIGS ||
    GEMINI_TEXT_MODEL_IDS.has(modelId)
  );
}

// ── StreamController ──────────────────────────────────────────────────────────

export class StreamController {
  private _ctrl!: ReadableStreamDefaultController<Uint8Array>;
  private readonly _enc = new TextEncoder();
  readonly stream: ReadableStream<Uint8Array>;

  constructor() {
    this.stream = new ReadableStream<Uint8Array>({
      start: (ctrl) => {
        this._ctrl = ctrl;
      },
    });
  }

  emit(chunk: StreamChunk): void {
    try {
      this._ctrl.enqueue(this._enc.encode(`data: ${JSON.stringify(chunk)}\n\n`));
      if (chunk.type === 'done' || chunk.type === 'error') {
        this._ctrl.close();
      }
    } catch {
      // Stream already closed
    }
  }
}

// ── OpenAI chat-completions streaming (gpt-5.2) ────────────────────────────

async function* streamOpenAIChatCompletions(
  prompt: string,
  config: AzureOpenAIModelConfig,
  options: ProviderOptions
): AsyncGenerator<string> {
  const client = new AzureOpenAI({
    endpoint: config.endpoint,
    apiKey: requireEnv(config.apiKeyEnvNames),
    apiVersion: config.apiVersion,
  });

  const systemPrompt = buildSystemPrompt(options.systemPrompt);
  const stream = await client.chat.completions.create({
    model: config.deployment,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ],
    max_completion_tokens: resolveResponseTokenLimit(options.responseTokenLimit),
    temperature: resolveTemperature(options.temperature),
    stream: true,
  });

  for await (const chunk of stream) {
    const token = chunk.choices[0]?.delta?.content ?? '';
    if (token) yield token;
  }
}

// ── OpenAI responses API (gpt-5.4, gpt-5.4-pro) – no streaming ────────────

function extractOpenAIResponsesText(response: { output_text?: string; output?: unknown[] }): string {
  if (typeof response.output_text === 'string' && response.output_text.trim()) {
    return response.output_text.trim();
  }
  if (!Array.isArray(response.output)) return '';
  return response.output
    .flatMap((item) => {
      if (typeof item !== 'object' || item === null || !('content' in item) || !Array.isArray(item.content)) return [] as string[];
      return item.content.flatMap((c) => {
        if (typeof c !== 'object' || c === null || !('type' in c) || c.type !== 'output_text' || !('text' in c) || typeof c.text !== 'string') return [] as string[];
        const text = (c.text as string).trim();
        return text ? [text] : [];
      });
    })
    .join('\n\n')
    .trim();
}

async function callOpenAIResponses(
  prompt: string,
  config: AzureOpenAIModelConfig,
  options: ProviderOptions
): Promise<string> {
  const client = new AzureOpenAI({
    endpoint: config.endpoint,
    apiKey: requireEnv(config.apiKeyEnvNames),
    apiVersion: config.apiVersion,
  });

  const systemPrompt = buildSystemPrompt(options.systemPrompt);
  const response = await client.responses.create({
    model: config.deployment,
    instructions: systemPrompt,
    input: prompt,
    max_output_tokens: resolveResponseTokenLimit(options.responseTokenLimit),
  });

  return extractOpenAIResponsesText(response);
}

// ── Gemini streaming ──────────────────────────────────────────────────────────

async function* streamGemini(
  prompt: string,
  modelId: string,
  options: ProviderOptions
): AsyncGenerator<string> {
  const apiKey = requireEnv(['GEMINI_API_KEY']);
  const genAI = new GoogleGenerativeAI(apiKey);
  const systemPrompt = buildSystemPrompt(options.systemPrompt);

  const model = genAI.getGenerativeModel({
    model: modelId,
    systemInstruction: systemPrompt,
    generationConfig: {
      maxOutputTokens: resolveResponseTokenLimit(options.responseTokenLimit),
      temperature: resolveTemperature(options.temperature),
    },
  });

  const result = await model.generateContentStream(prompt);
  for await (const chunk of result.stream) {
    const token = chunk.text();
    if (token) yield token;
  }
}

// ── Anthropic Azure streaming (SSE) ──────────────────────────────────────────

async function* streamAnthropic(
  prompt: string,
  modelId: string,
  options: ProviderOptions
): AsyncGenerator<string> {
  const config = ANTHROPIC_MODEL_CONFIGS[modelId];
  if (!config) throw new Error(`Unsupported Anthropic model: ${modelId}`);

  const baseUrl = ensureTrailingSlash(config.baseUrl);
  const apiKey = requireEnv(config.apiKeyEnvNames);
  const systemPrompt = buildSystemPrompt(options.systemPrompt);

  const response = await fetch(new URL('v1/messages', baseUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.deployment,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: resolveResponseTokenLimit(options.responseTokenLimit),
      temperature: resolveTemperature(options.temperature),
      stream: true,
    }),
  });

  if (!response.ok || !response.body) {
    const errData = await response.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(errData.error?.message || `Anthropic request failed (${response.status})`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (!data || data === '[DONE]') continue;
        try {
          const event = JSON.parse(data) as { type?: string; delta?: { type?: string; text?: string } };
          if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
            const token = event.delta.text ?? '';
            if (token) yield token;
          }
        } catch { /* ignore SSE parse errors */ }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ── Main streaming router ─────────────────────────────────────────────────────

export async function* streamCloudModel(
  prompt: string,
  modelId: string,
  options: ProviderOptions
): AsyncGenerator<string> {
  if (modelId in AZURE_OPENAI_MODEL_CONFIGS) {
    const config = AZURE_OPENAI_MODEL_CONFIGS[modelId];
    if (config.requestMode === 'chat-completions') {
      yield* streamOpenAIChatCompletions(prompt, config, options);
      return;
    }
    // responses API: collect full response, emit as one chunk
    const fullText = await callOpenAIResponses(prompt, config, options);
    if (fullText) yield fullText;
    return;
  }

  if (GEMINI_TEXT_MODEL_IDS.has(modelId)) {
    yield* streamGemini(prompt, modelId, options);
    return;
  }

  if (modelId in ANTHROPIC_MODEL_CONFIGS) {
    yield* streamAnthropic(prompt, modelId, options);
    return;
  }

  throw new Error(`Unsupported cloud model: ${modelId}`);
}

// Convenience: collect full response from streamCloudModel
export async function callCloudModel(
  prompt: string,
  modelId: string,
  options: ProviderOptions
): Promise<string> {
  let fullText = '';
  for await (const token of streamCloudModel(prompt, modelId, options)) {
    fullText += token;
  }
  return fullText;
}

// ── Gemini image generation ───────────────────────────────────────────────────

function extractGeminiImageResponse(data: unknown): { response: string; images: GeneratedImagePayload[] } {
  const candidates =
    typeof data === 'object' && data !== null && 'candidates' in data && Array.isArray((data as Record<string, unknown>).candidates)
      ? (data as Record<string, unknown>).candidates as unknown[]
      : [];

  const parts: unknown[] =
    candidates.length > 0 &&
    typeof candidates[0] === 'object' && candidates[0] !== null &&
    'content' in (candidates[0] as object) &&
    typeof (candidates[0] as Record<string, unknown>).content === 'object' &&
    'parts' in ((candidates[0] as Record<string, unknown>).content as object) &&
    Array.isArray(((candidates[0] as Record<string, unknown>).content as Record<string, unknown>).parts)
      ? (((candidates[0] as Record<string, unknown>).content as Record<string, unknown>).parts as unknown[])
      : [];

  const response = parts
    .filter((p): p is { text: string } => typeof p === 'object' && p !== null && 'text' in p && typeof (p as { text?: unknown }).text === 'string')
    .map((p) => p.text.trim())
    .filter(Boolean)
    .join('\n\n');

  const images = parts
    .map((part) => {
      if (typeof part !== 'object' || part === null) return null;
      const p = part as Record<string, unknown>;
      const inlineData =
        typeof p.inlineData === 'object' && p.inlineData !== null
          ? (p.inlineData as Record<string, unknown>)
          : typeof p.inline_data === 'object' && p.inline_data !== null
          ? (p.inline_data as Record<string, unknown>)
          : null;
      if (!inlineData) return null;
      const mimeType = typeof inlineData.mimeType === 'string' ? inlineData.mimeType : typeof inlineData.mime_type === 'string' ? inlineData.mime_type : null;
      const imageData = typeof inlineData.data === 'string' ? inlineData.data : null;
      if (!mimeType || !imageData) return null;
      return { mimeType, data: imageData };
    })
    .filter((item): item is GeneratedImagePayload => item !== null);

  return { response, images };
}

export async function callGeminiImage(
  prompt: string,
  modelId: string,
  options: ProviderOptions
): Promise<{ response: string; images: GeneratedImagePayload[] }> {
  const apiKey = requireEnv(['GEMINI_API_KEY']);
  const systemPrompt = buildSystemPrompt(options.systemPrompt);

  const response = await fetch(
    `${GEMINI_API_BASE_URL}/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
          temperature: resolveTemperature(options.temperature),
          maxOutputTokens: resolveResponseTokenLimit(options.responseTokenLimit),
          imageConfig: { aspectRatio: '1:1' },
        },
      }),
    }
  );

  const data = await response.json();
  if (!response.ok) {
    throw new Error((data as { error?: { message?: string } }).error?.message || 'Gemini image request failed');
  }

  const parsed = extractGeminiImageResponse(data);
  if (parsed.images.length === 0) throw new Error('Gemini image response did not contain image content');
  return parsed;
}

// ── Local model callers (Ollama / vLLM) ──────────────────────────────────────

export async function callOllama(
  prompt: string,
  apiUrl: string,
  model: string,
  options: ProviderOptions
): Promise<string> {
  const systemPrompt = buildSystemPrompt(options.systemPrompt);
  const response = await fetch(new URL('generate', ensureTrailingSlash(apiUrl)), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      system: systemPrompt,
      stream: false,
      options: {
        num_predict: resolveResponseTokenLimit(options.responseTokenLimit),
        temperature: resolveTemperature(options.temperature),
      },
    }),
  });

  const data = await response.json() as { response?: unknown; error?: string };
  if (!response.ok) throw new Error(data.error || `Ollama request failed (${response.status})`);
  const text = typeof data.response === 'string' ? data.response.trim() : '';
  if (!text) throw new Error('Ollama response did not contain text content');
  return text;
}

export async function callVllm(
  prompt: string,
  apiUrl: string,
  model: string,
  options: ProviderOptions
): Promise<string> {
  const systemPrompt = buildSystemPrompt(options.systemPrompt);
  const response = await fetch(new URL('v1/chat/completions', ensureTrailingSlash(apiUrl)), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      max_tokens: resolveResponseTokenLimit(options.responseTokenLimit),
      temperature: resolveTemperature(options.temperature),
      stream: false,
    }),
  });

  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } | string };
  if (!response.ok) {
    const errMsg = typeof data.error === 'object' ? data.error?.message : data.error;
    throw new Error(errMsg || `vLLM request failed (${response.status})`);
  }
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('vLLM response did not contain text content');
  return text;
}
