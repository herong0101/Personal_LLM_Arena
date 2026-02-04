'use client';

import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ModelResponse, RankingResult } from '@/types';

interface RankingPanelProps {
  responses: ModelResponse[];
  onSubmit: (rankings: RankingResult[]) => void;
}

export default function RankingPanel({ responses, onSubmit }: RankingPanelProps) {
  const [items, setItems] = useState(responses.map((r) => r.blindName));
  const [useDropdown, setUseDropdown] = useState(false);
  const [dropdownRankings, setDropdownRankings] = useState<Record<string, number>>({});

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleDropdownChange = (blindName: string, rank: number) => {
    const newRankings = { ...dropdownRankings };

    // Remove any existing assignment of this rank
    Object.keys(newRankings).forEach((key) => {
      if (newRankings[key] === rank) {
        delete newRankings[key];
      }
    });

    // Assign new rank
    if (rank > 0) {
      newRankings[blindName] = rank;
    } else {
      delete newRankings[blindName];
    }

    setDropdownRankings(newRankings);
  };

  const handleSubmit = () => {
    let rankings: RankingResult[];

    if (useDropdown) {
      // Validate all models have ranks
      if (Object.keys(dropdownRankings).length !== responses.length) {
        alert('請為所有模型指定排名');
        return;
      }

      rankings = responses.map((r) => ({
        modelId: r.modelId,
        blindName: r.blindName,
        rank: dropdownRankings[r.blindName],
      }));
    } else {
      // Use drag order
      rankings = items.map((blindName, index) => {
        const response = responses.find((r) => r.blindName === blindName)!;
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
    <div className="marble-card rounded-xl p-6">
      <div className="text-center mb-6">
        <h3 className="font-['Cinzel',serif] text-xl font-semibold text-[var(--slate-800)] mb-2">
          排名投票
        </h3>
        <p className="text-sm text-[var(--slate-600)]">
          根據回答品質，將模型從最佳到最差排序
        </p>
      </div>

      {/* Toggle between drag and dropdown */}
      <div className="flex justify-center gap-2 mb-6">
        <button
          onClick={() => setUseDropdown(false)}
          className={`px-4 py-2 rounded-lg text-sm transition-all ${
            !useDropdown
              ? 'bg-[var(--emerald-500)] text-white'
              : 'bg-[var(--marble-100)] text-[var(--slate-600)] hover:bg-[var(--marble-200)]'
          }`}
        >
          拖曳排序
        </button>
        <button
          onClick={() => setUseDropdown(true)}
          className={`px-4 py-2 rounded-lg text-sm transition-all ${
            useDropdown
              ? 'bg-[var(--emerald-500)] text-white'
              : 'bg-[var(--marble-100)] text-[var(--slate-600)] hover:bg-[var(--marble-200)]'
          }`}
        >
          下拉選擇
        </button>
      </div>

      {useDropdown ? (
        // Dropdown mode
        <div className="space-y-3 mb-6">
          {responses.map((response) => (
            <div
              key={response.blindName}
              className="flex items-center justify-between p-4 bg-[var(--marble-50)] rounded-lg border border-[var(--marble-200)]"
            >
              <span className="font-medium text-[var(--slate-700)]">{response.blindName}</span>
              <select
                value={dropdownRankings[response.blindName] || ''}
                onChange={(e) =>
                  handleDropdownChange(response.blindName, parseInt(e.target.value) || 0)
                }
                className="px-4 py-2 rounded-lg border border-[var(--marble-300)] bg-white 
                         focus:outline-none focus:ring-2 focus:ring-[var(--emerald-400)]"
              >
                <option value="">選擇排名</option>
                {responses.map((_, index) => {
                  const rank = index + 1;
                  const isUsed =
                    Object.values(dropdownRankings).includes(rank) &&
                    dropdownRankings[response.blindName] !== rank;
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
        // Drag mode
        <div className="mb-6">
          <p className="text-xs text-[var(--slate-500)] text-center mb-3">
            拖曳卡片調整順序，最上方為第一名
          </p>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={items} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {items.map((blindName, index) => (
                  <SortableItem key={blindName} id={blindName} rank={index + 1} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {/* Submit button */}
      <div className="flex justify-center">
        <button
          onClick={handleSubmit}
          disabled={isSubmitDisabled}
          className="metal-button text-white font-['Cinzel',serif] px-8 py-3 rounded-lg 
                   disabled:opacity-50 disabled:cursor-not-allowed"
        >
          確認排名
        </button>
      </div>
    </div>
  );
}

interface SortableItemProps {
  id: string;
  rank: number;
}

function SortableItem({ id, rank }: SortableItemProps) {
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
      className={`flex items-center gap-4 p-4 bg-white rounded-lg border border-[var(--marble-200)] 
                cursor-grab active:cursor-grabbing transition-shadow ${
                  isDragging ? 'shadow-lg ring-2 ring-[var(--emerald-400)]' : 'hover:shadow-md'
                }`}
    >
      <div
        className={`w-10 h-10 rounded-full ${rankBg} text-white flex items-center justify-center 
                   font-semibold text-lg`}
      >
        {rank}
      </div>
      <span className="font-medium text-[var(--slate-700)] flex-1">{id}</span>
      <span className="text-2xl">{rankEmoji}</span>
      <svg
        className="w-6 h-6 text-[var(--slate-400)]"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 8h16M4 16h16"
        />
      </svg>
    </div>
  );
}
