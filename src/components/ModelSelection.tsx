'use client';

import { useState } from 'react';
import { useArena } from '@/context/ArenaContext';
import { AVAILABLE_MODELS, ARENA_CONFIG } from '@/config/models';
import { AIModel } from '@/types';

export default function ModelSelection() {
  const { dispatch, startSession } = useArena();
  const [selectedModels, setSelectedModels] = useState<AIModel[]>([]);
  const [error, setError] = useState<string | null>(null);

  const availableModels = AVAILABLE_MODELS.filter((m) => m.available);

  const toggleModel = (model: AIModel) => {
    setError(null);

    if (selectedModels.find((m) => m.id === model.id)) {
      // Remove model
      setSelectedModels(selectedModels.filter((m) => m.id !== model.id));
    } else {
      // Add model if under limit
      if (selectedModels.length >= ARENA_CONFIG.maxModelsPerRound) {
        setError(`最多只能選擇 ${ARENA_CONFIG.maxModelsPerRound} 個模型`);
        return;
      }
      setSelectedModels([...selectedModels, model]);
    }
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

  // Group models by provider
  const modelsByProvider = availableModels.reduce((acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  }, {} as Record<string, AIModel[]>);

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10 animate-fade-in">
          <button
            onClick={handleBack}
            className="absolute top-8 left-8 flex items-center gap-2 text-[var(--slate-600)] hover:text-[var(--emerald-600)] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            返回
          </button>

          <h1 className="font-['Cinzel',serif] text-4xl md:text-5xl font-bold stone-text mb-4">
            選擇參戰模型
          </h1>
          <p className="text-[var(--slate-600)] text-lg">
            選擇 1 至 {ARENA_CONFIG.maxModelsPerRound} 個 AI 模型進行盲測對決
          </p>
        </div>

        {/* Selection indicator */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center gap-3 bg-white rounded-full px-6 py-3 shadow-md border border-[var(--marble-200)]">
            <span className="text-[var(--slate-600)]">已選擇</span>
            <div className="flex gap-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                    i <= selectedModels.length
                      ? 'bg-[var(--emerald-500)] text-white'
                      : 'bg-[var(--marble-200)] text-[var(--slate-400)]'
                  }`}
                >
                  {i}
                </div>
              ))}
            </div>
            <span className="text-[var(--slate-600)]">個模型</span>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="max-w-md mx-auto mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-center animate-fade-in">
            {error}
          </div>
        )}

        {/* Model grid by provider */}
        <div className="space-y-8">
          {Object.entries(modelsByProvider).map(([provider, models]) => (
            <div key={provider} className="animate-fade-in">
              <h2 className="font-['Cinzel',serif] text-xl font-semibold text-[var(--slate-700)] mb-4 flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-[var(--emerald-500)]" />
                {provider}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

        {/* Action buttons */}
        <div className="flex justify-center mt-10">
          <button
            onClick={handleStart}
            disabled={selectedModels.length < ARENA_CONFIG.minModelsPerRound}
            className={`metal-button text-white font-['Cinzel',serif] text-lg px-10 py-3 rounded-lg 
                       tracking-wider transition-all duration-300 ${
                         selectedModels.length < ARENA_CONFIG.minModelsPerRound
                           ? 'opacity-50 cursor-not-allowed'
                           : ''
                       }`}
          >
            進入競技場
          </button>
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
  return (
    <button
      onClick={onToggle}
      className={`marble-card rounded-xl p-5 text-left w-full transition-all duration-300 hover:shadow-lg ${
        isSelected
          ? 'ring-2 ring-[var(--emerald-500)] shadow-lg'
          : 'hover:ring-1 hover:ring-[var(--emerald-300)]'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-semibold text-[var(--slate-800)] text-lg">{model.name}</h3>
            {isSelected && (
              <span className="bg-[var(--emerald-500)] text-white text-xs px-2 py-0.5 rounded-full">
                已選擇
              </span>
            )}
          </div>
          <p className="text-sm text-[var(--slate-600)] leading-relaxed">{model.description}</p>
        </div>
        <div
          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ml-4 transition-all ${
            isSelected
              ? 'border-[var(--emerald-500)] bg-[var(--emerald-500)]'
              : 'border-[var(--marble-300)]'
          }`}
        >
          {isSelected && (
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      </div>
    </button>
  );
}
