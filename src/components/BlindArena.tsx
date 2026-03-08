'use client';

import { useEffect, useState } from 'react';
import { ARENA_CONFIG, ARENA_MODE_LABELS } from '@/config/models';
import { useArena } from '@/context/ArenaContext';
import { ArenaMode, MatchRound, RankingResult, UserFeedback } from '@/types';
import Sidebar from './Sidebar';
import RankingPanel from './RankingPanel';

const SAMPLE_PROMPTS = [
  '請用白話文解釋醫療險、重大疾病險與實支實付的差異，並說明各自適合哪些族群。',
  '如果 30 歲上班族想規劃基本保險保障，請提供壽險、醫療險與意外險的投保思路與注意事項。',
  '請整理維持心血管健康的 7 個日常習慣，並說明每一項背後的原因。',
  '假設家中長輩剛被診斷糖尿病前期，請提供飲食、運動與定期追蹤的健康管理建議。',
];

const FLOW_STEPS = [
  { id: 'ask', label: '提出問題' },
  { id: 'read', label: '閱讀回答' },
  { id: 'rank', label: '排序評分' },
  { id: 'reveal', label: '揭曉與記錄' },
] as const;

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

  const { arenaMode, currentResponses, isLoading, selectedModels, session } = state;
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

  const handleSubmitPrompt = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!prompt.trim() || isLoading) return;

    setSelectedRoundId(null);
    setCurrentPrompt(prompt);
    setShowRanking(false);
    setIsRevealed(false);
    await submitPrompt(prompt);
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
  const hasDisplayedResponses = displayedResponses.length > 0;
  const hasPendingResponse = displayedResponses.some((response) => response.isLoading);
  const currentStep = shouldShowHistoryRound
    ? 'read'
    : !hasDisplayedResponses
    ? 'ask'
    : hasPendingResponse || isLoading
    ? 'read'
    : showRanking && !displayedIsRevealed
    ? 'rank'
    : displayedIsRevealed
    ? 'reveal'
    : 'read';
  const inputLocked = isLoading || (showRanking && !isRevealed);

  return (
    <div className="page-shell min-h-screen lg:h-screen">
      {isHistoryOpen && (
        <button
          type="button"
          aria-label="關閉對戰紀錄"
          onClick={() => setIsHistoryOpen(false)}
          className="fixed inset-0 z-30 bg-[rgba(17,24,39,0.28)] backdrop-blur-[2px] lg:hidden"
        />
      )}

      <div className="relative z-10 flex min-h-screen lg:h-screen">
        <Sidebar
          selectedRoundId={selectedRoundId}
          onSelectRound={setSelectedRoundId}
          isMobileOpen={isHistoryOpen}
          onCloseMobile={() => setIsHistoryOpen(false)}
        />

        <main className="flex min-h-screen flex-1 flex-col lg:h-screen">
          <header className="border-b border-[var(--border-soft)] bg-[rgba(255,251,245,0.78)] px-4 py-4 backdrop-blur-xl sm:px-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsHistoryOpen(true)}
                    className="soft-button inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium lg:hidden"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                    對戰紀錄
                  </button>
                  <button
                    type="button"
                    onClick={handleBack}
                    className="soft-button inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    返回上一頁
                  </button>
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="font-serif text-3xl font-semibold text-[var(--slate-900)]">
                      {isBlindMode ? '盲測競技場' : '公開競技場'}
                    </h1>
                    <div className="rounded-full bg-[rgba(24,172,126,0.1)] px-3 py-1 text-xs font-semibold tracking-[0.14em] text-[var(--emerald-700)]">
                      {ARENA_MODE_LABELS[arenaMode]}
                    </div>
                  </div>
                  <p className="mt-2 text-sm leading-7 text-[var(--slate-600)]">
                    同一題、同一時間、同一流程比較模型表現。
                    {isBlindMode ? ' 送出排名後才揭曉模型身份。' : ' 目前直接顯示模型名稱。'}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {selectedModels.map((model) => (
                    <span
                      key={model.id}
                      className="rounded-full bg-white/78 px-3 py-2 text-sm text-[var(--slate-700)]"
                    >
                      {model.name}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-4 xl:max-w-md xl:text-right">
                <div className="flex items-center gap-3 xl:justify-end">
                  <div className="rounded-2xl bg-white/80 px-4 py-3 text-sm text-[var(--slate-600)]">
                    第 <span className="font-semibold text-[var(--emerald-700)]">{roundCount + 1}</span> / {ARENA_CONFIG.maxRoundsPerSession} 局
                  </div>
                  {isCompletedSession ? (
                    <button
                      type="button"
                      onClick={() => dispatch({ type: 'SET_PHASE', payload: 'analytics' })}
                      className="soft-button rounded-2xl px-4 py-3 text-sm font-medium"
                    >
                      返回送出頁
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={endSession}
                      className="rounded-2xl border border-[rgba(213,109,85,0.22)] bg-white/78 px-4 py-3 text-sm font-medium text-[var(--slate-600)] transition-colors hover:border-[rgba(213,109,85,0.38)] hover:text-[var(--rose-500)]"
                    >
                      結束挑戰
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {FLOW_STEPS.map((step, index) => {
                    const isActive = FLOW_STEPS.findIndex((item) => item.id === currentStep) >= index;
                    return (
                      <div
                        key={step.id}
                        className={`rounded-2xl border px-3 py-3 text-left transition-colors ${
                          isActive
                            ? 'border-[rgba(24,172,126,0.2)] bg-[rgba(24,172,126,0.1)] text-[var(--emerald-700)]'
                            : 'border-[var(--border-soft)] bg-white/65 text-[var(--slate-400)]'
                        }`}
                      >
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em]">Step {index + 1}</div>
                        <div className="mt-1 text-sm font-medium">{step.label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            {displayedResponses.length === 0 && !isLoading ? (
              <div className="mx-auto max-w-5xl">
                <div className="glass-panel rounded-[2rem] p-6 text-center sm:p-10">
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.75rem] bg-[rgba(24,172,126,0.12)]">
                    <svg
                      className="h-10 w-10 text-[var(--emerald-600)]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                      />
                    </svg>
                  </div>
                  <h2 className="mt-6 font-serif text-3xl font-semibold text-[var(--slate-900)]">用一個問題，開始第一局比較</h2>
                  <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-[var(--slate-600)]">
                    先在底部輸入你的題目，或直接點一個範例問題。
                    {isBlindMode ? ' 這一局會先隱藏模型名稱，讓你只看回答內容排序。' : ' 這一局會直接顯示模型名稱，方便明牌對照。'}
                  </p>

                  <div className="mt-8 grid gap-4 md:grid-cols-2">
                    {SAMPLE_PROMPTS.map((samplePrompt) => (
                      <button
                        key={samplePrompt}
                        type="button"
                        onClick={() => void handleSamplePrompt(samplePrompt)}
                        disabled={isLoading}
                        className="marble-card rounded-[1.5rem] p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_30px_rgba(36,28,18,0.12)] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--emerald-700)]">範例問題</div>
                        <div className="mt-3 text-sm leading-7 text-[var(--slate-700)]">{samplePrompt}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mx-auto max-w-7xl space-y-6">
                {displayedPrompt && (
                  <div className="marble-card rounded-[1.5rem] p-5">
                    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
                            回到目前局
                          </button>
                        )}
                        {displayedRound && displayedRoundIndex >= 0 && <div>第 {displayedRoundIndex + 1} 局</div>}
                      </div>
                    </div>
                    <p className="text-base leading-8 text-[var(--slate-700)]">{displayedPrompt}</p>
                  </div>
                )}

                {shouldShowHistoryRound && !isCompletedSession && (
                  <div className="rounded-[1.5rem] border border-[var(--amber-200)] bg-[var(--amber-50)] px-5 py-4 text-sm text-[var(--amber-900)]">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <span>目前正在查看歷史回合。回到目前局後，才可繼續排名、開始下一局或輸入新問題。</span>
                      <button
                        type="button"
                        onClick={handleReturnToCurrentRound}
                        className="soft-button rounded-2xl px-4 py-2 text-xs font-medium"
                      >
                        返回目前局
                      </button>
                    </div>
                  </div>
                )}

                <div
                  className={`grid gap-5 ${
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
                  <div className="marble-card rounded-[1.75rem] p-6 animate-fade-in">
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
                          className="soft-button rounded-2xl px-4 py-3 text-sm font-medium"
                        >
                          前往送出頁
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                      {selectedModels.map((model) => (
                        <div key={model.id} className="rounded-[1.5rem] border border-[var(--border-soft)] bg-white/82 p-4">
                          <div className="mb-2 font-semibold text-[var(--slate-900)]">{model.name}</div>
                          <textarea
                            value={feedbackDraft[model.id] || ''}
                            onChange={(event) => handleFeedbackChange(model.id, event.target.value)}
                            placeholder={`記錄對 ${model.name} 的觀察...`}
                            rows={4}
                            className="min-h-28 w-full resize-none rounded-2xl border border-[var(--marble-300)] bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--emerald-400)]"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="mt-5 rounded-[1.5rem] border border-[rgba(24,172,126,0.16)] bg-[rgba(24,172,126,0.08)] p-4">
                      <div className="mb-3 text-sm font-semibold text-[var(--slate-900)]">本局模型揭曉</div>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                        {revealMappings.map((item) => (
                          <div
                            key={`${item.blindName}-${item.modelName}`}
                            className="rounded-[1.25rem] border border-[rgba(24,172,126,0.12)] bg-white px-4 py-3"
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
                  <div className="flex flex-col justify-center gap-3 pt-2 sm:flex-row animate-fade-in">
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
                      className="soft-button rounded-2xl px-8 py-3 text-sm font-medium"
                    >
                      結束挑戰
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {!isCompletedSession && !shouldShowHistoryRound && (
            <div className="border-t border-[var(--border-soft)] bg-[rgba(255,251,245,0.82)] px-4 py-4 backdrop-blur-xl sm:px-6">
              <form onSubmit={handleSubmitPrompt} className="mx-auto max-w-6xl">
                {inputLocked && (
                  <div className="mb-3 rounded-2xl border border-[var(--amber-200)] bg-[var(--amber-50)] px-4 py-3 text-sm text-[var(--amber-900)]">
                    先完成本局排名後，才能送出下一個問題。
                  </div>
                )}

                <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                  <div className="field-shell flex-1 rounded-[1.5rem] p-3">
                    <label htmlFor="arena-prompt" className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--slate-500)]">
                      輸入本局題目
                    </label>
                    <textarea
                      id="arena-prompt"
                      value={prompt}
                      onChange={(event) => setPrompt(event.target.value)}
                      placeholder={`輸入您的問題，開始${ARENA_MODE_LABELS[arenaMode]}...`}
                      disabled={inputLocked}
                      rows={3}
                      className="w-full resize-none bg-transparent text-sm leading-7 text-[var(--slate-800)] outline-none placeholder:text-[var(--slate-400)] disabled:cursor-not-allowed"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!prompt.trim() || inputLocked}
                    className="metal-button flex items-center justify-center gap-2 rounded-[1.5rem] px-6 py-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isLoading ? (
                      <>
                        <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        生成中
                      </>
                    ) : (
                      <>
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                        送出問題
                      </>
                    )}
                  </button>
                </div>
              </form>
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
    1: '🥇 第一名',
    2: '🥈 第二名',
    3: '🥉 第三名',
  };

  const title = mode === 'open' || isRevealed ? modelName : response.blindName;
  const shouldShowBlindReference = mode === 'blind' && isRevealed;

  return (
    <div
      className={`marble-card overflow-hidden rounded-[1.5rem] transition-all duration-500 ${
        isRevealed ? 'ring-2 ring-[var(--emerald-400)] shadow-[0_18px_32px_rgba(14,109,83,0.12)]' : ''
      }`}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-5 py-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--emerald-700)]">
            {response.blindName}
          </div>
          <h3 className="font-serif text-xl font-semibold text-[var(--slate-900)]">{title}</h3>
          {shouldShowBlindReference && (
            <span className="text-xs text-[var(--slate-500)]">揭曉前代號為 {response.blindName}</span>
          )}
        </div>
        {rank && (
          <span className={`rounded-full px-3 py-1 text-sm font-medium ${rankColors[rank]}`}>
            {rankLabels[rank]}
          </span>
        )}
      </div>

      <div className="p-5">
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
