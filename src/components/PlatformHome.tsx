'use client';

import Link from 'next/link';

const MODULES = [
  {
    href: '/arena',
    eyebrow: '比較模組',
    title: '模型競技場',
    summary:
      '實現盲測與公開比較流程，用同一題平行比對多個模型，快速找到更適合任務的候選者。',
    highlights: ['盲測 / 公開雙模式', '逐局評分與揭曉', '匯出 JSON'],
    accent: 'from-[rgba(24,172,126,0.16)] to-[rgba(255,255,255,0.7)]',
  },
  {
    href: '/studio',
    eyebrow: '互動模組',
    title: 'Chat Studio',
    summary:
      '像 GPT 網頁 chatbox 一樣持續對話，但可以自由切換雲端與地端模型，並將記憶、文件與模式控制保留在使用者端。',
    highlights: ['使用者端記憶', '文件上下文', '專家討論模式'],
    accent: 'from-[rgba(232,179,73,0.18)] to-[rgba(255,255,255,0.7)]',
  },
];

const PLATFORM_FEATURES = [
  {
    title: 'LLM比較平台',
    description: '透過盲測與非盲測模式工大家快速比對模型表現，找到最適合你工作需求的那一個。',
  },
  {
    title: 'Chat Studio',
    description: '實作一個小型對話系統，大家可以跟他聊天！',
  },
  {
    title: '更多其他！',
    description: '大家有想要實作但沒時間的有趣內容，都可以再跟我說，我們一起把它做出來！By 賀榕',
  },
];

export default function PlatformHome() {
  return (
    <div className="page-shell min-h-screen overflow-hidden px-5 py-6 sm:px-8 lg:px-10">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[34rem] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.72),transparent_56%)]" />
        <div className="absolute -left-10 top-20 h-72 w-72 rounded-full bg-[rgba(24,172,126,0.12)] blur-3xl" />
        <div className="absolute right-10 top-10 h-80 w-80 rounded-full bg-[rgba(232,179,73,0.15)] blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl">
        <div className="glass-panel rounded-[2rem] p-6 sm:p-8 lg:p-10">
          <section className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
            <div className="animate-fade-in">
              <span className="eyebrow">Language Model Experience Platform</span>
              <h1 className="mt-5 max-w-4xl font-serif text-5xl font-semibold leading-[0.96] tracking-[-0.04em] text-[var(--slate-900)] sm:text-6xl lg:text-7xl">
                語言模型體驗平台
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-[var(--slate-600)] sm:text-lg">
                快速測試酷酷新模型 /ᐠ｡ꞈ｡ᐟ\
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                {PLATFORM_FEATURES.map((feature) => (
                  <div key={feature.title} className="marble-card rounded-2xl p-4">
                    <div className="text-lg font-semibold text-[var(--slate-800)]">{feature.title}</div>
                    <div className="mt-2 text-sm leading-7 text-[var(--slate-600)]">{feature.description}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="animate-fade-in space-y-4" style={{ animationDelay: '120ms' }}>
              <div className="marble-card rounded-[1.75rem] p-5 sm:p-6">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--emerald-700)]">平台模組</p>
                    <h2 className="mt-1 font-serif text-2xl font-semibold text-[var(--slate-900)]">先選擇您現在要工作的方式</h2>
                  </div>
                  <div className="rounded-2xl bg-[rgba(24,172,126,0.1)] px-3 py-2 text-sm font-semibold text-[var(--emerald-700)]">
                    2 個入口
                  </div>
                </div>

                <div className="space-y-4">
                  {MODULES.map((module) => (
                    <Link
                      key={module.href}
                      href={module.href}
                      className="block rounded-[1.5rem] border border-[rgba(24,172,126,0.12)] bg-gradient-to-br p-5 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(36,28,18,0.12)]"
                    >
                      <div className={`rounded-[1.2rem] bg-gradient-to-br ${module.accent} p-5`}>
                        <div className="inline-flex items-center rounded-full bg-white/70 px-3 py-1 text-xs font-semibold tracking-[0.16em] text-[var(--emerald-700)]">
                          {module.eyebrow}
                        </div>
                        <h3 className="mt-4 font-serif text-3xl text-[var(--slate-900)]">{module.title}</h3>
                        <p className="mt-3 text-base leading-7 text-[var(--slate-600)]">{module.summary}</p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {module.highlights.map((highlight) => (
                            <span
                              key={highlight}
                              className="rounded-full border border-[rgba(17,24,39,0.08)] bg-white/80 px-3 py-1 text-xs text-[var(--slate-600)]"
                            >
                              {highlight}
                            </span>
                          ))}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}