import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AzureOpenAI } from 'openai';

const DEFAULT_AZURE_OPENAI_ENDPOINT = 'https://9n00400.openai.azure.com/';
const DEFAULT_AZURE_OPENAI_DEPLOYMENT = 'gpt-5.2';
const DEFAULT_AZURE_OPENAI_API_VERSION = '2024-12-01-preview';

const DEFAULT_ANTHROPIC_BASE_URL =
  'https://project3-docai-resource.services.ai.azure.com/anthropic/';
const DEFAULT_ANTHROPIC_DEPLOYMENT = 'claude-opus-4-5';
const LOCAL_OLLAMA_4090_API_URL = 'http://10.61.16.31:11434/api';
const LOCAL_OLLAMA_5090_API_URL = 'http://10.61.16.119:11434/api';
const LOCAL_VLLM_4090_API_URL = 'http://10.61.16.101:8000';

const ARENA_SYSTEM_PROMPT =
  '請一律使用繁體中文回答。不要輸出表格、Markdown 語法或簡體中文，並讓內容盡量精簡。';

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

async function handleOpenAI(prompt: string): Promise<string> {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT || DEFAULT_AZURE_OPENAI_ENDPOINT;
  const apiKey = requireEnv(['AZURE_OPENAI_API_KEY', '5.2_AZURE_OPENAI_API_KEY']);
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || DEFAULT_AZURE_OPENAI_API_VERSION;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || DEFAULT_AZURE_OPENAI_DEPLOYMENT;

  const client = new AzureOpenAI({
    endpoint,
    apiKey,
    apiVersion,
  });

  const response = await client.chat.completions.create({
    model: deployment,
    messages: [
      {
        role: 'system',
        content: ARENA_SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    max_completion_tokens: 16384,
  });

  return response.choices[0]?.message?.content ?? '';
}

async function handleGemini(prompt: string, modelId: string): Promise<string> {
  const apiKey = requireEnv(['GEMINI_API_KEY']);
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelId,
    systemInstruction: ARENA_SYSTEM_PROMPT,
  });

  const result = await model.generateContent(prompt);
  return result.response.text();
}

async function handleAnthropic(prompt: string): Promise<string> {
  const baseUrl = ensureTrailingSlash(
    process.env.AZURE_ANTHROPIC_BASE_URL ||
      process.env.ANTHROPIC_FOUNDRY_BASE_URL ||
      DEFAULT_ANTHROPIC_BASE_URL
  );
  const apiKey = requireEnv(['AZURE_ANTHROPIC_API_KEY', 'ANTHROPIC_FOUNDRY_API_KEY']);
  const deployment = process.env.AZURE_ANTHROPIC_DEPLOYMENT || DEFAULT_ANTHROPIC_DEPLOYMENT;

  const response = await fetch(new URL('v1/messages', baseUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: deployment,
      system: ARENA_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1024,
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

async function handleLocalOllama(prompt: string, config: Extract<LocalRuntimeConfig, { kind: 'ollama' }>): Promise<string> {
  const response = await fetch(new URL('generate', ensureTrailingSlash(config.apiUrl)), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      prompt,
      system: ARENA_SYSTEM_PROMPT,
      stream: false,
      options: {
        num_predict: 512,
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

async function handleLocalVllm(prompt: string, config: Extract<LocalRuntimeConfig, { kind: 'vllm' }>): Promise<string> {
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
          content: ARENA_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 512,
      temperature: 0.3,
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

async function handleLocalModel(prompt: string, modelId: string): Promise<string> {
  const config = LOCAL_MODEL_CONFIGS[modelId];

  if (!config) {
    throw new Error(`Unsupported local model: ${modelId}`);
  }

  if (config.kind === 'ollama') {
    return handleLocalOllama(prompt, config);
  }

  return handleLocalVllm(prompt, config);
}

export async function POST(request: NextRequest) {
  try {
    const { modelId, prompt } = (await request.json()) as { modelId?: string; prompt?: string };

    if (!prompt || !modelId) {
      return NextResponse.json(
        { error: 'Missing required fields: modelId and prompt' },
        { status: 400 }
      );
    }

    let response: string;

    switch (modelId) {
      case 'gpt-5.2':
        response = await handleOpenAI(prompt);
        break;
      case 'gemini-2.5-pro':
      case 'gemini-2.5-flash':
      case 'gemini-3-flash-preview':
      case 'gemini-3-pro-preview':
      case 'gemini-3.1-pro-preview':
      case 'gemini-3.1-flash-lite-preview':
        response = await handleGemini(prompt, modelId);
        break;
      case 'claude-opus-4-5':
        response = await handleAnthropic(prompt);
        break;
      default:
        if (modelId in LOCAL_MODEL_CONFIGS) {
          response = await handleLocalModel(prompt, modelId);
          break;
        }

        return NextResponse.json({ error: `Unsupported model: ${modelId}` }, { status: 400 });
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

