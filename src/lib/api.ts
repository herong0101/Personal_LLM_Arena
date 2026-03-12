/**
 * Browser-side wrapper for server API calls.
 */

import { ArenaOrchestrationConfig } from '@/types';

export interface CallModelOptions {
  systemPrompt?: string;
  responseTokenLimit?: number;
  temperature?: number;
  orchestration?: ArenaOrchestrationConfig;
}

export interface GeneratedImagePayload {
  mimeType: string;
  data: string;
}

interface ChatApiResponse {
  response?: string;
  images?: GeneratedImagePayload[];
  error?: string;
}

async function requestModel(
  modelId: string,
  prompt: string,
  options: CallModelOptions = {}
): Promise<ChatApiResponse> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      modelId,
      prompt,
      systemPrompt: options.systemPrompt,
      responseTokenLimit: options.responseTokenLimit,
      temperature: options.temperature,
      orchestration: options.orchestration,
    }),
  });

  const data = (await response.json()) as ChatApiResponse;

  if (!response.ok) {
    throw new Error(data.error || 'API request failed');
  }

  return data;
}

export async function callModel(
  modelId: string,
  prompt: string,
  options: CallModelOptions = {}
): Promise<string> {
  const data = await requestModel(modelId, prompt, options);
  return data.response ?? '';
}

export async function callImageModel(
  modelId: string,
  prompt: string,
  options: CallModelOptions = {}
): Promise<{ response: string; images: GeneratedImagePayload[] }> {
  const data = await requestModel(modelId, prompt, options);

  return {
    response: data.response ?? '',
    images: data.images ?? [],
  };
}

export async function callMultipleModels(
  modelIds: string[],
  prompt: string
): Promise<Map<string, string>> {
  const results = new Map<string, string>();

  const responses = await Promise.all(
    modelIds.map(async (modelId) => ({
      modelId,
      response: await callModel(modelId, prompt),
    }))
  );

  responses.forEach(({ modelId, response }) => {
    results.set(modelId, response);
  });

  return results;
}
