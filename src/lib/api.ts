/**
 * Browser-side API wrapper for /api/chat endpoint.
 * Supports both streaming (callModelStream) and non-streaming (callModel) usage.
 */

import type { ArenaOrchestrationConfig, StreamChunk } from '@/types';

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

export interface StreamCallbacks {
  onToken?: (token: string) => void;
  onStage?: (name: string, label: string) => void;
}

// ── Streaming call ────────────────────────────────────────────────────────────

export async function callModelStream(
  modelId: string,
  prompt: string,
  options: CallModelOptions = {},
  callbacks: StreamCallbacks = {}
): Promise<string> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      modelId,
      prompt,
      systemPrompt: options.systemPrompt,
      responseTokenLimit: options.responseTokenLimit,
      temperature: options.temperature,
      orchestration: options.orchestration,
    }),
  });

  if (!response.ok || !response.body) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || 'API request failed');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalResponse = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';

      for (const part of parts) {
        if (!part.startsWith('data: ')) continue;
        const raw = part.slice(6).trim();
        if (!raw) continue;
        try {
          const chunk = JSON.parse(raw) as StreamChunk;
          if (chunk.type === 'token') {
            callbacks.onToken?.(chunk.content);
            finalResponse += chunk.content;
          } else if (chunk.type === 'stage') {
            callbacks.onStage?.(chunk.name, chunk.label);
          } else if (chunk.type === 'done') {
            finalResponse = chunk.response;
          } else if (chunk.type === 'error') {
            throw new Error(chunk.message);
          }
        } catch (e) {
          if (e instanceof SyntaxError) continue;
          throw e;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return finalResponse;
}

// ── Non-streaming convenience wrappers ────────────────────────────────────────

export async function callModel(
  modelId: string,
  prompt: string,
  options: CallModelOptions = {}
): Promise<string> {
  return callModelStream(modelId, prompt, options, {});
}

export async function callImageModel(
  modelId: string,
  prompt: string,
  options: CallModelOptions = {}
): Promise<{ response: string; images: GeneratedImagePayload[] }> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      modelId,
      prompt,
      systemPrompt: options.systemPrompt,
      responseTokenLimit: options.responseTokenLimit,
      temperature: options.temperature,
    }),
  });

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';
  let result: { response: string; images: GeneratedImagePayload[] } = { response: '', images: [] };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';

      for (const part of parts) {
        if (!part.startsWith('data: ')) continue;
        try {
          const chunk = JSON.parse(part.slice(6)) as StreamChunk;
          if (chunk.type === 'done') {
            result = { response: chunk.response, images: (chunk.images as GeneratedImagePayload[]) ?? [] };
          } else if (chunk.type === 'error') {
            throw new Error(chunk.message);
          }
        } catch (e) {
          if (e instanceof SyntaxError) continue;
          throw e;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return result;
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
  responses.forEach(({ modelId, response }) => results.set(modelId, response));
  return results;
}
