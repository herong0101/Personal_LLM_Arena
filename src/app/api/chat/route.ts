import { NextRequest, NextResponse } from 'next/server';
import type { ArenaOrchestrationConfig } from '@/types';
import { StreamController, type ProviderOptions } from '@/lib/cloud-providers';
import { runChatGraph } from '@/lib/graphs/chat-router';

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

    const options: ProviderOptions = { systemPrompt, responseTokenLimit, temperature };
    const streamController = new StreamController();

    runChatGraph({ modelId, prompt, orchestration, options }, streamController).catch((error) => {
      console.error('Chat graph error:', error);
    });

    return new NextResponse(streamController.stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
