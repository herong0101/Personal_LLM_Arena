'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import { ARENA_CONFIG, ARENA_MODE_LABELS, AVAILABLE_MODELS, MODEL_SPEED_LABELS } from '@/config/models';
import { useArena } from '@/context/ArenaContext';
import { AIModel, ArenaOrchestrationConfig, ModelSource } from '@/types';

type SourceFilter = 'all' | ModelSource;

const QUICK_PRESETS = [
  {
    label: '雲端基準組',
    description: '用主流雲端模型快速建立基準線。',
    modelIds: ['gpt-5.4', 'gemini-3.1-pro-preview', 'claude-sonnet-4-6'],
  },
  {
    label: '地端快速組',
    description: '用回覆較快的本地模型先測一輪。',
    modelIds: [
      'local-ollama-5090-ministral-3-14b',
      'local-ollama-4090-breeze-7b-instruct-v1-0',
      'local-ollama-5090-gpt-oss-20b',
    ],
  },
  {
    label: '醫療題材組',
    description: '適合先測醫療與保險相關題目。',
    modelIds: [
      'gpt-5.4',
      'claude-sonnet-4-6',
      'local-ollama-5090-medgemma-1.5-4b',
    ],
  },
];

function cloneOrchestration(orchestration?: ArenaOrchestrationConfig): ArenaOrchestrationConfig | undefined {
  if (!orchestration) {
    return undefined;
  }

  if (orchestration.kind === 'expert-discussion') {
    return {
      ...orchestration,
      memberModelIds: [...orchestration.memberModelIds],
    };
  }

  if (orchestration.kind === 'pressure-test') {
    return {
      ...orchestration,
      attackerModelIds: [...orchestration.attackerModelIds],
    };
  }

  return { ...orchestration };
}

function cloneModel(model: AIModel): AIModel {
  return {
    ...model,
    orchestration: cloneOrchestration(model.orchestration),
  };
}

function isSpecialArenaModel(model: AIModel): boolean {
  return Boolean(model.isArenaSpecial && model.orchestration);
}

function getSpecialModelValidationError(model: AIModel, cloudModelIds: Set<string>): string | null {
  if (!model.orchestration) {
    return null;
  }

  if (model.orchestration.kind === 'expert-discussion') {
    const memberIds = model.orchestration.memberModelIds;

    if (memberIds.length !== 3 || memberIds.some((id) => !cloudModelIds.has(id))) {
      return `${model.name} 需要 3 個有效的雲端成員模型。`;
    }

    if (new Set(memberIds).size !== 3) {
      return `${model.name} 的 3 個成員模型必須互不重複。`;
    }

    if (!cloudModelIds.has(model.orchestration.synthesisModelId)) {
      return `${model.name} 需要 1 個有效的雲端統整模型。`;
    }

    return null;
  }

  if (model.orchestration.kind === 'pressure-test') {
    const attackerIds = model.orchestration.attackerModelIds;

      if (!cloudModelIds.has(model.orchestration.targetModelId)) {
        return `${model.name} 需要 1 個有效的受測雲端模型。`;
      }

      if (attackerIds.length !== 2 || attackerIds.some((id) => !cloudModelIds.has(id))) {
        return `${model.name} 需要 2 個有效的攻擊雲端模型。`;
      }





    return null;
  }

  const { propositionModelId, oppositionModelId, judgeModelId } = model.orchestration;

  if (!cloudModelIds.has(propositionModelId) || !cloudModelIds.has(oppositionModelId) || !cloudModelIds.has(judgeModelId)) {
    return `${model.name} 的正方、反方與裁判都必須是有效的雲端模型。`;
  }


  return null;
}

export default function ModelSelection() {
  const { dispatch, startSession, state } = useArena();
  const [selectedModels, setSelectedModels] = useState<AIModel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSpecialModelId, setActiveSpecialModelId] = useState<string | null>(null);

  const availableModels = AVAILABLE_MODELS.filter(
    (model) => model.available && model.capabilities?.includes('chat')
  );
  const cloudModels = AVAILABLE_MODELS.filter(
    (model) =>
      model.available &&
      model.source === 'cloud' &&
      model.capabilities?.includes('chat') &&
      !model.isArenaSpecial
  );
  const cloudModelIds = new Set(cloudModels.map((model) => model.id));
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const modeDescription =
    state.arenaMode === 'blind'
      ? '回答會先匿名顯示，且會等全部模型完成後再同步公布；送出排名後才揭露模型身份。'
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

  const activeSpecialModel =
    selectedModels.find((model) => model.id === activeSpecialModelId && isSpecialArenaModel(model)) ?? null;

  const toggleModel = (model: AIModel) => {
    setError(null);

    if (selectedModels.find((m) => m.id === model.id)) {
      if (activeSpecialModelId === model.id) {
        setActiveSpecialModelId(null);
      }
      setSelectedModels(selectedModels.filter((m) => m.id !== model.id));
      return;
    }

    if (selectedModels.length >= ARENA_CONFIG.maxModelsPerRound) {
      setError(`最多只能選擇 ${ARENA_CONFIG.maxModelsPerRound} 個模型`);
      return;
    }

    const nextModel = cloneModel(model);
    setSelectedModels([...selectedModels, nextModel]);

    if (isSpecialArenaModel(nextModel)) {
      setActiveSpecialModelId(nextModel.id);
    }
  };

  const applyPreset = (modelIds: string[]) => {
    const models = modelIds
      .map((id) => availableModels.find((model) => model.id === id))
      .filter((model): model is AIModel => Boolean(model))
      .map(cloneModel)
      .slice(0, ARENA_CONFIG.maxModelsPerRound);

    setSelectedModels(models);
    setActiveSpecialModelId(models.find(isSpecialArenaModel)?.id ?? null);
    setError(null);
  };

  const updateSelectedModel = (modelId: string, updater: (model: AIModel) => AIModel) => {
    setSelectedModels((current) =>
      current.map((model) => (model.id === modelId ? updater(model) : model))
    );
    setError(null);
  };

  const updateExpertMember = (modelId: string, memberIndex: number, nextMemberModelId: string) => {
    updateSelectedModel(modelId, (model) => {
      if (model.orchestration?.kind !== 'expert-discussion') {
        return model;
      }

      const nextMembers = [...model.orchestration.memberModelIds];
      nextMembers[memberIndex] = nextMemberModelId;

      return {
        ...model,
        orchestration: {
          ...model.orchestration,
          memberModelIds: nextMembers,
        },
      };
    });
  };

  const updateExpertSynthesis = (modelId: string, nextSynthesisModelId: string) => {
    updateSelectedModel(modelId, (model) => {
      if (model.orchestration?.kind !== 'expert-discussion') {
        return model;
      }

      return {
        ...model,
        orchestration: {
          ...model.orchestration,
          synthesisModelId: nextSynthesisModelId,
        },
      };
    });
  };

  const updateDebateField = (
    modelId: string,
    field: 'propositionModelId' | 'oppositionModelId' | 'judgeModelId',
    nextValue: string
  ) => {
    updateSelectedModel(modelId, (model) => {
      if (model.orchestration?.kind !== 'debate') {
        return model;
      }

      return {
        ...model,
        orchestration: {
          ...model.orchestration,
          [field]: nextValue,
        },
      };
    });
  };

  const updatePressureTestField = (
    modelId: string,
    field: 'targetModelId' | 'attackerModelIds',
    nextValue: string,
    attackerIndex?: number
  ) => {
    updateSelectedModel(modelId, (model) => {
      if (model.orchestration?.kind !== 'pressure-test') {
        return model;
      }

      if (field === 'targetModelId') {
        return {
          ...model,
          orchestration: {
            ...model.orchestration,
            targetModelId: nextValue,
          },
        };
      }

      const nextAttackers = [...model.orchestration.attackerModelIds];
      nextAttackers[attackerIndex ?? 0] = nextValue;

      return {
        ...model,
        orchestration: {
          ...model.orchestration,
          attackerModelIds: nextAttackers,
        },
      };
    });
  };

  const handleBack = () => {
    dispatch({ type: 'SET_PHASE', payload: 'landing' });
  };

  const openSpecialModelConfigurator = (modelId: string) => {
    setActiveSpecialModelId(modelId);
    setError(null);
  };

  const closeSpecialModelConfigurator = () => {
    setActiveSpecialModelId(null);
  };

  const handleStart = () => {
    if (selectedModels.length < ARENA_CONFIG.minModelsPerRound) {
      setError(`請至少選擇 ${ARENA_CONFIG.minModelsPerRound} 個模型`);
      return;
    }

    const configurationError = selectedModels
      .map((model) => getSpecialModelValidationError(model, cloudModelIds))
      .find((message): message is string => Boolean(message));

    if (configurationError) {
      setError(configurationError);
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
                      <div
                        key={model.id}
                        className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-2 text-sm text-[var(--slate-700)]"
                      >
                        {model.name}
                        {isSpecialArenaModel(model) && (
                          <button
                            type="button"
                            onClick={() => openSpecialModelConfigurator(model.id)}
                            className="rounded-full bg-[rgba(59,130,246,0.12)] px-2.5 py-1 text-xs font-medium text-[var(--sky-700)] transition-colors hover:bg-[rgba(59,130,246,0.18)]"
                          >
                            設定角色
                          </button>
                        )}
                      </div>
                    ))
                  ) : (
                    <span className="text-sm text-[var(--slate-500)]">尚未選擇模型</span>
                  )}
                </div>
                {error && (
                  <div className="rounded-2xl border border-[rgba(213,109,85,0.22)] bg-[var(--rose-100)] px-4 py-3 text-sm text-[var(--rose-500)] animate-fade-in">
                    {error}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedModels([]);
                    setActiveSpecialModelId(null);
                  }}
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

      {activeSpecialModel && (
        <SpecialModelModal
          model={activeSpecialModel}
          cloudModels={cloudModels}
          onClose={closeSpecialModelConfigurator}
          onExpertMemberChange={updateExpertMember}
          onExpertSynthesisChange={updateExpertSynthesis}
          onPressureTestFieldChange={updatePressureTestField}
          onDebateFieldChange={updateDebateField}
        />
      )}
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
            {model.isArenaSpecial && (
              <span className="rounded-full bg-[rgba(59,130,246,0.12)] px-2.5 py-1 text-xs text-[var(--sky-700)]">
                多模型編排
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

interface SpecialModelConfiguratorProps {
  model: AIModel;
  cloudModels: AIModel[];
  onExpertMemberChange: (modelId: string, memberIndex: number, nextMemberModelId: string) => void;
  onExpertSynthesisChange: (modelId: string, nextSynthesisModelId: string) => void;
  onPressureTestFieldChange: (
    modelId: string,
    field: 'targetModelId' | 'attackerModelIds',
    nextValue: string,
    attackerIndex?: number
  ) => void;
  onDebateFieldChange: (
    modelId: string,
    field: 'propositionModelId' | 'oppositionModelId' | 'judgeModelId',
    nextValue: string
  ) => void;
}

function SpecialModelConfigurator({
  model,
  cloudModels,
  onExpertMemberChange,
  onExpertSynthesisChange,
  onPressureTestFieldChange,
  onDebateFieldChange,
}: SpecialModelConfiguratorProps) {
  if (!model.orchestration) {
    return null;
  }

  return (
    <div className="rounded-[1.75rem] border border-[rgba(59,130,246,0.14)] bg-[rgba(247,250,255,0.96)] p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--sky-700)]">特殊模型設定</div>
          <h3 className="mt-2 font-serif text-2xl font-semibold text-[var(--slate-900)]">{model.name}</h3>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--slate-600)]">{model.description}</p>
        </div>
      </div>

      {model.orchestration.kind === 'expert-discussion' ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {model.orchestration.memberModelIds.map((memberModelId, index) => (
            <ModelSelectField
              key={`${model.id}-member-${index}`}
              label={`專家成員 ${index + 1}`}
              value={memberModelId}
              models={cloudModels}
              helper="三位成員會先平行分析，再交給統整者合併成單一答案。"
              onChange={(nextValue) => onExpertMemberChange(model.id, index, nextValue)}
            />
          ))}
          <ModelSelectField
            label="統整者"
            value={model.orchestration.synthesisModelId}
            models={cloudModels}
            helper="統整者可以與前面三位成員重複。"
            onChange={(nextValue) => onExpertSynthesisChange(model.id, nextValue)}
          />
        </div>
      ) : model.orchestration.kind === 'pressure-test' ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <ModelSelectField
            label="受測模型"
            value={model.orchestration.targetModelId}
            models={cloudModels}
            helper="先由這個模型給出原始答案，最後也由它重新審視是否改變立場。"
            onChange={(nextValue) => onPressureTestFieldChange(model.id, 'targetModelId', nextValue)}
          />
          {model.orchestration.attackerModelIds.map((attackerModelId, index) => (
            <ModelSelectField
              key={`${model.id}-attacker-${index}`}
              label={`攻擊者 ${index + 1}`}
              value={attackerModelId}
              models={cloudModels}
              helper="這個角色會自稱專家或高壓審查者，專門挑戰受測模型，也可以與其他角色重複。"
              onChange={(nextValue) =>
                onPressureTestFieldChange(model.id, 'attackerModelIds', nextValue, index)
              }
            />
          ))}
        </div>
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <ModelSelectField
            label="正方模型"
            value={model.orchestration.propositionModelId}
            models={cloudModels}
            helper="先提出原始主張。"
            onChange={(nextValue) => onDebateFieldChange(model.id, 'propositionModelId', nextValue)}
          />
          <ModelSelectField
            label="反方模型"
            value={model.orchestration.oppositionModelId}
            models={cloudModels}
            helper="必須扮演質疑與反對者，也可以與正方使用相同模型。"
            onChange={(nextValue) => onDebateFieldChange(model.id, 'oppositionModelId', nextValue)}
          />
          <ModelSelectField
            label="裁判模型"
            value={model.orchestration.judgeModelId}
            models={cloudModels}
            helper="最後判定哪一方較有道理並整理成最終答案。"
            onChange={(nextValue) => onDebateFieldChange(model.id, 'judgeModelId', nextValue)}
          />
        </div>
      )}
    </div>
  );
}

interface SpecialModelModalProps extends SpecialModelConfiguratorProps {
  onClose: () => void;
}

function SpecialModelModal({
  model,
  cloudModels,
  onClose,
  onExpertMemberChange,
  onExpertSynthesisChange,
  onPressureTestFieldChange,
  onDebateFieldChange,
}: SpecialModelModalProps) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[rgba(17,24,39,0.34)] px-4 py-6 backdrop-blur-[2px]">
      <button
        type="button"
        aria-label="關閉特殊模型設定"
        onClick={onClose}
        className="absolute inset-0"
      />
      <div className="relative z-10 w-full max-w-4xl">
        <div className="glass-panel rounded-[2rem] p-5 shadow-[0_30px_80px_rgba(17,24,39,0.18)] sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--sky-700)]">角色設定</div>
              <h2 className="mt-2 font-serif text-3xl font-semibold text-[var(--slate-900)]">{model.name}</h2>
              <p className="mt-2 text-sm leading-7 text-[var(--slate-600)]">
                選擇每個角色要由哪個雲端模型擔任。設定完成後，此特殊模式會像單一模型一樣參與競技場。
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="soft-button rounded-full px-4 py-2 text-sm font-medium"
            >
              完成
            </button>
          </div>

          <SpecialModelConfigurator
            model={model}
            cloudModels={cloudModels}
            onExpertMemberChange={onExpertMemberChange}
            onExpertSynthesisChange={onExpertSynthesisChange}
            onPressureTestFieldChange={onPressureTestFieldChange}
            onDebateFieldChange={onDebateFieldChange}
          />

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="metal-button rounded-2xl px-6 py-3 text-sm font-semibold text-white"
            >
              套用設定
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ModelSelectFieldProps {
  label: string;
  value: string;
  models: AIModel[];
  helper: string;
  onChange: (nextValue: string) => void;
}

function ModelSelectField({ label, value, models, helper, onChange }: ModelSelectFieldProps) {
  return (
    <label className="block rounded-[1.5rem] border border-[var(--border-soft)] bg-white/88 p-4">
      <div className="text-sm font-semibold text-[var(--slate-800)]">{label}</div>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-3 w-full rounded-2xl border border-[var(--marble-300)] bg-white px-4 py-3 text-sm text-[var(--slate-700)] focus:outline-none focus:ring-2 focus:ring-[var(--emerald-400)]"
      >
        {models.map((model) => (
          <option key={model.id} value={model.id}>
            {model.name}
          </option>
        ))}
      </select>
      <div className="mt-2 text-xs leading-6 text-[var(--slate-500)]">{helper}</div>
    </label>
  );
}
