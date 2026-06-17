'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ARENA_MODE_LABELS, AVAILABLE_MODELS, STUDIO_MODE_LABELS } from '@/config/models';
import { useArena } from '@/context/ArenaContext';
import { buildLeaderboard, calculateModelStats } from '@/lib/session-summary';
import { deleteSessionFromHistory, loadSessionHistory } from '@/lib/storage';
import {
  loadStudioConversations,
  saveActiveStudioConversationId,
  saveStudioConversations,
} from '@/lib/studio-storage';
import { ArenaSession, StudioConversation } from '@/types';

function formatDate(timestamp: number): string {
  try {
    return new Date(timestamp).toLocaleString('zh-TW', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function arenaLeaderName(session: ArenaSession): string | null {
  if (session.rounds.length === 0) return null;
  const leaderboard = buildLeaderboard(calculateModelStats(session));
  const leaders = leaderboard.filter((entry) => entry.position === 1);
  if (leaders.length === 0) return null;
  return leaders.map((entry) => entry.modelName).join(' / ');
}

function modelName(modelId: string): string {
  return AVAILABLE_MODELS.find((model) => model.id === modelId)?.name ?? modelId;
}

export default function HistoryOverview() {
  const router = useRouter();
  const { dispatch } = useArena();
  const [arenaSessions, setArenaSessions] = useState<ArenaSession[]>([]);
  const [conversations, setConversations] = useState<StudioConversation[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const sessions = loadSessionHistory();
      let studioConversations: StudioConversation[] = [];
      try {
        studioConversations = await loadStudioConversations();
      } catch {
        studioConversations = [];
      }

      if (!active) return;
      // 新到舊
      setArenaSessions([...sessions].sort((a, b) => (b.startTime ?? 0) - (a.startTime ?? 0)));
      setConversations(
        [...studioConversations].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
      );
      setIsHydrated(true);
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  const openArenaSession = (session: ArenaSession) => {
    dispatch({ type: 'LOAD_SESSION', payload: session });
    router.push('/arena');
  };

  const openConversation = async (conversationId: string) => {
    await saveActiveStudioConversationId(conversationId);
    router.push('/studio');
  };

  const deleteArenaSession = (sessionId: string) => {
    if (!window.confirm('確定要刪除這場競技場紀錄嗎？此動作無法復原。')) return;
    deleteSessionFromHistory(sessionId);
    setArenaSessions((current) => current.filter((session) => session.id !== sessionId));
  };

  const deleteConversation = async (conversationId: string) => {
    if (!window.confirm('確定要刪除這個對話嗎？此動作無法復原。')) return;
    const next = conversations.filter((conversation) => conversation.id !== conversationId);
    setConversations(next);
    await saveStudioConversations(next);
  };

  const isEmpty = useMemo(
    () => isHydrated && arenaSessions.length === 0 && conversations.length === 0,
    [isHydrated, arenaSessions.length, conversations.length]
  );

  return (
    <div className="h-full overflow-auto px-6 py-12">
      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--emerald-700)]">
            History
          </p>
          <h1 className="mt-3 font-serif text-4xl font-semibold text-[var(--slate-900)]">歷史總覽</h1>
          <p className="mt-3 text-sm text-[var(--slate-500)]">
            集中查看競技場場次與 Chat Studio 對話，點選即可回到原處繼續。
          </p>
        </div>

        {!isHydrated && (
          <p className="mt-12 text-center text-sm text-[var(--slate-400)]">載入中…</p>
        )}

        {isEmpty && (
          <div className="mt-12 rounded-[1.5rem] border border-[var(--border-soft)] bg-white p-10 text-center">
            <p className="text-sm font-semibold text-[var(--slate-800)]">目前還沒有任何紀錄</p>
            <p className="mt-2 text-sm text-[var(--slate-500)]">
              完成一場競技場比較，或在 Chat Studio 開始對話後，就會出現在這裡。
            </p>
          </div>
        )}

        {isHydrated && arenaSessions.length > 0 && (
          <section className="mt-10">
            <div className="mb-4 flex items-center gap-2">
              <span className="h-1.5 w-8 rounded-full bg-[var(--emerald-500)]" />
              <h2 className="font-serif text-2xl font-semibold text-[var(--slate-900)]">競技場場次</h2>
              <span className="text-sm text-[var(--slate-400)]">{arenaSessions.length}</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {arenaSessions.map((session) => {
                const leader = arenaLeaderName(session);
                return (
                  <div
                    key={session.id}
                    className="marble-card relative flex flex-col rounded-[1.25rem] transition-all duration-200 hover:-translate-y-0.5"
                  >
                    <button
                      type="button"
                      onClick={() => openArenaSession(session)}
                      className="flex flex-col rounded-[1.25rem] p-5 pr-12 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-[rgba(24,172,126,0.1)] px-2.5 py-0.5 text-xs font-semibold text-[var(--emerald-700)]">
                          {ARENA_MODE_LABELS[session.mode]}
                        </span>
                        <span className="text-xs text-[var(--slate-400)]">{formatDate(session.startTime)}</span>
                      </div>
                      <p className="mt-3 text-sm text-[var(--slate-600)]">
                        {session.rounds.length} 局 · {session.selectedModels.length} 個模型
                      </p>
                      {leader && (
                        <p className="mt-1 text-sm font-semibold text-[var(--slate-900)]">冠軍：{leader}</p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {session.selectedModels.map((model) => (
                          <span
                            key={model.id}
                            className="rounded-full border border-[var(--border-soft)] bg-white/60 px-2 py-0.5 text-xs text-[var(--slate-500)]"
                          >
                            {model.name}
                          </span>
                        ))}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteArenaSession(session.id)}
                      aria-label="刪除這場紀錄"
                      title="刪除"
                      className="absolute right-2.5 top-2.5 rounded-full p-2 text-[var(--slate-400)] transition-colors hover:bg-[var(--rose-100)] hover:text-[var(--rose-500)]"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M9 7V5h6v2m-7 0v12a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V7M10 11v6M14 11v6" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {isHydrated && conversations.length > 0 && (
          <section className="mt-10">
            <div className="mb-4 flex items-center gap-2">
              <span className="h-1.5 w-8 rounded-full bg-[var(--gold-500)]" />
              <h2 className="font-serif text-2xl font-semibold text-[var(--slate-900)]">Chat Studio 對話</h2>
              <span className="text-sm text-[var(--slate-400)]">{conversations.length}</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className="marble-card relative flex flex-col rounded-[1.25rem] transition-all duration-200 hover:-translate-y-0.5"
                >
                  <button
                    type="button"
                    onClick={() => void openConversation(conversation.id)}
                    className="flex flex-col rounded-[1.25rem] p-5 pr-12 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-[rgba(232,179,73,0.14)] px-2.5 py-0.5 text-xs font-semibold text-[var(--gold-600)]">
                        {STUDIO_MODE_LABELS[conversation.settings.mode]}
                      </span>
                      <span className="text-xs text-[var(--slate-400)]">{formatDate(conversation.updatedAt)}</span>
                    </div>
                    <p className="mt-3 truncate text-sm font-semibold text-[var(--slate-900)]">
                      {conversation.title}
                    </p>
                    <p className="mt-1 text-sm text-[var(--slate-500)]">
                      {conversation.messages.length} 則訊息 · {modelName(conversation.settings.activeModelId)}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteConversation(conversation.id)}
                    aria-label="刪除這個對話"
                    title="刪除"
                    className="absolute right-2.5 top-2.5 rounded-full p-2 text-[var(--slate-400)] transition-colors hover:bg-[var(--rose-100)] hover:text-[var(--rose-500)]"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M9 7V5h6v2m-7 0v12a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V7M10 11v6M14 11v6" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
