'use client';

import { PointerEvent as ReactPointerEvent, useMemo, useRef, useState } from 'react';
import { DndContext, DragEndEvent, useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { v4 as uuidv4 } from 'uuid';
import { AVAILABLE_MODELS } from '@/config/models';
import type { NoCodeGraphDefinition, NoCodeGraphEdge, NoCodeGraphRunResult, NoCodeGraphStep } from '@/types';
import PromptComposer from './PromptComposer';

const NODE_WIDTH = 220;
const NODE_HEIGHT = 88;

function createStep(index: number): NoCodeGraphStep {
  return {
    id: `node-${uuidv4().slice(0, 8)}`,
    label: `節點 ${index}`,
    modelId: 'gpt-5.2',
    promptTemplate: index === 1
      ? '請回答使用者需求：\n{{input}}'
      : '請根據上一個節點輸出繼續處理：\n{{previous}}',
    x: 80 + (index - 1) * 280,
    y: 120,
  };
}

function createInitialGraph() {
  const first = createStep(1);
  const second = createStep(2);
  return {
    steps: [first, second],
    edges: [{ id: `${first.id}-${second.id}`, from: first.id, to: second.id }],
  };
}

interface TemplateNode {
  label: string;
  modelId: string;
  prompt: string;
  x?: number;
  y?: number;
}

interface GraphTemplate {
  label: string;
  name: string;
  input: string;
  nodes: TemplateNode[];
  edges?: Array<[number, number]>;
}

// 一鍵載入的範例流程：使用雲端預設模型（離線環境也能跑），可展示線性 chain 與分支 graph。
const GRAPH_TEMPLATES: GraphTemplate[] = [
  {
    label: '翻譯 → 潤稿',
    name: '翻譯潤稿流程',
    input: '我們的產品能幫助中小企業把原本要花一整天的報表作業，縮短到三十分鐘內完成。',
    nodes: [
      { label: '翻成英文', modelId: 'gpt-5.2', prompt: '請將以下中文翻譯成自然流暢的英文，只輸出翻譯結果：\n{{input}}' },
      { label: '潤飾英文', modelId: 'gpt-5.2', prompt: '請潤飾以下英文，使語氣更專業地道，只輸出潤飾後的版本：\n{{previous}}' },
    ],
  },
  {
    label: '分支分析 → 匯流',
    name: 'Graph 分支決策分析',
    input: '我們是一間 20 人的新創，正在考慮是否要導入每月 3 萬元的客服 AI。',
    nodes: [
      { label: '成本分析', modelId: 'gpt-5.2', prompt: '請只從成本角度分析以下決策，列出一次性成本、每月成本、節省的人力與可能的隱性成本：\n{{input}}', x: 80, y: 70 },
      { label: '風險分析', modelId: 'gpt-5.2', prompt: '請只從風險角度分析以下決策，列出導入失敗、資料安全、客訴與營運中斷風險：\n{{input}}', x: 80, y: 210 },
      { label: '體驗分析', modelId: 'gpt-5.2', prompt: '請只從客戶與內部團隊體驗角度分析以下決策，列出可能改善與可能惡化之處：\n{{input}}', x: 80, y: 350 },
      { label: '匯流決策', modelId: 'gpt-5.2', prompt: '以下是多個平行分析節點的輸出。請整合它們，給主管一段明確建議，包含是否導入、三個月試行方式、成功指標與停止條件：\n{{previous}}', x: 430, y: 210 },
    ],
    edges: [
      [0, 3],
      [1, 3],
      [2, 3],
    ],
  },
  {
    label: '摘要 → 改寫 → 標題',
    name: '內容改寫流程',
    input: '（在這裡貼上一段文章或會議紀錄，流程會先摘要、再改寫成社群貼文、最後想標題）',
    nodes: [
      { label: '摘要重點', modelId: 'gpt-5.2', prompt: '請把以下內容濃縮成 3 到 5 個重點，條列輸出：\n{{input}}' },
      { label: '改寫成貼文', modelId: 'gpt-5.2', prompt: '請把以下重點改寫成一則親切、好讀的社群貼文：\n{{previous}}' },
      { label: '想三個標題', modelId: 'gpt-5.2', prompt: '請為以下貼文想三個吸睛標題，條列輸出：\n{{previous}}' },
    ],
  },
];

function buildTemplateGraph(template: GraphTemplate) {
  const steps: NoCodeGraphStep[] = template.nodes.map((node, index) => ({
    id: `node-${uuidv4().slice(0, 8)}`,
    label: node.label,
    modelId: node.modelId,
    promptTemplate: node.prompt,
    x: node.x ?? 80 + index * 280,
    y: node.y ?? 120,
  }));

  const templateEdges = template.edges ?? steps.slice(1).map((_, index) => [index, index + 1] as [number, number]);
  const edges: NoCodeGraphEdge[] = templateEdges.flatMap(([fromIndex, toIndex]) => {
    const from = steps[fromIndex];
    const to = steps[toIndex];
    return from && to ? [{ id: `${from.id}-${to.id}`, from: from.id, to: to.id }] : [];
  });

  return { steps, edges };
}

function centerOf(step: NoCodeGraphStep) {
  return {
    x: (step.x ?? 0) + NODE_WIDTH / 2,
    y: (step.y ?? 0) + NODE_HEIGHT / 2,
  };
}

function DraggableNode({
  step,
  isActive,
  onSelect,
  onConnectStart,
}: {
  step: NoCodeGraphStep;
  isActive: boolean;
  onSelect: () => void;
  onConnectStart: (event: ReactPointerEvent<HTMLButtonElement>) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: step.id });
  const style = {
    left: step.x ?? 0,
    top: step.y ?? 0,
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
    transform: CSS.Translate.toString(transform),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`absolute rounded-2xl border bg-white px-4 py-3 shadow-sm transition-shadow ${
        isActive ? 'border-[var(--emerald-500)] ring-4 ring-[rgba(24,172,126,0.12)]' : 'border-[var(--border-soft)]'
      } ${isDragging ? 'z-20 shadow-xl' : 'z-10'}`}
      onClick={onSelect}
    >
      <button
        type="button"
        className="absolute -right-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-white bg-[var(--slate-900)]"
        title="拖曳建立關係"
        onPointerDown={(event) => {
          event.stopPropagation();
          event.preventDefault();
          onConnectStart(event);
        }}
      />
      <div {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing">
        <div className="truncate text-sm font-semibold text-[var(--slate-900)]">{step.label}</div>
        <div className="mt-1 truncate text-xs text-[var(--slate-500)]">{step.modelId}</div>
        <div className="mt-3 h-1.5 rounded-full bg-[var(--surface-muted)]">
          <div className="h-full w-1/2 rounded-full bg-[var(--emerald-500)]" />
        </div>
      </div>
    </div>
  );
}

export default function GraphBuilder() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const textModels = useMemo(
    () => AVAILABLE_MODELS.filter((model) => model.available && model.capabilities?.includes('chat')),
    []
  );
  const initialGraph = useMemo(() => createInitialGraph(), []);
  const [name, setName] = useState('我的 LangGraph 流程');
  const [steps, setSteps] = useState<NoCodeGraphStep[]>(initialGraph.steps);
  const [edges, setEdges] = useState<NoCodeGraphEdge[]>(initialGraph.edges);
  const [activeStepId, setActiveStepId] = useState<string | null>(null);
  const [connectionDraft, setConnectionDraft] = useState<{
    fromId: string;
    start: { x: number; y: number };
    current: { x: number; y: number };
  } | null>(null);
  const [input, setInput] = useState('');
  const [results, setResults] = useState<NoCodeGraphRunResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);

  const validEdges = useMemo(() => {
    const ids = new Set(steps.map((step) => step.id));
    return edges.filter((edge) => ids.has(edge.from) && ids.has(edge.to));
  }, [edges, steps]);

  const activeStep = steps.find((step) => step.id === activeStepId) ?? steps[0];
  const totalDurationMs = results.reduce((total, result) => total + (result.durationMs ?? 0), 0);

  const updateStep = (stepId: string, patch: Partial<NoCodeGraphStep>) => {
    setSteps((current) =>
      current.map((step) => (step.id === stepId ? { ...step, ...patch } : step))
    );
  };

  const addStep = () => {
    setSteps((current) => {
      const next = createStep(current.length + 1);
      setActiveStepId(next.id);
      return [...current, next];
    });
  };

  const applyTemplate = (template: GraphTemplate) => {
    const { steps: templateSteps, edges: templateEdges } = buildTemplateGraph(template);
    setName(template.name);
    setSteps(templateSteps);
    setEdges(templateEdges);
    setActiveStepId(templateSteps[0]?.id ?? null);
    setInput(template.input);
    setResults([]);
    setError(null);
  };

  const removeStep = (stepId: string) => {
    setSteps((current) => current.filter((step) => step.id !== stepId));
    setEdges((current) => current.filter((edge) => edge.from !== stepId && edge.to !== stepId));
    setActiveStepId((current) => (current === stepId ? null : current));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const stepId = String(event.active.id);
    const { x, y } = event.delta;

    setSteps((current) =>
      current.map((step) =>
        step.id === stepId
          ? {
              ...step,
              x: Math.max(24, (step.x ?? 0) + x),
              y: Math.max(24, (step.y ?? 0) + y),
            }
          : step
      )
    );
  };

  const getCanvasPoint = (event: PointerEvent | ReactPointerEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) {
      return { x: 0, y: 0 };
    }

    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  const findStepAtPoint = (point: { x: number; y: number }, excludedStepId: string) =>
    steps.find((step) => {
      const x = step.x ?? 0;
      const y = step.y ?? 0;
      return (
        step.id !== excludedStepId &&
        point.x >= x &&
        point.x <= x + NODE_WIDTH &&
        point.y >= y &&
        point.y <= y + NODE_HEIGHT
      );
    });

  const startConnectionDrag = (stepId: string, event: ReactPointerEvent<HTMLButtonElement>) => {
    const source = steps.find((step) => step.id === stepId);
    if (!source) return;

    const start = {
      x: (source.x ?? 0) + NODE_WIDTH,
      y: (source.y ?? 0) + NODE_HEIGHT / 2,
    };
    const current = getCanvasPoint(event);
    setConnectionDraft({ fromId: stepId, start, current });

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextPoint = getCanvasPoint(moveEvent);
      setConnectionDraft((draft) => (draft?.fromId === stepId ? { ...draft, current: nextPoint } : draft));
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      const target = findStepAtPoint(getCanvasPoint(upEvent), stepId);

      if (target) {
        setEdges((currentEdges) => {
          const exists = currentEdges.some((edge) => edge.from === stepId && edge.to === target.id);
          if (exists) return currentEdges;
          return [...currentEdges, { id: `${stepId}-${target.id}-${Date.now()}`, from: stepId, to: target.id }];
        });
      }

      setConnectionDraft(null);
      window.removeEventListener('pointermove', handlePointerMove);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
  };

  const runGraph = async () => {
    if (!input.trim() || isRunning) return;

    setIsRunning(true);
    setError(null);
    setResults([]);

    try {
      const definition: NoCodeGraphDefinition = { name, steps, edges: validEdges };
      const response = await fetch('/api/graph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ definition, input }),
      });
      const data = (await response.json()) as { results?: NoCodeGraphRunResult[]; error?: string };

      if (!response.ok) throw new Error(data.error || 'Graph 執行失敗');
      setResults(data.results ?? []);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'Graph 執行失敗');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="h-full overflow-hidden bg-[var(--background)]">
      <div className="flex h-full flex-col">
        <header className="flex shrink-0 flex-col gap-3 border-b border-[var(--border-soft)] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-lg font-semibold text-[var(--slate-900)] outline-none"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsInspectorOpen((value) => !value)}
              className="soft-button rounded-full px-3 py-2 text-sm font-semibold"
            >
              {isInspectorOpen ? '收合設定' : '展開設定'}
            </button>
            <button type="button" onClick={addStep} className="soft-button rounded-full px-4 py-2 text-sm font-semibold">
              新增節點
            </button>
            <span className="hidden rounded-full bg-[var(--surface-muted)] px-3 py-2 text-xs text-[var(--slate-500)] sm:inline-flex">
              拖曳節點右側圓點建立關係
            </span>
          </div>
        </header>

        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--border-soft)] bg-white px-4 py-2.5">
          <span className="text-xs font-semibold text-[var(--slate-500)]">範例範本</span>
          {GRAPH_TEMPLATES.map((template) => (
            <button
              key={template.label}
              type="button"
              onClick={() => applyTemplate(template)}
              className="rounded-full bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-semibold text-[var(--slate-600)] transition-colors hover:text-[var(--emerald-700)]"
            >
              {template.label}
            </button>
          ))}
          <span className="hidden text-xs text-[var(--slate-400)] sm:inline">點一下載入完整流程與範例輸入，可直接執行</span>
        </div>

        <div
          className={`grid min-h-0 flex-1 grid-cols-1 ${
            isInspectorOpen ? 'lg:grid-cols-[minmax(0,1fr)_320px]' : 'lg:grid-cols-1'
          }`}
        >
          <main className="relative min-h-0 overflow-hidden">
            <DndContext onDragEnd={handleDragEnd}>
              <div className="relative h-full overflow-auto">
                <div ref={canvasRef} className="relative h-[720px] min-w-[920px]">
                  <svg className="pointer-events-none absolute inset-0 h-full w-full">
                    <defs>
                      <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="#111827" />
                      </marker>
                    </defs>
                    {validEdges.map((edge) => {
                      const from = steps.find((step) => step.id === edge.from);
                      const to = steps.find((step) => step.id === edge.to);
                      if (!from || !to) return null;
                      const start = centerOf(from);
                      const end = centerOf(to);
                      const midX = (start.x + end.x) / 2;
                      return (
                        <path
                          key={edge.id}
                          d={`M ${start.x} ${start.y} C ${midX} ${start.y}, ${midX} ${end.y}, ${end.x} ${end.y}`}
                          stroke="#111827"
                          strokeWidth="1.6"
                          fill="none"
                          markerEnd="url(#arrow)"
                        />
                      );
                    })}
                    {connectionDraft && (
                      <path
                        d={`M ${connectionDraft.start.x} ${connectionDraft.start.y} C ${(connectionDraft.start.x + connectionDraft.current.x) / 2} ${connectionDraft.start.y}, ${(connectionDraft.start.x + connectionDraft.current.x) / 2} ${connectionDraft.current.y}, ${connectionDraft.current.x} ${connectionDraft.current.y}`}
                        stroke="#111827"
                        strokeDasharray="6 6"
                        strokeWidth="1.6"
                        fill="none"
                        markerEnd="url(#arrow)"
                      />
                    )}
                  </svg>

                  {steps.map((step) => (
                    <DraggableNode
                      key={step.id}
                      step={step}
                      isActive={activeStep?.id === step.id}
                      onSelect={() => setActiveStepId(step.id)}
                      onConnectStart={(event) => startConnectionDrag(step.id, event)}
                    />
                  ))}
                </div>
              </div>
            </DndContext>

            {!isInspectorOpen && (
              <div className="absolute inset-x-4 bottom-4 z-30 mx-auto max-w-2xl rounded-[1.5rem] border border-[var(--border-soft)] bg-white/96 p-3 shadow-[0_22px_50px_rgba(17,24,39,0.12)] backdrop-blur">
                {error && (
                  <div className="mb-3 rounded-2xl bg-[var(--rose-100)] px-4 py-3 text-sm text-[var(--rose-500)]">
                    {error}
                  </div>
                )}
                <PromptComposer
                  value={input}
                  onChange={setInput}
                  onSubmit={runGraph}
                  isLoading={isRunning}
                  disabled={isRunning}
                  submitLabel="執行 Graph"
                  placeholder="輸入要送進 Graph 的需求..."
                  helperText={`${steps.length} 個節點 · ${validEdges.length} 條關係`}
                />
              </div>
            )}
          </main>

          {isInspectorOpen && (
          <aside className="flex min-h-0 flex-col border-t border-[var(--border-soft)] bg-white lg:border-l lg:border-t-0">
            {activeStep ? (
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-[var(--slate-900)]">節點設定</div>
                  <button
                    type="button"
                    onClick={() => removeStep(activeStep.id)}
                    disabled={steps.length === 1}
                    className="rounded-full px-3 py-1.5 text-xs font-semibold text-[var(--rose-500)] hover:bg-[var(--rose-100)] disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    移除
                  </button>
                </div>

                <label className="text-xs font-semibold text-[var(--slate-500)]">名稱</label>
                <input
                  value={activeStep.label}
                  onChange={(event) => updateStep(activeStep.id, { label: event.target.value })}
                  className="mt-2 w-full rounded-2xl border border-[var(--border-soft)] px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[var(--emerald-400)]"
                />

                <label className="mt-4 block text-xs font-semibold text-[var(--slate-500)]">模型</label>
                <select
                  value={activeStep.modelId}
                  onChange={(event) => updateStep(activeStep.id, { modelId: event.target.value })}
                  className="mt-2 w-full rounded-2xl border border-[var(--border-soft)] px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[var(--emerald-400)]"
                >
                  {textModels.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))}
                </select>
                {textModels.find((model) => model.id === activeStep.modelId)?.source === 'local' && (
                  <div className="mt-3 rounded-xl bg-[rgba(255,248,230,0.9)] px-3 py-2 text-xs leading-5 text-[var(--gold-600)]">
                    地端模型需要連上指定推論伺服器；目前環境可能無法執行。
                  </div>
                )}

                <label className="mt-4 block text-xs font-semibold text-[var(--slate-500)]">Prompt</label>
                <textarea
                  value={activeStep.promptTemplate}
                  onChange={(event) => updateStep(activeStep.id, { promptTemplate: event.target.value })}
                  rows={8}
                  className="mt-2 w-full resize-none rounded-2xl border border-[var(--border-soft)] px-4 py-3 text-sm leading-7 outline-none focus:ring-2 focus:ring-[var(--emerald-400)]"
                />

                <div className="mt-4 rounded-2xl bg-[var(--background)] px-4 py-3 text-xs leading-6 text-[var(--slate-600)]">
                  可用變數：{'{{input}}'} 原始輸入，{'{{previous}}'} 前一節點輸出。
                </div>

                {validEdges.length > 0 && (
                  <div className="mt-5">
                    <div className="mb-2 text-xs font-semibold text-[var(--slate-500)]">關係</div>
                    <div className="space-y-2">
                      {validEdges.map((edge) => (
                        <button
                          key={edge.id}
                          type="button"
                          onClick={() => setEdges((current) => current.filter((item) => item.id !== edge.id))}
                          className="w-full rounded-2xl bg-[var(--background)] px-3 py-2 text-left text-xs text-[var(--slate-600)] hover:text-[var(--rose-500)]"
                        >
                          {steps.find((step) => step.id === edge.from)?.label} {'->'} {steps.find((step) => step.id === edge.to)?.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {results.length > 0 && (
                  <div className="mt-5 space-y-3">
                    <div className="flex items-center justify-between gap-3 text-xs font-semibold text-[var(--slate-500)]">
                      <span>輸出</span>
                      <span>總耗時 {(totalDurationMs / 1000).toFixed(1)} 秒</span>
                    </div>
                    {results.map((result) => (
                      <div key={result.stepId} className="rounded-2xl bg-[var(--background)] p-3">
                        <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                          <span className="font-semibold text-[var(--slate-800)]">{result.label}</span>
                          <span className="text-[var(--slate-400)]">
                            {typeof result.durationMs === 'number' ? `${(result.durationMs / 1000).toFixed(1)} 秒` : ''}
                          </span>
                        </div>
                        <div className="response-text text-xs">{result.output}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            <div className="border-t border-[var(--border-soft)] p-3">
              {error && (
                <div className="mb-3 rounded-2xl bg-[var(--rose-100)] px-4 py-3 text-sm text-[var(--rose-500)]">
                  {error}
                </div>
              )}
              <PromptComposer
                value={input}
                onChange={setInput}
                onSubmit={runGraph}
                isLoading={isRunning}
                disabled={isRunning}
                submitLabel="執行 Graph"
                placeholder="輸入要送進 Graph 的需求..."
                helperText={`${steps.length} 個節點 · ${validEdges.length} 條關係`}
              />
            </div>
          </aside>
          )}
        </div>
      </div>
    </div>
  );
}
