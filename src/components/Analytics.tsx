'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ARENA_MODE_LABELS, AVAILABLE_MODELS } from '@/config/models';
import { useArena } from '@/context/ArenaContext';
import { setStudioHandoff } from '@/lib/handoff';
import {
  buildLeaderboard,
  calculateModelStats,
  createSessionSummary,
  formatLeaderboardPosition,
} from '@/lib/session-summary';
import { SessionSummary, UserFeedback } from '@/types';

// Chat Studio 只接受一般聊天模型；競技場特殊編排模式（專家討論/辯論/壓力測試）不適合直接帶入單模型對話。
function isStudioEligibleModel(modelId: string): boolean {
  const model = AVAILABLE_MODELS.find((item) => item.id === modelId);
  return Boolean(model && !model.isArenaSpecial && model.capabilities?.includes('chat'));
}


function downloadJsonFile(fileName: string, payload: SessionSummary) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function Analytics() {
  const router = useRouter();
  const { state, dispatch, exportSessionData, resetArena, saveFeedback } = useArena();
  const { session, selectedModels } = state;

  const handleUseInStudio = (modelId: string, modelName: string) => {
    setStudioHandoff({ modelId, modelName, source: 'arena' });
    router.push('/studio');
  };

  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [overallComment, setOverallComment] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportResult, setExportResult] = useState<{
    fileName: string;
    filePath: string;
    exportedAt: number;
    payload: SessionSummary;
  } | null>(null);

  useEffect(() => {
    setFeedback(session?.feedback?.comments ?? {});
    setOverallComment(session?.feedback?.overallComment ?? '');
  }, [session]);

  const stats = useMemo(() => calculateModelStats(session), [session]);
  const leaderboard = useMemo(() => buildLeaderboard(stats), [stats]);
  const leaders = useMemo(() => leaderboard.filter((entry) => entry.position === 1), [leaderboard]);

  const previewFeedback = useMemo(() => {
    if (!session) return null;

    const hasFeedback = Object.values(feedback).some((value) => value.trim()) || overallComment.trim();
    if (!hasFeedback) {
      return session.feedback;
    }

    return {
      sessionId: session.id,
      comments: feedback,
      overallComment,
      timestamp: Date.now(),
    };
  }, [feedback, overallComment, session]);

  const summaryPreview = useMemo(() => {
    if (!session) return null;

    return createSessionSummary(
      previewFeedback
        ? {
            ...session,
            feedback: previewFeedback,
          }
        : session
    );
  }, [previewFeedback, session]);

  if (!session) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--background)] px-6 text-center">
        <div className="max-w-md rounded-[1.5rem] bg-white p-7 shadow-sm">
          <h1 className="text-xl font-semibold text-[var(--slate-900)]">目前沒有可顯示的競技場紀錄</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--slate-500)]">先完成至少一局比較，再回來查看統計與下載結果。</p>
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_PHASE', payload: 'landing' })}
            className="mt-5 rounded-full bg-[var(--slate-900)] px-5 py-2.5 text-sm font-semibold text-white"
          >
            返回競技場
          </button>
        </div>
      </div>
    );
  }

  const totalRounds = session.rounds.length;

  const handleSaveFeedback = () => {
    const payload: UserFeedback = {
      sessionId: session.id,
      comments: feedback,
      overallComment,
      timestamp: Date.now(),
    };

    saveFeedback(payload);
    setExportError(null);
  };

  const handleBack = () => {
    handleSaveFeedback();
    dispatch({ type: 'SET_PHASE', payload: 'arena' });
  };

  const handleExport = async () => {
    setIsExporting(true);
    setExportError(null);

    try {
      const feedbackPayload: UserFeedback = {
        sessionId: session.id,
        comments: feedback,
        overallComment,
        timestamp: Date.now(),
      };

      const result = await exportSessionData(feedbackPayload);
      setExportResult(result);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : '匯出失敗');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadJson = async () => {
    if (!summaryPreview) {
      return;
    }

    setIsDownloading(true);

    try {
      handleSaveFeedback();
      const fileName = `arena-session-${session.id}.json`;
      downloadJsonFile(fileName, summaryPreview);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="h-full overflow-auto p-6 sm:p-8">
      <div className="mx-auto max-w-5xl space-y-5">
        {/* Header */}
        <div className="animate-fade-in">
          <button
            onClick={handleBack}
            className="mb-5 flex items-center gap-2 text-sm text-[var(--slate-500)] hover:text-[var(--emerald-700)] transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            返回競技場紀錄
          </button>
          <div className="glass-panel rounded-[2rem] p-6 sm:p-8 text-center">
            <div className="inline-flex items-center rounded-full bg-[rgba(24,172,126,0.12)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--emerald-700)] mb-4">
              {ARENA_MODE_LABELS[session.mode]}
            </div>
            <h1 className="font-serif text-4xl sm:text-5xl font-semibold text-[var(--slate-900)] mb-2">挑戰統計</h1>
            <p className="text-[var(--slate-500)]">
              完成了 <span className="font-semibold text-[var(--slate-700)]">{totalRounds}</span> 局對決
            </p>
          </div>
        </div>

        {/* Winner */}
        {leaders.length > 0 && totalRounds > 0 && (
          <div className="marble-card rounded-[2rem] p-6 sm:p-8 text-center animate-fade-in">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[1.25rem] bg-[rgba(232,179,73,0.14)]">
              <svg className="h-7 w-7 text-[var(--gold-500)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
              </svg>
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--slate-500)] mb-2">
              {leaders.length > 1 ? '並列最佳選擇' : '您的最佳選擇'}
            </p>
            <p className="font-serif text-3xl sm:text-4xl font-semibold text-[var(--gold-500)]">
              {leaders.map((leader) => leader.modelName).join(' / ')}
            </p>
            <p className="mt-3 text-sm text-[var(--slate-500)]">
              {leaders.length > 1 ? '這些模型在平均排名上並列第一。' : '綜合平均排名與表現，這是您的首選模型。'}
            </p>
          </div>
        )}

        {/* Leaderboard */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {leaderboard.map((entry, index) => (
            <div
              key={entry.modelId}
              className="marble-card rounded-[1.75rem] p-6 animate-fade-in"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <div className="mb-5 flex items-start gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl font-serif text-lg font-bold"
                  style={{
                    background: index === 0 ? 'rgba(232,179,73,0.15)' : index === 1 ? 'rgba(139,152,173,0.15)' : 'rgba(200,141,29,0.1)',
                    color: index === 0 ? 'var(--gold-500)' : index === 1 ? 'var(--slate-500)' : 'var(--gold-600)',
                  }}
                >
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-[var(--slate-900)] truncate">{entry.modelName}</h3>
                  <p className="mt-0.5 text-xs text-[var(--slate-500)]">{formatLeaderboardPosition(entry)}</p>
                </div>
              </div>
              <div className="space-y-2.5 border-t border-[var(--border-soft)] pt-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--slate-500)]">平均排名</span>
                  <span className="font-semibold text-[var(--slate-800)]">{entry.averageRank.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--slate-500)]">第一名</span>
                  <span className="font-semibold text-[var(--gold-500)]">{entry.firstPlaceCount} 次</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--slate-500)]">第二名</span>
                  <span className="font-semibold text-[var(--slate-400)]">{entry.secondPlaceCount} 次</span>
                </div>
                {selectedModels.length > 2 && (
                  <div className="flex justify-between">
                    <span className="text-[var(--slate-500)]">第三名</span>
                    <span className="font-semibold text-[var(--gold-600)]">{entry.thirdPlaceCount} 次</span>
                  </div>
                )}
              </div>
              {isStudioEligibleModel(entry.modelId) && (
                <button
                  type="button"
                  onClick={() => handleUseInStudio(entry.modelId, entry.modelName)}
                  className="soft-button mt-4 flex w-full items-center justify-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m9 1.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
                  </svg>
                  用此模型開啟 Chat Studio
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Export */}
        <div className="marble-card rounded-[1.75rem] p-6 animate-fade-in">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h3 className="font-serif text-xl font-semibold text-[var(--slate-800)]">送出與下載</h3>
              <p className="mt-1 text-sm text-[var(--slate-500)]">
                回傳回饋給開發者，或下載本次完整記錄 JSON。
              </p>
            </div>
            {(exportResult || session.lastExport) && (
              <div className="rounded-xl border border-[var(--emerald-200)] bg-[var(--emerald-50)] px-4 py-3 text-sm text-[var(--emerald-800)]">
                已回傳至本機後台
              </div>
            )}
          </div>
        </div>

        {/* Feedback */}
        <div className="marble-card rounded-[1.75rem] p-6 animate-fade-in">
          <h3 className="font-serif text-xl font-semibold text-[var(--slate-800)] mb-6">您的評語</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
            {selectedModels.map((model) => (
              <div key={model.id}>
                <label className="mb-2 block text-sm font-medium text-[var(--slate-700)]">{model.name}</label>
                <textarea
                  value={feedback[model.id] || ''}
                  onChange={(event) => setFeedback({ ...feedback, [model.id]: event.target.value })}
                  placeholder={`對 ${model.name} 的評價...`}
                  rows={3}
                  className="w-full resize-none rounded-[1.25rem] border border-[var(--marble-300)] bg-white/80 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--emerald-400)]"
                />
              </div>
            ))}
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--slate-700)]">整體感想</label>
            <textarea
              value={overallComment}
              onChange={(event) => setOverallComment(event.target.value)}
              placeholder="分享您對這次對戰體驗的整體感想..."
              rows={4}
              className="w-full resize-none rounded-[1.25rem] border border-[var(--marble-300)] bg-white/80 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--emerald-400)]"
            />
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="metal-button rounded-[1.25rem] px-8 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isExporting ? '回傳中...' : '回傳數據與回饋給開發者'}
            </button>
            <button
              onClick={handleDownloadJson}
              disabled={isDownloading}
              className="soft-button rounded-[1.25rem] px-6 py-3 text-sm font-medium"
            >
              {isDownloading ? '準備下載中...' : '下載完整紀錄 JSON'}
            </button>
            <button
              onClick={handleBack}
              className="soft-button rounded-[1.25rem] px-6 py-3 text-sm font-medium"
            >
              返回競技場紀錄
            </button>
          </div>
          {exportError && (
            <div className="mt-4 rounded-[1.25rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {exportError}
            </div>
          )}
          {(exportResult || session.lastExport) && (
            <div className="mt-4 rounded-[1.25rem] border border-[var(--emerald-200)] bg-[var(--emerald-50)] px-4 py-3 text-sm text-[var(--emerald-800)]">
              <p className="font-medium">資料與回饋已回傳到本機後台</p>
              <p className="mt-1 break-all text-xs">{exportResult?.filePath ?? session.lastExport?.filePath}</p>
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="flex flex-col items-center gap-3 pb-4">
          {showResetConfirm ? (
            <div className="marble-card flex w-full max-w-md flex-col items-center gap-3 rounded-[1.5rem] p-6 text-center animate-fade-in">
              <p className="text-sm font-semibold text-[var(--slate-900)]">確定要開始新挑戰嗎？</p>
              <p className="text-xs leading-6 text-[var(--slate-500)]">
                這會清除目前這場的比較紀錄與排名。若還沒保存，請先「下載完整紀錄 JSON」或「回傳給開發者」。
              </p>
              <div className="mt-1 flex gap-3">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="soft-button rounded-[1.25rem] px-6 py-2.5 text-sm font-medium"
                >
                  取消
                </button>
                <button
                  onClick={resetArena}
                  className="metal-button rounded-[1.25rem] px-6 py-2.5 text-sm font-semibold text-white"
                >
                  確認，清除並重新開始
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowResetConfirm(true)}
              className="metal-button rounded-[1.25rem] px-8 py-3 text-sm font-semibold text-white"
            >
              開始新挑戰
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
