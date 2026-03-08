'use client';

import { useEffect, useMemo, useState } from 'react';
import { ARENA_MODE_LABELS } from '@/config/models';
import { useArena } from '@/context/ArenaContext';
import {
  buildLeaderboard,
  calculateModelStats,
  createSessionSummary,
  formatLeaderboardPosition,
} from '@/lib/session-summary';
import { SessionSummary, UserFeedback } from '@/types';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

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
  const { state, dispatch, exportSessionData, resetArena, saveFeedback } = useArena();
  const { session, selectedModels } = state;

  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [overallComment, setOverallComment] = useState('');
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
    return null;
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
    <div className="min-h-screen bg-[var(--background)] p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12 animate-fade-in">
          <button
            onClick={handleBack}
            className="absolute top-8 left-8 flex items-center gap-2 text-[var(--slate-600)] hover:text-[var(--emerald-600)] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            返回競技場紀錄
          </button>
          <h1 className="font-serif text-4xl md:text-5xl font-bold stone-text mb-4">挑戰統計</h1>
          <div className="inline-flex items-center rounded-full bg-[var(--emerald-50)] px-4 py-2 text-sm font-medium text-[var(--emerald-700)] mb-4">
            {ARENA_MODE_LABELS[session.mode]}
          </div>
          <p className="text-[var(--slate-600)] text-lg">完成了 {totalRounds} 局對決</p>
        </div>

        {leaders.length > 0 && totalRounds > 0 && (
          <div className="marble-card rounded-2xl p-8 mb-8 text-center animate-fade-in">
            <div className="text-6xl mb-4">🏆</div>
            <h2 className="font-serif text-2xl font-semibold text-[var(--slate-800)] mb-2">
              {leaders.length > 1 ? '並列最佳選擇' : '您的最佳選擇'}
            </h2>
            <p className="text-4xl font-bold gold-text mb-2">{leaders.map((leader) => leader.modelName).join(' / ')}</p>
            <p className="text-[var(--slate-600)]">
              {leaders.length > 1 ? '這些模型在平均排名上並列第一。' : '綜合平均排名與表現，這是您的首選模型。'}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {leaderboard.map((entry, index) => (
            <div
              key={entry.modelId}
              className="marble-card rounded-xl p-6 animate-fade-in"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-lg text-[var(--slate-800)]">{entry.modelName}</h3>
                  <p className="text-xs text-[var(--slate-500)] mt-1">{formatLeaderboardPosition(entry)}</p>
                </div>
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-[var(--slate-500)]">平均排名</span>
                  <span className="font-semibold text-[var(--slate-800)]">{entry.averageRank.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--slate-500)]">🥇 第一名</span>
                  <span className="font-semibold text-[var(--gold-500)]">{entry.firstPlaceCount} 次</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--slate-500)]">🥈 第二名</span>
                  <span className="font-semibold text-[var(--slate-500)]">{entry.secondPlaceCount} 次</span>
                </div>
                {selectedModels.length > 2 && (
                  <div className="flex justify-between">
                    <span className="text-[var(--slate-500)]">🥉 第三名</span>
                    <span className="font-semibold text-[var(--gold-600)]">{entry.thirdPlaceCount} 次</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="marble-card rounded-xl p-6 mb-8 animate-fade-in">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h3 className="font-serif text-xl font-semibold text-[var(--slate-800)]">送出與下載</h3>
              <p className="text-sm text-[var(--slate-500)] mt-1">
                您可以回傳回饋給開發者，也可以選擇只下載本次競技場完整記錄 JSON。
              </p>
            </div>
            {(exportResult || session.lastExport) && (
              <div className="rounded-lg border border-[var(--emerald-200)] bg-[var(--emerald-50)] px-4 py-3 text-sm text-[var(--emerald-800)]">
                已回傳至本機後台
              </div>
            )}
          </div>
        </div>

        <div className="marble-card rounded-xl p-6 mb-8 animate-fade-in">
          <h3 className="font-serif text-xl font-semibold text-[var(--slate-800)] mb-6">您的評語</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {selectedModels.map((model) => (
              <div key={model.id}>
                <label className="block text-sm font-medium text-[var(--slate-700)] mb-2">{model.name}</label>
                <textarea
                  value={feedback[model.id] || ''}
                  onChange={(event) => setFeedback({ ...feedback, [model.id]: event.target.value })}
                  placeholder={`對 ${model.name} 的評價...`}
                  rows={3}
                  className="w-full px-4 py-2 rounded-lg border border-[var(--marble-300)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--emerald-400)] resize-none"
                />
              </div>
            ))}
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--slate-700)] mb-2">整體感想</label>
            <textarea
              value={overallComment}
              onChange={(event) => setOverallComment(event.target.value)}
              placeholder="分享您對這次對戰體驗的整體感想..."
              rows={4}
              className="w-full px-4 py-2 rounded-lg border border-[var(--marble-300)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--emerald-400)] resize-none"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-6">
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="metal-button text-white font-serif px-8 py-3 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isExporting ? '回傳中...' : '回傳數據與回饋給開發者'}
            </button>
            <button
              onClick={handleDownloadJson}
              disabled={isDownloading}
              className="px-6 py-3 rounded-lg border border-[var(--marble-300)] text-[var(--slate-700)] hover:border-[var(--emerald-400)] hover:text-[var(--emerald-700)] transition-colors"
            >
              {isDownloading ? '準備下載中...' : '下載本次完整紀錄 JSON'}
            </button>
            <button
              onClick={handleBack}
              className="px-6 py-3 rounded-lg border border-[var(--marble-300)] text-[var(--slate-700)] hover:border-[var(--emerald-400)] hover:text-[var(--emerald-700)] transition-colors"
            >
              先不送出，返回競技場紀錄
            </button>
          </div>

          {exportError && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{exportError}</div>
          )}

          {(exportResult || session.lastExport) && (
            <div className="mt-4 rounded-lg border border-[var(--emerald-200)] bg-[var(--emerald-50)] px-4 py-3 text-sm text-[var(--emerald-800)]">
              <p className="font-medium">資料與回饋已回傳到本機後台</p>
              <p className="break-all mt-1">{exportResult?.filePath ?? session.lastExport?.filePath}</p>
            </div>
          )}
        </div>

        <div className="flex justify-center gap-4">
          <button onClick={resetArena} className="metal-button text-white font-serif px-8 py-3 rounded-lg">
            開始新挑戰
          </button>
        </div>
      </div>
    </div>
  );
}
