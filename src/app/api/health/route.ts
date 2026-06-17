import { NextResponse } from 'next/server';
import { LOCAL_SERVERS } from '@/lib/local-endpoints';

export const dynamic = 'force-dynamic';

const PROBE_TIMEOUT_MS = 2500;

interface ServerHealth {
  label: string;
  online: boolean;
}

// 探測 Ollama 端點：/api/tags 會列出已載入模型，是輕量且可靠的健康訊號。
async function probeServer(label: string, apiUrl: string): Promise<ServerHealth> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

  try {
    const response = await fetch(`${apiUrl.replace(/\/$/, '')}/tags`, {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store',
    });
    return { label, online: response.ok };
  } catch {
    return { label, online: false };
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET() {
  const servers = await Promise.all(
    LOCAL_SERVERS.map((server) => probeServer(server.label, server.apiUrl))
  );

  return NextResponse.json(
    { servers, checkedAt: Date.now() },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
