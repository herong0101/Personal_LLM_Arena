'use client';

import { useEffect, useMemo, useState } from 'react';
import { ARENA_CONFIG, ARENA_MODE_LABELS, AVAILABLE_MODELS, MODEL_SPEED_LABELS } from '@/config/models';
import { useArena } from '@/context/ArenaContext';
import { AIModel, ModelSource } from '@/types';

type SourceFilter = 'all' | ModelSource;

interface ServerHealth {
  label: string;
  online: boolean;
}

const PRESETS = [
  { label: '雲端基準', ids: ['gpt-5.4', 'gemini-3.1-pro-preview', 'claude-sonnet-4-6'] },
  { label: '地端快速', ids: ['local-ollama-5090-ministral-3-14b', 'local-ollama-5090-gemma3-27b', 'local-ollama-5090-gpt-oss-20b'] },
  { label: '醫療題材', ids: ['gpt-5.4', 'claude-sonnet-4-6', 'local-ollama-5090-medgemma-1.5-4b'] },
];

function cloneModel(model: AIModel): AIModel {
  return {
    ...model,
    orchestration: model.orchestration
      ? JSON.parse(JSON.stringify(model.orchestration)) as AIModel['orchestration']
      : undefined,
  };
}

export default function ModelSelection() {
  const { dispatch, startSession, state } = useArena();
  const [selectedModels, setSelectedModels] = useState<AIModel[]>([]);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [serverHealth, setServerHealth] = useState<ServerHealth[] | null>(null);

  const showLocalStatus =
    sourceFilter === 'local' || selectedModels.some((model) => model.source === 'local');

  useEffect(() => {
    if (!showLocalStatus || serverHealth) {
      return;
    }

    let active = true;
    fetch('/api/health')
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('health check failed'))))
      .then((data: { servers?: ServerHealth[] }) => {
        if (active && Array.isArray(data.servers)) {
          setServerHealth(data.servers);
        }
      })
      .catch(() => {
        if (active) {
          setServerHealth([]);
        }
      });

    return () => {
      active = false;
    };
  }, [showLocalStatus, serverHealth]);

  const models = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return AVAILABLE_MODELS
      .filter((model) => model.available && model.capabilities?.includes('chat'))
      .filter((model) => sourceFilter === 'all' || model.source === sourceFilter)
      .filter((model) => {
        if (!keyword) return true;
        return [model.name, model.provider, model.description, model.serverLabel]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(keyword);
      });
  }, [query, sourceFilter]);

  const toggleModel = (model: AIModel) => {
    setError(null);
    setSelectedModels((current) => {
      if (current.some((item) => item.id === model.id)) {
        return current.filter((item) => item.id !== model.id);
      }
      if (current.length >= ARENA_CONFIG.maxModelsPerRound) {
        setError(`最多選擇 ${ARENA_CONFIG.maxModelsPerRound} 個模型`);
        return current;
      }
      return [...current, cloneModel(model)];
    });
  };

  const applyPreset = (ids: string[]) => {
    const presetModels = ids
      .map((id) => AVAILABLE_MODELS.find((model) => model.id === id))
      .filter((model): model is AIModel => Boolean(model))
      .map(cloneModel)
      .slice(0, ARENA_CONFIG.maxModelsPerRound);
    setSelectedModels(presetModels);
    setSourceFilter('all');
    setQuery('');
    setError(null);
  };

  const handleStart = () => {
    if (selectedModels.length < ARENA_CONFIG.minModelsPerRound) {
      setError(`請至少選擇 ${ARENA_CONFIG.minModelsPerRound} 個模型`);
      return;
    }
    startSession(selectedModels);
  };

  return (
    <div className="flex h-full flex-col bg-[var(--background)]">
      <header className="border-b border-[var(--border-soft)] bg-white px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_PHASE', payload: 'landing' })}
            aria-label="返回比較方式"
            className="rounded-full p-2 text-[var(--slate-500)] hover:bg-[var(--surface-muted)] hover:text-[var(--slate-900)]"
            title="返回"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="min-w-0 flex-1 text-center">
            <div className="truncate text-sm font-semibold text-[var(--slate-900)]">選擇模型</div>
            <div className="truncate text-xs text-[var(--slate-500)]">{ARENA_MODE_LABELS[state.arenaMode]}</div>
          </div>
          <button
            type="button"
            onClick={handleStart}
            disabled={selectedModels.length < ARENA_CONFIG.minModelsPerRound}
            className="rounded-full bg-[var(--slate-900)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-35"
          >
            開始
          </button>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-3xl font-semibold tracking-[-0.02em] text-[var(--slate-900)]">選 1 到 3 個模型</h1>
            <p className="mt-3 text-sm leading-7 text-[var(--slate-500)]">模型越少越快，盲測建議選定位接近的模型。</p>
          </div>

          <div className="sticky top-0 z-10 mt-8 space-y-3 bg-[#f7f7f4]/95 pb-4 backdrop-blur">
            <div className="mx-auto flex max-w-3xl items-center rounded-full border border-[var(--border-soft)] bg-white px-4 py-3">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜尋模型"
                className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--slate-400)]"
              />
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              {[
                { value: 'all' as const, label: '全部' },
                { value: 'cloud' as const, label: '雲端' },
                { value: 'local' as const, label: '地端' },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setSourceFilter(item.value)}
                  className={`rounded-full px-4 py-2 text-sm ${
                    sourceFilter === item.value
                      ? 'bg-[var(--slate-900)] text-white'
                      : 'bg-white text-[var(--slate-600)] hover:text-[var(--slate-900)]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyPreset(preset.ids)}
                  className="rounded-full bg-white px-4 py-2 text-sm text-[var(--slate-600)] hover:text-[var(--emerald-700)]"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="mx-auto mt-2 max-w-3xl rounded-2xl bg-[var(--rose-100)] px-4 py-3 text-sm text-[var(--rose-500)]">
              {error}
            </div>
          )}

          {showLocalStatus && (
            <div className="mx-auto mt-2 max-w-3xl rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-[var(--slate-700)]">地端推論伺服器</span>
                {serverHealth === null && (
                  <span className="text-xs text-[var(--slate-400)]">檢查中…</span>
                )}
              </div>
              {serverHealth && serverHealth.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5">
                  {serverHealth.map((server) => (
                    <span key={server.label} className="inline-flex items-center gap-1.5 text-xs">
                      <span
                        aria-hidden="true"
                        className={`h-2 w-2 rounded-full ${
                          server.online ? 'bg-[var(--emerald-500)]' : 'bg-[var(--rose-500)]'
                        }`}
                      />
                      <span className="text-[var(--slate-600)]">{server.label}</span>
                      <span className={server.online ? 'text-[var(--emerald-700)]' : 'text-[var(--rose-500)]'}>
                        {server.online ? '在線' : '離線'}
                      </span>
                    </span>
                  ))}
                </div>
              ) : null}
              <p className="mt-2 text-xs leading-5 text-[var(--slate-500)]">
                {serverHealth && serverHealth.length > 0 && serverHealth.every((server) => !server.online)
                  ? '目前所有地端伺服器皆無法連線，這些模型暫時不會回應；建議改用雲端模型。'
                  : '離線的伺服器其模型暫時無法回應，建議改用雲端模型或其他在線伺服器。'}
              </p>
            </div>
          )}

          <div className="mx-auto mt-4 max-w-3xl divide-y divide-[var(--border-soft)] rounded-[1.5rem] bg-white">
            {models.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <div className="text-sm font-semibold text-[var(--slate-800)]">找不到符合條件的模型</div>
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setSourceFilter('all');
                  }}
                  className="mt-3 text-sm font-medium text-[var(--emerald-700)] hover:text-[var(--emerald-800)]"
                >
                  清除搜尋與篩選
                </button>
              </div>
            ) : models.map((model) => {
              const selected = selectedModels.some((item) => item.id === model.id);
              return (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => toggleModel(model)}
                  className="flex w-full items-center gap-4 px-4 py-4 text-left hover:bg-[var(--background)]"
                >
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                    selected ? 'border-[var(--slate-900)] bg-[var(--slate-900)]' : 'border-[var(--border-soft)] bg-white'
                  }`}>
                    {selected && <span className="h-2 w-2 rounded-full bg-white" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-[var(--slate-900)]">{model.name}</span>
                    <span className="mt-1 block truncate text-xs text-[var(--slate-500)]">
                      {model.provider}
                      {model.serverLabel ? ` · ${model.serverLabel}` : ''}
                      {model.speed ? ` · ${MODEL_SPEED_LABELS[model.speed]}` : ''}
                      {model.isArenaSpecial ? ' · 多模型編排' : ''}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-[var(--surface-muted)] px-3 py-1 text-xs text-[var(--slate-500)]">
                    {model.source === 'local' ? '地端' : '雲端'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </main>

      <footer className="border-t border-[var(--border-soft)] bg-white px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex flex-wrap gap-2">
            {selectedModels.length === 0 ? (
              <span className="text-sm text-[var(--slate-500)]">尚未選擇模型</span>
            ) : (
              selectedModels.map((model) => (
                <span key={model.id} className="rounded-full bg-[var(--surface-muted)] px-3 py-2 text-xs text-[var(--slate-700)]">
                  {model.name}
                </span>
              ))
            )}
          </div>
          <span className="text-xs text-[var(--slate-500)]">
            {selectedModels.length}/{ARENA_CONFIG.maxModelsPerRound}
          </span>
        </div>
      </footer>
    </div>
  );
}
