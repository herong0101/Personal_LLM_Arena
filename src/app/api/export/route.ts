import { promises as fs } from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { SessionSummary } from '@/types';

function createExportFileName(sessionId: string, exportedAt: number): string {
  const timestamp = new Date(exportedAt).toISOString().replace(/[:.]/g, '-');
  return `arena-session-${timestamp}-${sessionId}.json`;
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as SessionSummary;

    if (!payload?.sessionId) {
      return NextResponse.json({ error: 'Missing sessionId in export payload' }, { status: 400 });
    }

    const exportedAt = Date.now();
    const fileName = createExportFileName(payload.sessionId, exportedAt);
    const outputDirectory = path.join(process.cwd(), 'exports', 'arena-results');
    const filePath = path.join(outputDirectory, fileName);

    await fs.mkdir(outputDirectory, { recursive: true });

    const filePayload: SessionSummary = {
      ...payload,
      exportedAt: new Date(exportedAt).toISOString(),
    };

    await fs.writeFile(filePath, JSON.stringify(filePayload, null, 2), 'utf8');

    return NextResponse.json({
      fileName,
      filePath,
      exportedAt,
      payload: filePayload,
    });
  } catch (error) {
    console.error('Export API Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to export session' },
      { status: 500 }
    );
  }
}