'use client';

import { useState, useEffect } from 'react';
import { useArena } from '@/context/ArenaContext';
import { RankingResult } from '@/types';
import { ARENA_CONFIG } from '@/config/models';
import Sidebar from './Sidebar';
import RankingPanel from './RankingPanel';

export default function BlindArena() {
  const {
    state,
    submitPrompt,
    submitRanking,
    revealModels,
    nextRound,
    endSession,
    canStartNewRound,
    getRoundCount,
  } = useArena();

  const [prompt, setPrompt] = useState('');
  const [showRanking, setShowRanking] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const [currentPrompt, setCurrentPrompt] = useState('');

  const { currentResponses, isLoading, selectedModels, session } = state;

  // Check if all responses are loaded
  const allResponsesLoaded =
    currentResponses.length > 0 && currentResponses.every((r) => !r.isLoading);

  // Check if current round is revealed
  const currentRound = session?.rounds[session.rounds.length - 1];
  const isCurrentRoundRevealed = currentRound?.revealed || false;

  useEffect(() => {
    if (allResponsesLoaded && !showRanking && currentResponses.length > 0) {
      setShowRanking(true);
    }
  }, [allResponsesLoaded, showRanking, currentResponses.length]);

  useEffect(() => {
    setIsRevealed(isCurrentRoundRevealed);
  }, [isCurrentRoundRevealed]);

  const handleSubmitPrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;

    setCurrentPrompt(prompt);
    setShowRanking(false);
    setIsRevealed(false);
    await submitPrompt(prompt);
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
  };

  const handleEndSession = () => {
    endSession();
  };

  const roundCount = getRoundCount();
  const isMaxRounds = roundCount >= ARENA_CONFIG.maxRoundsPerSession;

  return (
    <div className="h-screen flex">
      {/* Sidebar */}
      <Sidebar />

      {/* Main arena area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-sm border-b border-[var(--marble-200)] px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-['Cinzel',serif] text-2xl font-semibold text-[var(--slate-800)]">
                盲測競技場
              </h1>
              <p className="text-sm text-[var(--slate-500)]">
                {selectedModels.map((m) => m.name).join(' vs ')}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-[var(--slate-600)]">
                第 <span className="font-semibold text-[var(--emerald-600)]">{roundCount + 1}</span> /{' '}
                {ARENA_CONFIG.maxRoundsPerSession} 局
              </div>
              <button
                onClick={handleEndSession}
                className="px-4 py-2 text-sm text-[var(--slate-600)] hover:text-red-600 
                         border border-[var(--marble-300)] rounded-lg hover:border-red-300 transition-colors"
              >
                結束挑戰
              </button>
            </div>
          </div>
        </header>

        {/* Responses area */}
        <div className="flex-1 overflow-y-auto p-6">
          {currentResponses.length === 0 && !isLoading ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-md">
                <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-[var(--emerald-50)] flex items-center justify-center">
                  <svg
                    className="w-12 h-12 text-[var(--emerald-500)]"
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
                <h2 className="font-['Cinzel',serif] text-xl font-semibold text-[var(--slate-700)] mb-2">
                  準備好了嗎？
                </h2>
                <p className="text-[var(--slate-500)]">
                  在下方輸入您的問題，讓 AI 模型們一較高下
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Current prompt display */}
              {currentPrompt && (
                <div className="marble-card rounded-xl p-4 mb-6">
                  <div className="text-xs text-[var(--emerald-600)] font-medium mb-2">您的提問</div>
                  <p className="text-[var(--slate-700)]">{currentPrompt}</p>
                </div>
              )}

              {/* Responses grid */}
              <div
                className={`grid gap-6 ${
                  selectedModels.length === 1
                    ? 'grid-cols-1'
                    : selectedModels.length === 2
                    ? 'grid-cols-1 lg:grid-cols-2'
                    : 'grid-cols-1 lg:grid-cols-3'
                }`}
              >
                {currentResponses.map((response, index) => (
                  <ResponseCard
                    key={response.modelId}
                    response={response}
                    isRevealed={isRevealed}
                    modelName={selectedModels.find((m) => m.id === response.modelId)?.name || ''}
                    rank={
                      currentRound?.rankings.find((r) => r.modelId === response.modelId)?.rank
                    }
                    index={index}
                  />
                ))}
              </div>

              {/* Ranking panel */}
              {showRanking && allResponsesLoaded && !isRevealed && (
                <div className="animate-fade-in">
                  <RankingPanel responses={currentResponses} onSubmit={handleRankingSubmit} />
                </div>
              )}

              {/* Post-reveal actions */}
              {isRevealed && (
                <div className="flex justify-center gap-4 pt-6 animate-fade-in">
                  {!isMaxRounds && canStartNewRound() ? (
                    <button
                      onClick={handleNextRound}
                      className="metal-button text-white font-['Cinzel',serif] px-8 py-3 rounded-lg"
                    >
                      再下一局
                    </button>
                  ) : (
                    <div className="text-center">
                      <p className="text-[var(--slate-600)] mb-4">已達到最大對戰次數</p>
                    </div>
                  )}
                  <button
                    onClick={handleEndSession}
                    className="px-8 py-3 border-2 border-[var(--emerald-500)] text-[var(--emerald-600)] 
                             font-['Cinzel',serif] rounded-lg hover:bg-[var(--emerald-50)] transition-colors"
                  >
                    結束挑戰
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="border-t border-[var(--marble-200)] bg-white/80 backdrop-blur-sm p-4">
          <form onSubmit={handleSubmitPrompt} className="max-w-4xl mx-auto">
            <div className="flex gap-3">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="輸入您的問題，開始盲測對決..."
                disabled={isLoading || (showRanking && !isRevealed)}
                className="flex-1 px-5 py-3 rounded-xl border border-[var(--marble-300)] 
                         bg-white focus:outline-none focus:ring-2 focus:ring-[var(--emerald-400)] 
                         focus:border-transparent transition-all disabled:bg-[var(--marble-100)] 
                         disabled:cursor-not-allowed"
              />
              <button
                type="submit"
                disabled={!prompt.trim() || isLoading || (showRanking && !isRevealed)}
                className="metal-button text-white px-6 py-3 rounded-xl disabled:opacity-50 
                         disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
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
                    生成中...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                      />
                    </svg>
                    發送
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
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
  isRevealed: boolean;
  modelName: string;
  rank?: number;
  index: number;
}

function ResponseCard({ response, isRevealed, modelName, rank, index }: ResponseCardProps) {
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

  return (
    <div
      className={`marble-card rounded-xl overflow-hidden transition-all duration-500 ${
        isRevealed ? 'ring-2 ring-[var(--emerald-400)]' : ''
      }`}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* Header */}
      <div className="px-5 py-3 border-b border-[var(--marble-200)] flex items-center justify-between">
        <div>
          <h3 className="font-['Cinzel',serif] font-semibold text-[var(--slate-800)]">
            {isRevealed ? modelName : response.blindName}
          </h3>
          {isRevealed && (
            <span className="text-xs text-[var(--slate-500)]">原為 {response.blindName}</span>
          )}
        </div>
        {rank && (
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${rankColors[rank]}`}>
            {rankLabels[rank]}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-5">
        {response.isLoading ? (
          <div className="flex items-center gap-3 text-[var(--slate-500)]">
            <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
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
          <div className="prose prose-sm max-w-none text-[var(--slate-700)] whitespace-pre-wrap">
            {response.response}
          </div>
        )}
      </div>
    </div>
  );
}
