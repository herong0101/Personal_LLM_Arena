'use client';

import { ARENA_MODE_LABELS } from '@/config/models';
import { useArena } from '@/context/ArenaContext';
import { MatchRound } from '@/types';

interface SidebarProps {
  selectedRoundId?: string | null;
  onSelectRound?: (roundId: string | null) => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export default function Sidebar({
  selectedRoundId,
  onSelectRound,
  isMobileOpen = false,
  onCloseMobile,
}: SidebarProps) {
  const { state, getRoundCount } = useArena();
  const { arenaMode, session } = state;

  const rounds = session?.rounds || [];

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex h-full w-[min(22rem,88vw)] flex-col border-r border-[var(--border-soft)] bg-[rgba(255,251,245,0.9)] backdrop-blur-xl transition-transform duration-300 lg:static lg:w-80 lg:translate-x-0 ${
        isMobileOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div className="border-b border-[var(--border-soft)] p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-serif text-xl font-semibold text-[var(--slate-900)]">對戰紀錄</h2>
            <p className="mt-1 text-sm text-[var(--slate-500)]">{getRoundCount()} / 10 局</p>
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            className="soft-button rounded-full px-3 py-2 text-xs font-medium lg:hidden"
          >
            關閉
          </button>
        </div>
        <div className="mt-3 inline-flex items-center rounded-full bg-[rgba(24,172,126,0.1)] px-3 py-1 text-xs font-medium text-[var(--emerald-700)]">
          {ARENA_MODE_LABELS[arenaMode]}
        </div>
        <button
          type="button"
          onClick={() => {
            onSelectRound?.(null);
            onCloseMobile?.();
          }}
          className={`mt-4 w-full rounded-2xl border px-3 py-3 text-sm font-medium transition-colors ${
            selectedRoundId === null
              ? 'border-[rgba(24,172,126,0.24)] bg-[rgba(24,172,126,0.1)] text-[var(--emerald-700)]'
              : 'border-[var(--border-soft)] bg-white/70 text-[var(--slate-600)] hover:border-[rgba(24,172,126,0.24)] hover:text-[var(--emerald-700)]'
          }`}
        >
          回到目前局並繼續問答
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {rounds.length === 0 ? (
          <div className="rounded-[1.5rem] border border-dashed border-[var(--marble-300)] px-4 py-10 text-center text-sm text-[var(--slate-500)]">
            <svg
              className="mx-auto mb-3 h-12 w-12 opacity-30"
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
            <RoundHistoryItem
              key={round.id}
              round={round}
              index={index}
              isActive={selectedRoundId === round.id}
              onSelect={(roundId) => {
                onSelectRound?.(roundId);
                onCloseMobile?.();
              }}
            />
          ))
        )}
      </div>

      <div className="border-t border-[var(--border-soft)] p-4">
        <div className="text-center text-xs text-[var(--slate-500)]">Arena of Intelligence</div>
      </div>
    </aside>
  );
}

interface RoundHistoryItemProps {
  round: MatchRound;
  index: number;
  isActive?: boolean;
  onSelect?: (roundId: string | null) => void;
}

function RoundHistoryItem({ round, index, isActive = false, onSelect }: RoundHistoryItemProps) {
  const { state } = useArena();
  const { selectedModels } = state;

  const getModelName = (modelId: string) => {
    const model = selectedModels.find((m) => m.id === modelId);
    return model?.name || modelId;
  };

  const winners = round.rankings.filter((ranking) => ranking.rank === 1);
  const winnerName = winners.length > 0
    ? winners.map((winner) => getModelName(winner.modelId)).join(' / ')
    : '未知';

  return (
    <button
      type="button"
      onClick={() => onSelect?.(isActive ? null : round.id)}
      className={`marble-card w-full cursor-pointer rounded-[1.25rem] p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_30px_rgba(36,28,18,0.1)] ${
        isActive ? 'ring-2 ring-[var(--emerald-400)] shadow-[0_18px_30px_rgba(14,109,83,0.14)]' : ''
      }`}
    >
      <div className="mb-3 flex items-start justify-between">
        <span className="rounded-full bg-[rgba(24,172,126,0.1)] px-2.5 py-1 text-xs font-medium text-[var(--emerald-700)]">
          第 {index + 1} 局
        </span>
        <span className="text-xs text-[var(--slate-500)]">
          {new Date(round.timestamp).toLocaleTimeString('zh-TW', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>

      <p className="mb-3 text-sm leading-6 text-[var(--slate-700)] line-clamp-2">
        {round.prompt || '（無提示詞）'}
      </p>

      {round.revealed && (
        <div className="flex items-center gap-1 text-xs text-[var(--gold-600)]">
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          <span>{winners.length > 1 ? '並列冠軍' : '冠軍'}：{winnerName}</span>
        </div>
      )}
    </button>
  );
}
