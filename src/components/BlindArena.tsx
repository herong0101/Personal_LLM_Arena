'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ARENA_CONFIG, ARENA_MODE_LABELS } from '@/config/models';
import { useArena } from '@/context/ArenaContext';
import { ArenaMode, MatchRound, RankingResult, UserFeedback } from '@/types';
import Sidebar from './Sidebar';
import RankingPanel from './RankingPanel';
import PromptComposer from './PromptComposer';

const SAMPLE_PROMPTS = [
  '請用白話文解釋醫療險、重大疾病險與實支實付的差異，並說明各自適合哪些族群。',
  '如果 30 歲上班族想規劃基本保險保障，請提供壽險、醫療險與意外險的投保思路與注意事項。',
  '請整理維持心血管健康的 7 個日常習慣，並說明每一項背後的原因。',
  '假設家中長輩剛被診斷糖尿病前期，請提供飲食、運動與定期追蹤的健康管理建議。',
];

export default function BlindArena() {
  const {
    state,
    dispatch,
    submitPrompt,
    submitRanking,
    revealModels,
    nextRound,
    endSession,
    canStartNewRound,
    getRoundCount,
    saveFeedback,
  } = useArena();

  const [prompt, setPrompt] = useState('');
  const [showRanking, setShowRanking] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);
  const [feedbackDraft, setFeedbackDraft] = useState<Record<string, string>>({});
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const { arenaMode, currentResponses, isLoading, loadingProgress, selectedModels, session } = state;
  const isBlindMode = arenaMode === 'blind';
  const isCompletedSession = session?.completed ?? false;

  const allResponsesLoaded =
    currentResponses.length > 0 && currentResponses.every((response) => !response.isLoading);

  const currentRound = session?.rounds[session.rounds.length - 1];
  const isCurrentRoundRevealed = currentRound?.revealed || false;
  const latestRoundId = session?.rounds.at(-1)?.id ?? null;
  const selectedRound = session?.rounds.find((round) => round.id === selectedRoundId) ?? null;
  const shouldShowHistoryRound = Boolean(selectedRound);
  const displayedRound: MatchRound | null = shouldShowHistoryRound ? selectedRound : currentRound ?? null;
  const displayedResponses = shouldShowHistoryRound ? selectedRound?.responses ?? [] : currentResponses;
  const displayedPrompt = shouldShowHistoryRound ? selectedRound?.prompt ?? '' : currentPrompt;
  const displayedIsRevealed = shouldShowHistoryRound ? selectedRound?.revealed ?? false : isRevealed;
  const displayedRankings = displayedRound?.rankings ?? [];
  const displayedRoundIndex = displayedRound
    ? session?.rounds.findIndex((round) => round.id === displayedRound.id) ?? -1
    : -1;

  useEffect(() => {
    if (allResponsesLoaded && !showRanking && currentResponses.length > 0) {
      setShowRanking(true);
    }
  }, [allResponsesLoaded, currentResponses.length, showRanking]);

  useEffect(() => {
    setIsRevealed(isCurrentRoundRevealed);
  }, [isCurrentRoundRevealed]);

  useEffect(() => {
    if (!latestRoundId) {
      setSelectedRoundId(null);
    }
  }, [latestRoundId]);

  useEffect(() => {
    setFeedbackDraft(session?.feedback?.comments ?? {});
  }, [session?.feedback, session?.id]);

  const handleSubmitPrompt = async () => {
    if (!prompt.trim() || isLoading) return;

    const nextPrompt = prompt.trim();
    setSelectedRoundId(null);
    setCurrentPrompt(nextPrompt);
    setShowRanking(false);
    setIsRevealed(false);
    await submitPrompt(nextPrompt);
    setPrompt('');
  };

  const handleSamplePrompt = async (samplePrompt: string) => {
    if (isLoading) return;

    setPrompt(samplePrompt);
    setSelectedRoundId(null);
    setCurrentPrompt(samplePrompt);
    setShowRanking(false);
    setIsRevealed(false);
    await submitPrompt(samplePrompt);
    setPrompt('');
  };

  const handleRankingSubmit = (rankings: RankingResult[]) => {
    submitRanking(rankings, currentPrompt);
    revealModels();
    setIsRevealed(true);
  };

  const handleNextRound = () => {
    nextRound();
    setShowRanking(false);
    setIsRevealed(false);
    setCurrentPrompt('');
    setSelectedRoundId(null);
  };

  const handleBack = () => {
    dispatch({ type: 'SET_PHASE', payload: isCompletedSession ? 'analytics' : 'selection' });
  };

  const handleReturnToCurrentRound = () => {
    setSelectedRoundId(null);
  };

  const handleFeedbackChange = (modelId: string, value: string) => {
    const nextDraft = {
      ...feedbackDraft,
      [modelId]: value,
    };

    setFeedbackDraft(nextDraft);

    if (!session) {
      return;
    }

    const existingFeedback = session.feedback;
    const payload: UserFeedback = {
      sessionId: session.id,
      comments: nextDraft,
      overallComment: existingFeedback?.overallComment ?? '',
      timestamp: existingFeedback?.timestamp ?? 0,
    };

    saveFeedback(payload);
  };

  const roundCount = getRoundCount();
  const isMaxRounds = roundCount >= ARENA_CONFIG.maxRoundsPerSession;
  const rankingPanelKey = currentResponses.map((response) => response.modelId).join('|');
  const revealMappings = displayedResponses.map((response) => ({
    blindName: response.blindName,
    modelName: selectedModels.find((model) => model.id === response.modelId)?.name ?? response.modelId,
  }));
  const inputLocked = isLoading || (showRanking && !isRevealed);
  const historyDrawer =
    isHistoryOpen && typeof document !== 'undefined'
      ? createPortal(
          <>
            <button
              type="button"
              aria-label="關閉對戰紀錄"
              onClick={() => setIsHistoryOpen(false)}
              className="fixed inset-0 bg-[rgba(17,24,39,0.28)] backdrop-blur-[2px]"
              style={{ zIndex: 80 }}
            />
            <Sidebar
              selectedRoundId={selectedRoundId}
              onSelectRound={setSelectedRoundId}
              isMobileOpen
              onCloseMobile={() => setIsHistoryOpen(false)}
            />
          </>,
          document.body
        )
      : null;

  return (
    <div className="page-shell h-full bg-white">
      {historyDrawer}

      <div className="relative flex h-full">
        <main className="flex h-full flex-1 flex-col">
          <header className="border-b border-[var(--border-soft)] bg-white px-4 py-3 sm:px-6">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <button
                  type="button"
                  onClick={handleBack}
                  aria-label="返回模型選擇"
                  className="rounded-full p-2 text-[var(--slate-500)] hover:bg-[var(--surface-muted)] hover:text-[var(--slate-900)]"
                  title="返回"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-[var(--slate-900)]">
                    {isBlindMode ? '盲測競技場' : '公開競技場'}
                  </div>
                  <div className="truncate text-xs text-[var(--slate-500)]">
                    {selectedModels.map((model) => model.name).join(' · ')}
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span className="hidden text-xs text-[var(--slate-500)] sm:inline">
                  {ARENA_MODE_LABELS[arenaMode]} · {roundCount}/{ARENA_CONFIG.maxRoundsPerSession}
                </span>
                <button
                  type="button"
                  onClick={() => setIsHistoryOpen(true)}
                  className="rounded-full px-3 py-2 text-sm text-[var(--slate-600)] hover:bg-[var(--surface-muted)]"
                >
                  紀錄
                </button>
                {isCompletedSession ? (
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'SET_PHASE', payload: 'analytics' })}
                    className="rounded-full px-3 py-2 text-sm text-[var(--slate-600)] hover:bg-[var(--surface-muted)]"
                  >
                    統計
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={endSession}
                    className="rounded-full px-3 py-2 text-sm text-[var(--slate-500)] hover:bg-[var(--surface-muted)] hover:text-[var(--rose-500)]"
                  >
                    結束
                  </button>
                )}
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
            {displayedResponses.length === 0 && !isLoading ? (
              <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-center py-10 text-center">
                  <h2 className="text-3xl font-semibold tracking-[-0.02em] text-[var(--slate-900)]">想比較什麼？</h2>
                  <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[var(--slate-500)]">
                    輸入同一個問題，系統會把它送到已選模型。
                  </p>

                  <div className="mt-8 grid gap-2 text-left sm:grid-cols-2">
                    {SAMPLE_PROMPTS.map((samplePrompt) => (
                      <button
                        key={samplePrompt}
                        type="button"
                        onClick={() => void handleSamplePrompt(samplePrompt)}
                        disabled={isLoading}
                        className="rounded-2xl px-4 py-3 text-sm leading-6 text-[var(--slate-600)] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {samplePrompt}
                      </button>
                    ))}
                  </div>
              </div>
            ) : (
              <div className="mx-auto max-w-7xl space-y-5">
                {displayedPrompt && (
                  <div className="border-b border-[var(--border-soft)] pb-4">
                    <div className="mb-2.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--emerald-700)]">
                        {isCompletedSession ? '回合提問紀錄' : '本局題目'}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-[var(--slate-500)]">
                        {shouldShowHistoryRound && !isCompletedSession && (
                          <button
                            type="button"
                            onClick={handleReturnToCurrentRound}
                            className="font-medium text-[var(--emerald-700)] hover:text-[var(--emerald-500)]"
                          >
                            回到目前局數
                          </button>
                        )}
                        {displayedRound && displayedRoundIndex >= 0 && <div>第 {displayedRoundIndex + 1} 局</div>}
                      </div>
                    </div>
                    <p className="text-base leading-7 text-[var(--slate-700)]">{displayedPrompt}</p>
                  </div>
                )}

                {shouldShowHistoryRound && !isCompletedSession && (
                  <div className="bg-[var(--amber-50)] px-4 py-3 text-sm text-[var(--amber-900)]">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <span>目前正在查看歷史回合。回到目前局數後，才可繼續排名、開始下一局或輸入新問題。</span>
                      <button
                        type="button"
                        onClick={handleReturnToCurrentRound}
                    className="rounded-full px-3 py-2 text-xs font-medium text-[var(--amber-900)] hover:bg-white/70"
                      >
                        返回目前局數
                      </button>
                    </div>
                  </div>
                )}

                {isLoading && loadingProgress && !shouldShowHistoryRound && (
                  <div className="rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-3 animate-fade-in">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex items-center gap-2 font-medium text-[var(--slate-700)]">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--emerald-500)]" />
                        正在取得各模型回應…
                      </span>
                      <span className="text-xs font-semibold text-[var(--slate-500)]">
                        已完成 {loadingProgress.done}/{loadingProgress.total}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                      <div
                        className="h-full rounded-full bg-[var(--emerald-500)] transition-all duration-300"
                        style={{
                          width: `${loadingProgress.total > 0 ? (loadingProgress.done / loadingProgress.total) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                <div
                  className={`grid gap-4 ${
                    selectedModels.length === 1
                      ? 'grid-cols-1'
                      : selectedModels.length === 2
                      ? 'grid-cols-1 xl:grid-cols-2'
                      : 'grid-cols-1 xl:grid-cols-3'
                  }`}
                >
                  {displayedResponses.map((response, index) => (
                    <ResponseCard
                      key={response.modelId}
                      response={response}
                      mode={arenaMode}
                      isRevealed={displayedIsRevealed}
                      modelName={selectedModels.find((model) => model.id === response.modelId)?.name || ''}
                      rank={displayedRankings.find((ranking) => ranking.modelId === response.modelId)?.rank}
                      index={index}
                    />
                  ))}
                </div>

                {!isCompletedSession && !shouldShowHistoryRound && showRanking && allResponsesLoaded && !isRevealed && (
                  <div className="animate-fade-in">
                    <RankingPanel
                      key={rankingPanelKey}
                      responses={currentResponses}
                      models={selectedModels}
                      mode={arenaMode}
                      onSubmit={handleRankingSubmit}
                    />
                  </div>
                )}

                {isBlindMode && displayedIsRevealed && (
                  <div className="border-t border-[var(--border-soft)] pt-6 animate-fade-in">
                    <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <h3 className="font-serif text-2xl font-semibold text-[var(--slate-900)]">揭曉模型與即時回饋</h3>
                        <p className="mt-2 text-sm leading-7 text-[var(--slate-500)]">
                          這些筆記會先暫存在本地，最後由你決定是否一併送出給開發者。
                        </p>
                      </div>
                      {isCompletedSession && (
                        <button
                          type="button"
                          onClick={() => dispatch({ type: 'SET_PHASE', payload: 'analytics' })}
                          className="rounded-full bg-[var(--surface-muted)] px-4 py-2 text-sm font-medium text-[var(--slate-700)] hover:text-[var(--slate-900)]"
                        >
                          前往送出頁
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                      {selectedModels.map((model) => (
                        <div key={model.id} className="bg-[var(--background)] p-4">
                          <div className="mb-2 font-semibold text-[var(--slate-900)]">{model.name}</div>
                          <textarea
                            value={feedbackDraft[model.id] || ''}
                            onChange={(event) => handleFeedbackChange(model.id, event.target.value)}
                            placeholder={`記錄對 ${model.name} 的觀察...`}
                            rows={4}
                            className="min-h-28 w-full resize-none rounded-xl border border-transparent bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--emerald-400)]"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="mt-5 bg-[rgba(24,172,126,0.08)] p-4">
                      <div className="mb-3 text-sm font-semibold text-[var(--slate-900)]">本局模型揭曉</div>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                        {revealMappings.map((item) => (
                          <div
                            key={`${item.blindName}-${item.modelName}`}
                            className="bg-white px-4 py-3"
                          >
                            <div className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--emerald-600)]">
                              {item.blindName}
                            </div>
                            <div className="mt-1 text-sm font-semibold text-[var(--slate-800)]">{item.modelName}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {isRevealed && !isCompletedSession && !shouldShowHistoryRound && (
                  <div className="flex flex-col justify-center gap-3 pt-1 sm:flex-row animate-fade-in">
                    {!isMaxRounds && canStartNewRound() ? (
                      <button
                        type="button"
                        onClick={handleNextRound}
                        className="metal-button rounded-2xl px-8 py-3 text-sm font-semibold tracking-[0.08em] text-white"
                      >
                        再下一局
                      </button>
                    ) : (
                      <div className="flex items-center rounded-2xl bg-white/76 px-5 py-3 text-sm text-[var(--slate-600)]">
                        已達到最大對戰次數
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={endSession}
                      className="rounded-full bg-[var(--surface-muted)] px-8 py-3 text-sm font-medium text-[var(--slate-700)] hover:text-[var(--slate-900)]"
                    >
                      結束挑戰
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {!isCompletedSession && !shouldShowHistoryRound && (
            <div className="bg-white px-4 pb-5 pt-3 sm:px-6">
              <div className="mx-auto max-w-4xl">
                {inputLocked && (
                  <div className="mb-2 bg-[var(--amber-50)] px-4 py-2.5 text-sm text-[var(--amber-900)]">
                    先完成本局排名後，才能送出下一個問題。
                  </div>
                )}

                <PromptComposer
                  value={prompt}
                  onChange={setPrompt}
                  onSubmit={handleSubmitPrompt}
                  disabled={inputLocked}
                  isLoading={isLoading}
                  submitLabel="送出問題"
                  placeholder={`輸入您的問題，開始${ARENA_MODE_LABELS[arenaMode]}...`}
                  leadingControls={
                    <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-semibold text-[var(--slate-600)]">
                      {ARENA_MODE_LABELS[arenaMode]}
                    </span>
                  }
                  trailingControls={
                    <span className="text-xs text-[var(--slate-500)]">
                      第 {roundCount + 1} / {ARENA_CONFIG.maxRoundsPerSession} 局
                    </span>
                  }
                />
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

interface ResponseCardProps {
  response: {
    modelId: string;
    blindName: string;
    response: string;
    isLoading: boolean;
  };
  mode: ArenaMode;
  isRevealed: boolean;
  modelName: string;
  rank?: number;
  index: number;
}

function ResponseCard({ response, mode, isRevealed, modelName, rank, index }: ResponseCardProps) {
  const rankColors: Record<number, string> = {
    1: 'bg-[var(--gold-500)] text-white',
    2: 'bg-[var(--slate-400)] text-white',
    3: 'bg-[var(--gold-600)] text-white',
  };

  const rankLabels: Record<number, string> = {
    1: '第一名',
    2: '第二名',
    3: '第三名',
  };

  const title = mode === 'open' || isRevealed ? modelName : response.blindName;
  const shouldShowBlindReference = mode === 'blind' && isRevealed;
  const shouldShowRankBadge = Boolean(rank) && (mode === 'open' || isRevealed);

  return (
    <div
      className={`border-t bg-white transition-colors duration-300 ${
        isRevealed ? 'border-[var(--emerald-300)]' : 'border-[var(--border-soft)]'
      }`}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-2 py-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--slate-900)]">{title}</h3>
          {shouldShowBlindReference && (
            <span className="text-xs text-[var(--slate-500)]">揭曉前代號為 {response.blindName}</span>
          )}
        </div>
        {shouldShowRankBadge && rank && (
          <span className={`rounded-full px-3 py-1 text-sm font-medium ${rankColors[rank]}`}>
            {rankLabels[rank]}
          </span>
        )}
      </div>

      <div className="px-2 py-5">
        {response.isLoading ? (
          <div className="flex items-center gap-3 text-[var(--slate-500)]">
            <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            正在思考中...
          </div>
        ) : (
          <div className="response-text text-sm">{response.response}</div>
        )}
      </div>
    </div>
  );
}
