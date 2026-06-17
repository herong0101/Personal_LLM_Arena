'use client';

import Link from 'next/link';

// 平台能力旅程：從「評測」一路走到「工程」，四個階段對應使用者越來越深入的使用方式。
const STAGES = [
  { key: 'evaluate', index: '01', label: '評測', caption: '哪個模型最適合？' },
  { key: 'interact', index: '02', label: '互動', caption: '跟它深入對話' },
  { key: 'orchestrate', index: '03', label: '編排', caption: '把多個串成流程' },
  { key: 'engineer', index: '04', label: '工程', caption: '讓它自我改進' },
] as const;

type StageKey = (typeof STAGES)[number]['key'];

const MODULES: Array<{
  href: string;
  stage: StageKey;
  eyebrow: string;
  title: string;
  summary: string;
  highlights: string[];
  accentClass: string;
  dotColor: string;
  wide?: boolean;
}> = [
  {
    href: '/arena',
    stage: 'evaluate',
    eyebrow: '比較模組',
    title: '模型競技場',
    summary: '用同一題平行比對多個模型，盲測或公開兩種模式，快速找到最適合任務的候選者。',
    highlights: ['盲測 / 公開雙模式', '逐局評分與揭曉', '匯出 JSON'],
    accentClass: 'from-[rgba(24,172,126,0.14)] to-transparent',
    dotColor: 'bg-[var(--emerald-500)]',
  },
  {
    href: '/studio',
    stage: 'interact',
    eyebrow: '互動模組',
    title: 'Chat Studio',
    summary: '像 GPT chatbox 一樣持續對話，自由切換雲端與地端模型，記憶、文件與模式控制保留在使用者端。',
    highlights: ['使用者端記憶', '文件上下文', '專家討論模式'],
    accentClass: 'from-[rgba(232,179,73,0.16)] to-transparent',
    dotColor: 'bg-[var(--gold-500)]',
  },
  {
    href: '/graph',
    stage: 'orchestrate',
    eyebrow: '編排模組',
    title: 'Graph Builder',
    summary: '用 no-code 方式把多個模型節點編排成 LangGraph 流程，測試 chain、分支與匯流決策的差異。',
    highlights: ['分支匯流', 'Prompt 模板', '逐步輸出'],
    accentClass: 'from-[rgba(17,24,39,0.08)] to-transparent',
    dotColor: 'bg-[var(--slate-800)]',
  },
  {
    href: '/loop',
    stage: 'engineer',
    eyebrow: '自主迴圈模組',
    title: 'Loop 工程實驗室',
    summary: '設定任務、成功標準與輪數預算，模型自動改善一批後回到人工評分，通過人工標準才算合格。',
    highlights: ['人工評分 Gate', 'Evaluator backpressure', '逐輪成果 Trace'],
    accentClass: 'from-[rgba(24,172,126,0.14)] to-transparent',
    dotColor: 'bg-[var(--emerald-700)]',
  },
];

function stageNumber(stage: StageKey) {
  return STAGES.find((s) => s.key === stage)?.index ?? '';
}

export default function PlatformHome() {
  return (
    <div className="flex h-full flex-col overflow-auto">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-12">
        {/* Header */}
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--emerald-700)]">
            Language Model Experience Platform
          </p>
          <h1 className="mt-3 font-serif text-4xl font-semibold text-[var(--slate-900)] sm:text-5xl">
            語言模型體驗平台
          </h1>
          <p className="mt-3 text-sm text-[var(--slate-500)]">
            一條從「比較」走到「自我改進」的路徑，理解不同模型的工作方式。
          </p>
          <Link
            href="/history"
            className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-[var(--border-soft)] bg-white/60 px-3 py-1.5 text-xs font-semibold text-[var(--slate-600)] transition-colors hover:text-[var(--emerald-700)]"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12a9 9 0 1 0 3-6.7L3 8" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4v4h4" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 2" />
            </svg>
            查看歷史總覽
          </Link>
        </div>

        {/* 能力旅程 rail：讓使用者一眼看懂模組之間的遞進關係 */}
        <ol className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="平台能力旅程">
          {STAGES.map((stage, i) => (
            <li
              key={stage.key}
              className="relative flex flex-col rounded-2xl border border-[var(--border-soft)] bg-white/60 px-4 py-3"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold tracking-[0.12em] text-[var(--emerald-600)]">
                  {stage.index}
                </span>
                <span className="text-sm font-semibold text-[var(--slate-900)]">{stage.label}</span>
                {i < STAGES.length - 1 && (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                    className="ml-auto hidden h-4 w-4 text-[var(--slate-400)] sm:block"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
                  </svg>
                )}
              </div>
              <p className="mt-1 text-xs leading-5 text-[var(--slate-500)]">{stage.caption}</p>
            </li>
          ))}
        </ol>

        {/* Module cards */}
        <div className="mt-6 grid w-full gap-4 md:grid-cols-2">
          {MODULES.map((module) => (
            <Link
              key={module.href}
              href={module.href}
              className={`group marble-card flex flex-col rounded-[1.5rem] p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_24px_48px_rgba(36,28,18,0.12)] ${
                module.wide ? 'md:col-span-2' : ''
              }`}
            >
              <div className="mb-4 flex items-center justify-between">
                <div className={`h-1.5 w-8 rounded-full ${module.dotColor}`} />
                <span className="rounded-full border border-[var(--border-soft)] bg-white/60 px-2.5 py-0.5 text-xs font-semibold tracking-[0.08em] text-[var(--slate-500)]">
                  {stageNumber(module.stage)} · {STAGES.find((s) => s.key === module.stage)?.label}
                </span>
              </div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--slate-500)]">
                {module.eyebrow}
              </p>
              <h2 className="font-serif text-2xl font-semibold text-[var(--slate-900)]">
                {module.title}
              </h2>
              <p className="mt-3 flex-1 text-sm leading-7 text-[var(--slate-600)]">
                {module.summary}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {module.highlights.map((h) => (
                  <span
                    key={h}
                    className="rounded-full border border-[var(--border-soft)] bg-white/60 px-2.5 py-0.5 text-xs text-[var(--slate-600)]"
                  >
                    {h}
                  </span>
                ))}
              </div>
              <div className="mt-5 flex items-center gap-1.5 text-xs font-semibold text-[var(--emerald-700)]">
                進入
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
