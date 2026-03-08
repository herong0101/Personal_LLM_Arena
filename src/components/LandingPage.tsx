'use client';

import { ARENA_MODE_LABELS } from '@/config/models';
import { useArena } from '@/context/ArenaContext';
import { ArenaMode } from '@/types';

const HERO_STATS = [
  { label: '比較方式', value: '盲測與公開雙模式' },
  { label: '對戰節奏', value: '每局 1 題，立即排名' },
  { label: '結果處理', value: '留下紀錄' },
];

const ARENA_STEPS = [
  {
    title: '選模式',
    description: '先決定要排除品牌偏見（盲測），還是直接亮牌比較模型表現。',
  },
  {
    title: '出題對戰',
    description: '把同一題送給多個模型，平行取得回覆並閱讀差異。',
  },
  {
    title: '排序留存',
    description: '完成排名、揭曉身份、補充觀察，最後匯出完整紀錄。',
  },
];

export default function LandingPage() {
  const { selectMode } = useArena();

  const handleStart = (mode: ArenaMode) => {
    selectMode(mode);
  };

  return (
    <div className="page-shell min-h-screen overflow-hidden px-5 py-6 sm:px-8 lg:px-10">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[32rem] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.72),transparent_56%)]" />
        <div className="absolute -left-20 top-16 h-72 w-72 rounded-full bg-[rgba(24,172,126,0.12)] blur-3xl" />
        <div className="absolute right-0 top-0 h-80 w-80 rounded-full bg-[rgba(232,179,73,0.14)] blur-3xl" />
        <div className="absolute bottom-10 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full border border-[rgba(17,24,39,0.06)]" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl">
        <div className="glass-panel rounded-[2rem] p-6 sm:p-8 lg:p-10">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_0.95fr] lg:items-start">
            <section className="animate-fade-in">
              <span className="eyebrow">Arena of Intelligence</span>
              <h1 className="mt-5 max-w-4xl font-serif text-5xl font-semibold leading-[0.96] tracking-[-0.04em] text-[var(--slate-900)] sm:text-6xl lg:text-7xl">
                快速找到最適合你工作的那個模型
                <span className="stone-text"> </span>
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-[var(--slate-600)] sm:text-lg">
                一個可以讓你用同一題目、同一流程、同一份評分標準去比較回答品質的工作平台。
                你可以用盲測排除品牌偏見，也可以直接比較模型差異。
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                {HERO_STATS.map((stat) => (
                  <div key={stat.label} className="marble-card rounded-2xl p-4">
                    <div className="text-sm font-medium text-[var(--slate-500)]">{stat.label}</div>
                    <div className="mt-2 text-lg font-semibold text-[var(--slate-800)]">{stat.value}</div>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex flex-wrap gap-3 text-sm text-[var(--slate-600)]">
                <span className="rounded-full border border-[rgba(24,172,126,0.14)] bg-white/70 px-4 py-2">平行回覆比較</span>
                <span className="rounded-full border border-[rgba(24,172,126,0.14)] bg-white/70 px-4 py-2">逐局排名揭曉</span>
                <span className="rounded-full border border-[rgba(24,172,126,0.14)] bg-white/70 px-4 py-2">回饋與 JSON 匯出</span>
              </div>
            </section>

            <section className="animate-fade-in space-y-4" style={{ animationDelay: '120ms' }}>
              <div className="marble-card rounded-[1.75rem] p-5 sm:p-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--emerald-700)]">開始對戰</p>
                    <h2 className="mt-1 font-serif text-2xl font-semibold text-[var(--slate-900)]">先選一種比較方式</h2>
                  </div>
                  <div className="rounded-2xl bg-[rgba(24,172,126,0.1)] px-3 py-2 text-sm font-semibold text-[var(--emerald-700)]">
                    2 種流程
                  </div>
                </div>

                <div className="space-y-4">
                  <ModeCard
                    badge={ARENA_MODE_LABELS.blind}
                    title="匿名盲測"
                    summary="先看內容再排名，最後才揭曉模型身份。"
                    highlights={['排除品牌偏見', '適合嚴格比較品質', '最後才揭曉模型']}
                    actionLabel="以盲測開始"
                    onClick={() => handleStart('blind')}
                  />
                  <ModeCard
                    badge={ARENA_MODE_LABELS.open}
                    title="公開比較"
                    summary="直接看模型名稱與回答，快速對照差異。"
                    highlights={['直接比較', '快速挑候選模型', '省去揭曉等待']}
                    actionLabel="以公開模式開始"
                    onClick={() => handleStart('open')}
                  />
                </div>
              </div>
            </section>
          </div>

          <section className="mt-10 animate-fade-in" style={{ animationDelay: '180ms' }}>
            <div className="mb-4">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--slate-500)]">使用流程</p>
              <h2 className="mt-1 font-serif text-3xl font-semibold text-[var(--slate-900)]">三步驟完成一次比較對決</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {ARENA_STEPS.map((step, index) => (
                <FeatureCard
                  key={step.title}
                  index={index + 1}
                  title={step.title}
                  description={step.description}
                />
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

interface ModeCardProps {
  badge: string;
  title: string;
  summary: string;
  highlights: string[];
  actionLabel: string;
  onClick: () => void;
}

function ModeCard({ badge, title, summary, highlights, actionLabel, onClick }: ModeCardProps) {
  return (
    <div className="marble-card rounded-[1.5rem] border border-[rgba(24,172,126,0.12)] p-5 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(36,28,18,0.12)]">
      <div className="inline-flex items-center rounded-full bg-[rgba(24,172,126,0.1)] px-3 py-1 text-xs font-semibold tracking-[0.16em] text-[var(--emerald-700)]">
        {badge}
      </div>
      <h2 className="mt-4 font-serif text-2xl text-[var(--slate-900)]">{title}</h2>
      <p className="mt-3 text-base leading-7 text-[var(--slate-600)]">{summary}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {highlights.map((highlight) => (
          <span
            key={highlight}
            className="rounded-full border border-[rgba(17,24,39,0.08)] bg-white/80 px-3 py-1 text-xs text-[var(--slate-600)]"
          >
            {highlight}
          </span>
        ))}
      </div>
      <button
        type="button"
        onClick={onClick}
        className="metal-button mt-6 inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold tracking-[0.08em] text-white"
      >
        {actionLabel}
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      </button>
    </div>
  );
}

interface FeatureCardProps {
  index: number;
  title: string;
  description: string;
}

function FeatureCard({ index, title, description }: FeatureCardProps) {
  return (
    <div className="marble-card rounded-[1.5rem] p-6">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(24,172,126,0.12)] font-serif text-lg font-semibold text-[var(--emerald-700)]">
        {index}
      </div>
      <h3 className="mt-5 font-serif text-2xl font-semibold text-[var(--slate-900)]">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-[var(--slate-600)]">{description}</p>
    </div>
  );
}
