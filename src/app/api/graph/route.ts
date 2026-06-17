import { NextRequest, NextResponse } from 'next/server';
import type { NoCodeGraphDefinition } from '@/types';
import { runNoCodeGraph } from '@/lib/graphs/no-code-runner';

export async function POST(request: NextRequest) {
  try {
    const { definition, input } = (await request.json()) as {
      definition?: NoCodeGraphDefinition;
      input?: string;
    };

    if (!definition || !input?.trim()) {
      return NextResponse.json(
        { error: 'Missing required fields: definition and input' },
        { status: 400 }
      );
    }

    const results = await runNoCodeGraph(definition, input.trim());
    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to run graph' },
      { status: 500 }
    );
  }
}
