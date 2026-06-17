'use client';

import { useArena } from '@/context/ArenaContext';
import { ArenaMode } from '@/types';

export default function LandingPage() {
  const { selectMode } = useArena();

  const handleStart = (mode: ArenaMode) => {
    selectMode(mode);
  };

  return (
    <div className="flex h-full items-center justify-center overflow-auto px-5 py-10">
      <main className="mx-auto w-full max-w-3xl text-center">
        <h1 className="text-4xl font-semibold tracking-[-0.03em] text-[var(--slate-900)] sm:text-5xl">
          選一種比較方式
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base leading-8 text-[var(--slate-500)]">
          用同一個問題比較多個模型。盲測適合降低品牌偏見，公開比較適合快速對照。
        </p>

        <div className="mx-auto mt-10 grid max-w-2xl gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => handleStart('blind')}
            className="group rounded-[1.5rem] bg-[var(--slate-900)] px-6 py-5 text-left text-white transition-transform hover:-translate-y-0.5"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold">盲測</span>
              <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs font-medium text-white/80">
                降低品牌偏見
              </span>
            </div>
            <div className="mt-2 text-sm leading-6 text-white/70">
              回答以「模型 A / B / C」匿名顯示，排名後才揭曉是誰。適合純粹比品質、避免被名氣影響判斷。
            </div>
          </button>
          <button
            type="button"
            onClick={() => handleStart('open')}
            className="group rounded-[1.5rem] border border-[var(--border-soft)] bg-white px-6 py-5 text-left text-[var(--slate-900)] transition-transform hover:-translate-y-0.5"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold">公開比較</span>
              <span className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-xs font-medium text-[var(--slate-600)]">
                快速對照
              </span>
            </div>
            <div className="mt-2 text-sm leading-6 text-[var(--slate-500)]">
              直接顯示模型名稱與回答。適合已知道想看哪幾個模型、想邊看邊對照差異時使用。
            </div>
          </button>
        </div>
      </main>
    </div>
  );
}
