'use client';

import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AIModel, ArenaMode, ModelResponse, RankingResult } from '@/types';

interface RankingPanelProps {
  responses: ModelResponse[];
  models: AIModel[];
  mode: ArenaMode;
  onSubmit: (rankings: RankingResult[]) => void;
}

export default function RankingPanel({ responses, models, mode, onSubmit }: RankingPanelProps) {
  const [items, setItems] = useState(responses.map((response) => response.modelId));
  const [useDropdown, setUseDropdown] = useState(false);
  const [dropdownRankings, setDropdownRankings] = useState<Record<string, number>>({});
  const [inlineError, setInlineError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setItems((currentItems) => {
        const oldIndex = currentItems.indexOf(active.id as string);
        const newIndex = currentItems.indexOf(over.id as string);
        return arrayMove(currentItems, oldIndex, newIndex);
      });
      setInlineError(null);
    }
  };

  const handleDropdownChange = (modelId: string, rank: number) => {
    const newRankings = { ...dropdownRankings };

    Object.keys(newRankings).forEach((key) => {
      if (newRankings[key] === rank) {
        delete newRankings[key];
      }
    });

    if (rank > 0) {
      newRankings[modelId] = rank;
    } else {
      delete newRankings[modelId];
    }

    setDropdownRankings(newRankings);
    setInlineError(null);
  };

  const getResponseLabel = (response: ModelResponse) => {
    if (mode === 'blind') {
      return response.blindName;
    }

    return models.find((model) => model.id === response.modelId)?.name ?? response.modelId;
  };

  const handleSubmit = () => {
    let rankings: RankingResult[];

    if (useDropdown) {
      if (Object.keys(dropdownRankings).length !== responses.length) {
        setInlineError('請先為所有模型指定排名，再送出結果。');
        return;
      }

      rankings = responses.map((response) => ({
        modelId: response.modelId,
        blindName: response.blindName,
        rank: dropdownRankings[response.modelId],
      }));
    } else {
      rankings = items.map((modelId, index) => {
        const response = responses.find((item) => item.modelId === modelId)!;

        return {
          modelId: response.modelId,
          blindName: response.blindName,
          rank: index + 1,
        };
      });
    }

    onSubmit(rankings);
  };

  const isSubmitDisabled = useDropdown && Object.keys(dropdownRankings).length !== responses.length;

  return (
    <div className="marble-card rounded-[1.75rem] p-6 sm:p-7">
      <div className="mb-6 text-center">
        <h3 className="mb-2 font-serif text-2xl font-semibold text-[var(--slate-900)]">排名投票</h3>
        <p className="text-sm leading-7 text-[var(--slate-600)]">
          根據回答品質，將模型從最佳到最差排序。送出後會立即揭曉模型身份。
        </p>
      </div>

      <div className="mb-5 flex justify-center gap-2">
        <button
          type="button"
          onClick={() => setUseDropdown(false)}
          className={`rounded-full px-4 py-2 text-sm transition-all ${
            !useDropdown
              ? 'bg-[var(--emerald-500)] text-white shadow-[0_12px_24px_rgba(14,109,83,0.18)]'
              : 'soft-button'
          }`}
        >
          拖曳排序
        </button>
        <button
          type="button"
          onClick={() => setUseDropdown(true)}
          className={`rounded-full px-4 py-2 text-sm transition-all ${
            useDropdown
              ? 'bg-[var(--emerald-500)] text-white shadow-[0_12px_24px_rgba(14,109,83,0.18)]'
              : 'soft-button'
          }`}
        >
          下拉選擇
        </button>
      </div>

      {useDropdown ? (
        <div className="mb-6 space-y-3">
          {responses.map((response) => (
            <div
              key={response.modelId}
              className="flex flex-col gap-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--marble-50)] p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="font-medium text-[var(--slate-700)]">{getResponseLabel(response)}</span>
              <select
                value={dropdownRankings[response.modelId] || ''}
                onChange={(event) => handleDropdownChange(response.modelId, parseInt(event.target.value, 10) || 0)}
                className="rounded-xl border border-[var(--marble-300)] bg-white px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--emerald-400)]"
              >
                <option value="">選擇排名</option>
                {responses.map((_, index) => {
                  const rank = index + 1;
                  const isUsed =
                    Object.values(dropdownRankings).includes(rank) && dropdownRankings[response.modelId] !== rank;

                  return (
                    <option key={rank} value={rank} disabled={isUsed}>
                      第 {rank} 名 {rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'}
                    </option>
                  );
                })}
              </select>
            </div>
          ))}
        </div>
      ) : (
        <div className="mb-6">
          <p className="mb-3 text-center text-xs text-[var(--slate-500)]">拖曳卡片調整順序，最上方為第一名</p>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={items} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {items.map((modelId, index) => {
                  const response = responses.find((item) => item.modelId === modelId)!;

                  return (
                    <SortableItem
                      key={modelId}
                      id={modelId}
                      label={getResponseLabel(response)}
                      rank={index + 1}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {inlineError && (
        <div className="mb-4 rounded-2xl border border-[rgba(213,109,85,0.22)] bg-[var(--rose-100)] px-4 py-3 text-sm text-[var(--rose-500)]">
          {inlineError}
        </div>
      )}

      <div className="flex justify-center">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitDisabled}
          className="metal-button rounded-2xl px-8 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          確認排名
        </button>
      </div>
    </div>
  );
}

interface SortableItemProps {
  id: string;
  label: string;
  rank: number;
}

function SortableItem({ id, label, rank }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const rankEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉';
  const rankBg =
    rank === 1
      ? 'bg-[var(--gold-500)]'
      : rank === 2
      ? 'bg-[var(--slate-400)]'
      : 'bg-[var(--gold-600)]';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`flex cursor-grab items-center gap-4 rounded-2xl border border-[var(--border-soft)] bg-white p-4 transition-shadow active:cursor-grabbing ${
        isDragging ? 'shadow-lg ring-2 ring-[var(--emerald-400)]' : 'hover:shadow-md'
      }`}
    >
      <div className={`flex h-10 w-10 items-center justify-center rounded-full ${rankBg} text-lg font-semibold text-white`}>
        {rank}
      </div>
      <span className="flex-1 font-medium text-[var(--slate-700)]">{label}</span>
      <span className="text-2xl">{rankEmoji}</span>
      <svg className="h-6 w-6 text-[var(--slate-400)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
      </svg>
    </div>
  );
}
