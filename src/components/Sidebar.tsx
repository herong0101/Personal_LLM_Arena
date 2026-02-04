'use client';

import { useArena } from '@/context/ArenaContext';
import { MatchRound } from '@/types';

export default function Sidebar() {
  const { state, getRoundCount } = useArena();
  const { session } = state;

  const rounds = session?.rounds || [];

  return (
    <aside className="w-72 h-full bg-white/80 backdrop-blur-sm border-r border-[var(--marble-200)] flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-[var(--marble-200)]">
        <h2 className="font-['Cinzel',serif] text-lg font-semibold text-[var(--slate-800)]">
          對戰紀錄
        </h2>
        <p className="text-sm text-[var(--slate-500)] mt-1">
          {getRoundCount()} / 10 局
        </p>
      </div>

      {/* History List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {rounds.length === 0 ? (
          <div className="text-center py-8 text-[var(--slate-500)] text-sm">
            <svg
              className="w-12 h-12 mx-auto mb-3 opacity-30"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
            尚無對戰紀錄
          </div>
        ) : (
          rounds.map((round, index) => (
            <RoundHistoryItem key={round.id} round={round} index={index} />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-[var(--marble-200)]">
        <div className="text-xs text-[var(--slate-500)] text-center">
          智力競技場 Arena of Intelligence
        </div>
      </div>
    </aside>
  );
}

interface RoundHistoryItemProps {
  round: MatchRound;
  index: number;
}

function RoundHistoryItem({ round, index }: RoundHistoryItemProps) {
  const { state } = useArena();
  const { selectedModels } = state;

  // Get model name from ID
  const getModelName = (modelId: string) => {
    const model = selectedModels.find((m) => m.id === modelId);
    return model?.name || modelId;
  };

  // Get winner (rank 1)
  const winner = round.rankings.find((r) => r.rank === 1);
  const winnerName = winner ? getModelName(winner.modelId) : '未知';

  return (
    <div className="marble-card rounded-lg p-3 hover:shadow-md transition-shadow cursor-pointer">
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs font-medium text-[var(--emerald-600)] bg-[var(--emerald-50)] px-2 py-0.5 rounded">
          第 {index + 1} 局
        </span>
        <span className="text-xs text-[var(--slate-500)]">
          {new Date(round.timestamp).toLocaleTimeString('zh-TW', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>

      <p className="text-sm text-[var(--slate-700)] line-clamp-2 mb-2">
        {round.prompt || '（無提示詞）'}
      </p>

      {round.revealed && (
        <div className="flex items-center gap-1 text-xs text-[var(--gold-600)]">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          <span>冠軍：{winnerName}</span>
        </div>
      )}
    </div>
  );
}
