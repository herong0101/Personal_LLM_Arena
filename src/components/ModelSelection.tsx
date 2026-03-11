'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import { ARENA_CONFIG, ARENA_MODE_LABELS, AVAILABLE_MODELS, MODEL_SPEED_LABELS } from '@/config/models';
import { useArena } from '@/context/ArenaContext';
import { AIModel, ModelSource } from '@/types';

type SourceFilter = 'all' | ModelSource;

const QUICK_PRESETS = [
  {
    label: '雲端基準組',
    description: '用主流雲端模型快速建立基準線。',
    modelIds: ['gpt-5.2', 'gemini-3.1-pro-preview', 'claude-opus-4-5'],
  },
  {
    label: '地端快速組',
    description: '用回覆較快的本地模型先測一輪。',
    modelIds: [
      'local-vllm-4090-gemma-3-27b-it-qat',
      'local-ollama-5090-translategemma-27b',
      'local-ollama-5090-gpt-oss-20b',
    ],
  },
  {
    label: '醫療題材組',
    description: '適合先測醫療與保險相關題目。',
    modelIds: [
      'local-ollama-5090-medgemma-1.5-4b',
      'local-ollama-4090-medgemma-1.5-4b',
      'claude-opus-4-5',
    ],
  },
];

export default function ModelSelection() {
  const { dispatch, startSession, state } = useArena();
  const [selectedModels, setSelectedModels] = useState<AIModel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const availableModels = AVAILABLE_MODELS.filter((m) => m.available);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const modeDescription =
    state.arenaMode === 'blind'
      ? '回答會先匿名顯示，送出排名後才揭露模型身份。'
      : '回答會直接顯示模型名稱，方便比較。';

  const filteredModels = useMemo(() => {
    const keyword = deferredSearchQuery.trim().toLowerCase();

    return availableModels.filter((model) => {
      const matchesSource = sourceFilter === 'all' || model.source === sourceFilter;
      const matchesKeyword =
        !keyword ||
        [model.name, model.provider, model.description, model.serverLabel, model.speed]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(keyword);

      return matchesSource && matchesKeyword;
    });
  }, [availableModels, deferredSearchQuery, sourceFilter]);

  const modelsByProvider = useMemo(() => {
    return filteredModels.reduce((acc, model) => {
      if (!acc[model.provider]) {
        acc[model.provider] = [];
      }
      acc[model.provider].push(model);
      return acc;
    }, {} as Record<string, AIModel[]>);
  }, [filteredModels]);

  const toggleModel = (model: AIModel) => {
    setError(null);

    if (selectedModels.find((m) => m.id === model.id)) {
      setSelectedModels(selectedModels.filter((m) => m.id !== model.id));
      return;
    }

    if (selectedModels.length >= ARENA_CONFIG.maxModelsPerRound) {
      setError(`最多只能選擇 ${ARENA_CONFIG.maxModelsPerRound} 個模型`);
      return;
    }

    setSelectedModels([...selectedModels, model]);
  };

  const applyPreset = (modelIds: string[]) => {
    const models = modelIds
      .map((id) => availableModels.find((model) => model.id === id))
      .filter((model): model is AIModel => Boolean(model))
      .slice(0, ARENA_CONFIG.maxModelsPerRound);

    setSelectedModels(models);
    setError(null);
  };

  const handleBack = () => {
    dispatch({ type: 'SET_PHASE', payload: 'landing' });
  };

  const handleStart = () => {
    if (selectedModels.length < ARENA_CONFIG.minModelsPerRound) {
      setError(`請至少選擇 ${ARENA_CONFIG.minModelsPerRound} 個模型`);
      return;
    }
    startSession(selectedModels);
  };

  return (
    <div className="page-shell min-h-screen px-5 py-6 sm:px-8 lg:px-10">
      <div className="relative z-10 mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="animate-fade-in">
            <button
              type="button"
              onClick={handleBack}
              className="soft-button inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              返回模式選擇
            </button>
            <div className="mt-5">
              <span className="eyebrow">{ARENA_MODE_LABELS[state.arenaMode]}</span>
              <h1 className="mt-5 font-serif text-4xl font-semibold text-[var(--slate-900)] sm:text-5xl">
                把模型選擇這一步，變得更快更清楚
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-8 text-[var(--slate-600)] sm:text-lg">
                先挑出 1 到 {ARENA_CONFIG.maxModelsPerRound} 個模型開始對戰。
              </p>
              <p className="mt-2 text-sm text-[var(--slate-500)]">{modeDescription}</p>
            </div>
          </div>

          <div className="glass-panel rounded-[1.75rem] p-5 animate-fade-in lg:max-w-sm" style={{ animationDelay: '120ms' }}>
            <div className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--emerald-700)]">目前選擇</div>
            <div className="mt-4 flex items-center gap-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-semibold transition-all ${
                    i <= selectedModels.length
                      ? 'bg-[var(--emerald-500)] text-white shadow-[0_12px_24px_rgba(14,109,83,0.18)]'
                      : 'bg-white/80 text-[var(--slate-400)]'
                  }`}
                >
                  {i}
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm leading-7 text-[var(--slate-600)]">
              已選 {selectedModels.length} / {ARENA_CONFIG.maxModelsPerRound}。
              盲測時建議先選定位差不多的模型，比較更有意義。
            </p>
          </div>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-3">
          {QUICK_PRESETS.map((preset, index) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => applyPreset(preset.modelIds)}
              className="marble-card rounded-[1.5rem] p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-[0_20px_36px_rgba(36,28,18,0.12)] animate-fade-in"
              style={{ animationDelay: `${120 + index * 60}ms` }}
            >
              <div className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--emerald-700)]">快速開始</div>
              <h2 className="mt-3 font-serif text-2xl font-semibold text-[var(--slate-900)]">{preset.label}</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--slate-600)]">{preset.description}</p>
              <div className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[var(--emerald-700)]">
                直接套用
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </div>
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-[rgba(213,109,85,0.22)] bg-[var(--rose-100)] px-4 py-3 text-sm text-[var(--rose-500)] animate-fade-in">
            {error}
          </div>
        )}

        <div className="marble-card rounded-[1.75rem] p-5 sm:p-6">
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="field-shell flex items-center gap-3 rounded-2xl px-4 py-3 lg:max-w-md lg:flex-1">
              <svg className="h-5 w-5 text-[var(--slate-400)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.6-5.15a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="搜尋模型名稱、供應商或用途"
                className="w-full bg-transparent text-sm text-[var(--slate-700)] outline-none placeholder:text-[var(--slate-400)]"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                { value: 'all' as const, label: '全部模型' },
                { value: 'cloud' as const, label: '雲端模型' },
                { value: 'local' as const, label: '地端模型' },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setSourceFilter(item.value)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                    sourceFilter === item.value
                      ? 'bg-[var(--emerald-500)] text-white shadow-[0_12px_24px_rgba(14,109,83,0.18)]'
                      : 'soft-button'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-6 flex flex-wrap gap-3 text-sm text-[var(--slate-500)]">
            <span className="rounded-full bg-[rgba(24,172,126,0.1)] px-3 py-1 text-[var(--emerald-700)]">盲測建議：至少 2 個模型</span>
            <span className="rounded-full bg-white/70 px-3 py-1">公開比較適合快速測試比較</span>
            <span className="rounded-full bg-white/70 px-3 py-1">地端模型可依速度標記先行篩選</span>
          </div>

          <div className="space-y-8">
            {Object.entries(modelsByProvider).map(([provider, models]) => (
              <div key={provider} className="animate-fade-in">
                <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <h2 className="flex items-center gap-3 font-serif text-2xl font-semibold text-[var(--slate-900)]">
                    <span className="h-2.5 w-2.5 rounded-full bg-[var(--emerald-500)]" />
                    {provider}
                  </h2>
                  {provider === '地端模型' && (
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-[rgba(24,172,126,0.1)] px-3 py-1 text-[var(--emerald-700)]">快：適合先做體驗驗證</span>
                      <span className="rounded-full bg-[rgba(232,179,73,0.18)] px-3 py-1 text-[var(--gold-600)]">中：品質與速度折衷</span>
                      <span className="rounded-full bg-[var(--rose-100)] px-3 py-1 text-[var(--rose-500)]">慢：適合耐心做品質比較</span>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {models.map((model) => (
                    <ModelCard
                      key={model.id}
                      model={model}
                      isSelected={selectedModels.some((m) => m.id === model.id)}
                      onToggle={() => toggleModel(model)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {filteredModels.length === 0 && (
            <div className="rounded-2xl border border-dashed border-[var(--marble-300)] px-6 py-12 text-center text-[var(--slate-500)]">
              找不到符合條件的模型，請調整關鍵字或篩選條件。
            </div>
          )}
        </div>

        <div className="sticky bottom-4 mt-8">
          <div className="glass-panel rounded-[1.75rem] p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-3">
                <div className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--slate-500)]">準備開始</div>
                <div className="flex flex-wrap gap-2">
                  {selectedModels.length > 0 ? (
                    selectedModels.map((model) => (
                      <span
                        key={model.id}
                        className="rounded-full bg-white/80 px-3 py-2 text-sm text-[var(--slate-700)]"
                      >
                        {model.name}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-[var(--slate-500)]">尚未選擇模型</span>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setSelectedModels([])}
                  className="soft-button rounded-2xl px-5 py-3 text-sm font-medium"
                >
                  清空選擇
                </button>
                <button
                  type="button"
                  onClick={handleStart}
                  disabled={selectedModels.length < ARENA_CONFIG.minModelsPerRound}
                  className={`metal-button rounded-2xl px-6 py-3 text-sm font-semibold tracking-[0.08em] text-white ${
                    selectedModels.length < ARENA_CONFIG.minModelsPerRound ? 'cursor-not-allowed opacity-50' : ''
                  }`}
                >
                  進入{ARENA_MODE_LABELS[state.arenaMode]}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ModelCardProps {
  model: AIModel;
  isSelected: boolean;
  onToggle: () => void;
}

function ModelCard({ model, isSelected, onToggle }: ModelCardProps) {
  const speedTone =
    model.speed === 'fast'
      ? 'bg-[rgba(24,172,126,0.1)] text-[var(--emerald-700)]'
      : model.speed === 'medium'
      ? 'bg-[rgba(232,179,73,0.18)] text-[var(--gold-600)]'
      : model.speed === 'slow'
      ? 'bg-[var(--rose-100)] text-[var(--rose-500)]'
      : 'bg-[var(--marble-100)] text-[var(--slate-500)]';

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`marble-card w-full rounded-[1.5rem] p-5 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(36,28,18,0.12)] ${
        isSelected
          ? 'ring-2 ring-[var(--emerald-500)] shadow-[0_18px_36px_rgba(14,109,83,0.14)]'
          : 'hover:ring-1 hover:ring-[rgba(24,172,126,0.26)]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold leading-tight text-[var(--slate-900)]">{model.name}</h3>
            <span className="rounded-full bg-[var(--marble-100)] px-2.5 py-1 text-xs text-[var(--slate-500)]">
              {model.provider}
            </span>
            {model.serverLabel && (
              <span className="rounded-full bg-[var(--slate-900)]/5 px-2.5 py-1 text-xs text-[var(--slate-600)]">
                {model.serverLabel}
              </span>
            )}
            {model.speed && (
              <span className={`rounded-full px-2.5 py-1 text-xs ${speedTone}`}>
                {MODEL_SPEED_LABELS[model.speed]}
              </span>
            )}
            {isSelected && (
              <span className="rounded-full bg-[var(--emerald-500)] px-2.5 py-1 text-xs text-white">
                已選擇
              </span>
            )}
          </div>
          <p className="text-sm leading-7 text-[var(--slate-600)]">{model.description}</p>
        </div>
        <div
          className={`ml-4 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all ${
            isSelected
              ? 'border-[var(--emerald-500)] bg-[var(--emerald-500)]'
              : 'border-[var(--marble-300)]'
          }`}
        >
          {isSelected && (
            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      </div>
    </button>
  );
}
