'use client';

import { useMemo, useRef, useState } from 'react';
import { AVAILABLE_MODELS } from '@/config/models';
import { callModel } from '@/lib/api';

type LoopStatus = 'idle' | 'running' | 'review' | 'passed' | 'stopped' | 'error';
type IterationStatus = 'producing' | 'evaluating' | 'complete';

interface Evaluation {
  score: number;
  passed: boolean;
  summary: string;
  nextAction: string;
}

interface HumanReview {
  iterationId: number;
  score: number;
  feedback: string;
  passed: boolean;
}

interface LoopIteration {
  id: number;
  status: IterationStatus;
  artifact: string;
  evaluation?: Evaluation;
  durationMs?: number;
}

const TASK_PRESETS = [
  {
    label: '活動方案',
    task: '替 30 人的跨部門團隊設計一場半天的 AI 入門工作坊，預算新台幣 5 萬元，參與者多數沒有技術背景。',
    criteria: '方案必須包含時間表、活動內容、分工、預算分配、風險應對，以及活動結束後可量化的學習成效。',
  },
  {
    label: '決策備忘錄',
    task: '替一間 20 人的新創公司評估是否應導入每月 3 萬元的客服 AI，並提出三個月試行方案。',
    criteria: '內容必須比較成本、效益與風險；明確提出建議；試行方案需包含負責人、里程碑、停止條件與成功指標。',
  },
  {
    label: '內容計畫',
    task: '替地方咖啡店設計四週社群內容計畫，目標是增加平日下午來客，團隊每週只能投入 4 小時。',
    criteria: '計畫必須符合每週 4 小時限制，列出每週主題、貼文格式、執行步驟、衡量方式與低成效時的調整方法。',
  },
];

const GUARDRAILS = [
  { id: 'assumptions', label: '標示假設', instruction: '所有未驗證資訊都必須明確標示為假設。' },
  { id: 'actionable', label: '可以執行', instruction: '輸出必須包含下一步、負責角色與完成條件。' },
  { id: 'concise', label: '保持精簡', instruction: '避免空泛背景介紹，優先保留能影響決策的內容。' },
];

function formatDuration(durationMs?: number) {
  if (typeof durationMs !== 'number') return '';
  return durationMs < 1000 ? `${Math.round(durationMs)} ms` : `${(durationMs / 1000).toFixed(1)} 秒`;
}

function clampScore(value: unknown) {
  const score = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(score) ? Math.min(100, Math.max(0, Math.round(score))) : 0;
}

function extractLooseEvaluationField(raw: string, field: 'summary' | 'nextAction') {
  const pattern =
    field === 'summary'
      ? /"summary"\s*:\s*"([\s\S]*?)"\s*,\s*"nextAction"/i
      : /"nextAction"\s*:\s*"([\s\S]*?)"\s*}\s*(?:<\/evaluation>)?/i;

  return pattern.exec(raw)?.[1]?.replace(/\\"/g, '"').replace(/\\n/g, '\n').trim() ?? '';
}

function parseEvaluation(raw: string, targetScore: number): Evaluation {
  const tagged = raw.match(/<evaluation>\s*([\s\S]*?)\s*<\/evaluation>/i)?.[1];
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1];
  const candidate = tagged ?? fenced ?? raw.match(/\{[\s\S]*\}/)?.[0];

  if (candidate) {
    try {
      const parsed = JSON.parse(candidate) as Partial<Evaluation>;
      const score = clampScore(parsed.score);
      return {
        score,
        passed: Boolean(parsed.passed) || score >= targetScore,
        summary: String(parsed.summary || 'Evaluator 已完成評估。'),
        nextAction: String(parsed.nextAction || '重新檢查是否完整符合成功標準。'),
      };
    } catch {
      // Fall through to a readable recovery result.
    }
  }

  const score = clampScore(raw.match(/(?:score|分數)\D{0,8}(\d{1,3})/i)?.[1]);
  const summary = extractLooseEvaluationField(raw, 'summary');
  const nextAction = extractLooseEvaluationField(raw, 'nextAction');
  const explicitlyPassed = /"passed"\s*:\s*true/i.test(raw);

  return {
    score,
    passed: explicitlyPassed || score >= targetScore,
    summary: summary || raw.trim() || 'Evaluator 未回傳可解析的評估。',
    nextAction: nextAction || '根據 evaluator 的文字回饋，優先修正最重要的缺口。',
  };
}

function StatusDot({ status }: { status: LoopStatus }) {
  const className =
    status === 'running'
      ? 'animate-pulse bg-[var(--gold-500)]'
      : status === 'review'
        ? 'animate-pulse bg-[var(--gold-500)]'
      : status === 'passed'
        ? 'bg-[var(--emerald-500)]'
        : status === 'error'
          ? 'bg-[var(--rose-500)]'
          : 'bg-[var(--slate-400)]';

  return <span className={`h-2.5 w-2.5 rounded-full ${className}`} />;
}

export default function AutonomousLoopLab() {
  const cloudModels = useMemo(
    () =>
      AVAILABLE_MODELS.filter(
        (model) =>
          model.available &&
          model.source === 'cloud' &&
          !model.isArenaSpecial &&
          model.capabilities?.includes('chat')
      ),
    []
  );

  const defaultWorkerId = cloudModels.find((model) => model.id === 'gpt-5.4')?.id ?? cloudModels[0]?.id ?? '';
  const defaultEvaluatorId =
    cloudModels.find((model) => model.id === 'gemini-3.1-pro-preview')?.id ?? cloudModels[1]?.id ?? defaultWorkerId;

  const [task, setTask] = useState(TASK_PRESETS[0].task);
  const [criteria, setCriteria] = useState(TASK_PRESETS[0].criteria);
  const [workerModelId, setWorkerModelId] = useState(defaultWorkerId);
  const [evaluatorModelId, setEvaluatorModelId] = useState(defaultEvaluatorId);
  const [maxIterations, setMaxIterations] = useState(3);
  const [targetScore, setTargetScore] = useState(85);
  const [selectedGuardrails, setSelectedGuardrails] = useState<string[]>(['assumptions', 'actionable']);
  const [status, setStatus] = useState<LoopStatus>('idle');
  const [iterations, setIterations] = useState<LoopIteration[]>([]);
  const [humanReviews, setHumanReviews] = useState<HumanReview[]>([]);
  const [humanScore, setHumanScore] = useState(targetScore);
  const [humanFeedback, setHumanFeedback] = useState('');
  const [currentStage, setCurrentStage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const stopRequestedRef = useRef(false);

  const workerName = cloudModels.find((model) => model.id === workerModelId)?.name ?? workerModelId;
  const evaluatorName = cloudModels.find((model) => model.id === evaluatorModelId)?.name ?? evaluatorModelId;
  const evaluatorIsWorker = workerModelId === evaluatorModelId;
  const finalIteration = iterations.at(-1);
  const latestHumanReview = humanReviews.at(-1);
  const totalDuration = iterations.reduce((sum, iteration) => sum + (iteration.durationMs ?? 0), 0);
  const activeGuardrails = GUARDRAILS.filter((guardrail) => selectedGuardrails.includes(guardrail.id));
  const guardrailPrompt = activeGuardrails.map((guardrail, index) => `${index + 1}. ${guardrail.instruction}`).join('\n');

  const updateIteration = (id: number, patch: Partial<LoopIteration>) => {
    setIterations((current) =>
      current.map((iteration) => (iteration.id === id ? { ...iteration, ...patch } : iteration))
    );
  };

  const runLoop = async (reviewToAlign?: HumanReview) => {
    if (!task.trim() || !criteria.trim() || !workerModelId || !evaluatorModelId || status === 'running') return;

    stopRequestedRef.current = false;
    setStatus('running');
    setError(null);

    const continuingFromReview = Boolean(reviewToAlign);
    const startingIteration = continuingFromReview ? iterations.length + 1 : 1;
    const humanAlignmentPrompt = reviewToAlign
      ? [
          `上一輪人工分數：${reviewToAlign.score} / 100`,
          `人工建議：${reviewToAlign.feedback}`,
          '接下來的產出與評分都必須重新對齊這個人工標準。',
        ].join('\n')
      : '';

    if (!continuingFromReview) {
      setIterations([]);
      setHumanReviews([]);
    }

    let previousArtifact = continuingFromReview ? finalIteration?.artifact ?? '' : '';
    let previousFeedback = reviewToAlign?.feedback ?? '';
    let lastEvaluation: Evaluation | undefined;

    try {
      for (let offset = 0; offset < maxIterations; offset += 1) {
        const iterationNumber = startingIteration + offset;

        if (stopRequestedRef.current) {
          setStatus('stopped');
          setCurrentStage('');
          return;
        }

        const startedAt = performance.now();
        setCurrentStage(`第 ${iterationNumber} 輪：產生可交付成果`);
        setIterations((current) => [
          ...current,
          { id: iterationNumber, status: 'producing', artifact: '' },
        ]);

        const artifact = await callModel(
          workerModelId,
          [
            `任務：\n${task.trim()}`,
            `成功標準：\n${criteria.trim()}`,
            guardrailPrompt ? `執行界線：\n${guardrailPrompt}` : '',
            previousArtifact ? `上一輪成果：\n${previousArtifact}` : '',
            humanAlignmentPrompt ? `人工評分校準：\n${humanAlignmentPrompt}` : '',
            previousFeedback ? `本輪必須優先處理的回饋：\n${previousFeedback}` : '',
            previousArtifact
              ? '請聚焦修正最高優先問題，但輸出必須是完整、可直接交付的新版本。不要描述修改過程。'
              : '請直接產出完整、可交付的第一版成果。不要先解釋你將如何處理。',
          ]
            .filter(Boolean)
            .join('\n\n'),
          {
            systemPrompt:
              '你是負責產出與改善的執行模型。每一輪只解決目前最重要的問題，嚴格對齊成功標準，並交付完整成果。',
            responseTokenLimit: 3200,
            temperature: 0.35,
          }
        );

        updateIteration(iterationNumber, { artifact: artifact.trim(), status: 'evaluating' });

        if (stopRequestedRef.current) {
          updateIteration(iterationNumber, { status: 'complete', durationMs: performance.now() - startedAt });
          setStatus('stopped');
          setCurrentStage('');
          return;
        }

        setCurrentStage(`第 ${iterationNumber} 輪：獨立 evaluator 驗收`);
        const rawEvaluation = await callModel(
          evaluatorModelId,
          [
            `原始任務：\n${task.trim()}`,
            `成功標準：\n${criteria.trim()}`,
            guardrailPrompt ? `執行界線：\n${guardrailPrompt}` : '',
            `待驗收成果：\n${artifact.trim()}`,
            humanAlignmentPrompt ? `人工評分校準：\n${humanAlignmentPrompt}` : '',
            `目標分數：${targetScore} / 100`,
            [
              '請嚴格驗收，不要重寫成果。只輸出以下 JSON，並包在 <evaluation> 標籤內：',
              '{"score": 0, "passed": false, "summary": "一句話評估", "nextAction": "下一輪只需優先改善的一件事"}',
              'passed 只是模型自評是否達標，最終仍必須等待人工評分。若人工校準指出問題仍未解決，不可給高分。',
            ].join('\n'),
          ]
            .filter(Boolean)
            .join('\n\n'),
          {
            systemPrompt:
              '你是獨立 evaluator。你的工作是提供可驗證的 backpressure，避免執行模型自己替自己背書。',
            responseTokenLimit: 900,
            temperature: 0.1,
          }
        );

        const evaluation = parseEvaluation(rawEvaluation, targetScore);
        lastEvaluation = evaluation;
        updateIteration(iterationNumber, {
          status: 'complete',
          evaluation,
          durationMs: performance.now() - startedAt,
        });

        previousArtifact = artifact.trim();
        previousFeedback = evaluation.nextAction;
      }

      setHumanScore(lastEvaluation?.score ?? targetScore);
      setHumanFeedback('');
      setStatus('review');
      setCurrentStage(`已完成 ${maxIterations} 輪自動改善，等待人工評分`);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : '自主迴圈執行失敗');
      setStatus('error');
      setCurrentStage('');
    }
  };

  const stopLoop = () => {
    stopRequestedRef.current = true;
    setCurrentStage('收到停止要求，將在目前模型回應結束後停止');
  };

  const resetLoop = () => {
    if (status !== 'idle' && !window.confirm('確定要清除目前的迴圈紀錄嗎？')) return;
    stopRequestedRef.current = true;
    setStatus('idle');
    setIterations([]);
    setHumanReviews([]);
    setHumanScore(targetScore);
    setHumanFeedback('');
    setCurrentStage('');
    setError(null);
  };

  const applyPreset = (preset: (typeof TASK_PRESETS)[number]) => {
    setTask(preset.task);
    setCriteria(preset.criteria);
  };

  const toggleGuardrail = (guardrailId: string) => {
    setSelectedGuardrails((current) =>
      current.includes(guardrailId)
        ? current.filter((id) => id !== guardrailId)
        : [...current, guardrailId]
    );
  };

  const submitHumanReview = () => {
    if (!finalIteration || status !== 'review') return;

    const score = clampScore(humanScore);
    const passed = score >= targetScore;
    const feedback = humanFeedback.trim() || (passed ? '人工確認通過。' : '人工未提供具體建議，請重新對照成功標準改善。');
    const review: HumanReview = {
      iterationId: finalIteration.id,
      score,
      feedback,
      passed,
    };

    setHumanReviews((current) => [...current, review]);
    setHumanScore(score);

    if (passed) {
      setStatus('passed');
      setCurrentStage('');
      return;
    }

    setHumanFeedback('');
    void runLoop(review);
  };

  return (
    <div className="h-full overflow-y-auto bg-[var(--background)]">
      <header className="sticky top-0 z-30 border-b border-white/70 bg-[#f7f7f4]/90 px-4 py-3 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-[var(--slate-900)]">Loop 工程實驗室</div>
            <div className="text-xs text-[var(--slate-500)]">自動改善一批後，回到人工評分</div>
          </div>
          {status === 'running' ? (
            <button
              type="button"
              onClick={stopLoop}
              className="rounded-full border border-[rgba(213,109,85,0.24)] bg-white px-4 py-2 text-xs font-semibold text-[var(--rose-500)]"
            >
              停止迴圈
            </button>
          ) : (
            <button type="button" onClick={resetLoop} className="soft-button rounded-full px-4 py-2 text-xs font-semibold">
              重新設定
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
        <section className="grid items-end gap-6 border-b border-[var(--border-soft)] pb-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="max-w-4xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--emerald-700)]">
              Evaluator-optimizer loop with human gate
            </p>
            <h1 className="mt-3 text-3xl font-semibold leading-[1.15] tracking-[-0.03em] text-[var(--slate-900)] sm:text-4xl lg:text-5xl">
              AI 自動改善，人工把關
            </h1>
          </div>
          <div className="rounded-[1.5rem] border border-[rgba(232,179,73,0.3)] bg-[var(--amber-50)] p-5">
            <div className="text-sm font-semibold text-[var(--amber-900)]">迴圈需要人工校準</div>
            <p className="mt-2 text-sm leading-7 text-[var(--amber-900)]/75">
              每批跑完設定輪數後必定停在人工評分；未達標時，下一批會用人工分數與建議重新對齊。
            </p>
          </div>
        </section>

        <section className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-[1.5rem] border border-[var(--border-soft)] bg-[var(--border-soft)] lg:grid-cols-4">
          {[
            ['目標', '定義任務與可驗收的成功標準'],
            ['自動迴圈', '執行模型交付完整版本'],
            ['模型評估', '獨立模型給分並指出最大缺口'],
            ['人工 Gate', '人工分數達標才算合格'],
          ].map(([label, description], index) => (
            <div key={label} className="bg-white px-4 py-4">
              <div className="text-xs font-semibold text-[var(--emerald-700)]">{index + 1}</div>
              <div className="mt-3 text-sm font-semibold text-[var(--slate-900)]">{label}</div>
              <div className="mt-1 text-xs leading-5 text-[var(--slate-500)]">{description}</div>
            </div>
          ))}
        </section>

        {error && (
          <div className="mt-6 rounded-[1.25rem] border border-[rgba(213,109,85,0.22)] bg-[var(--rose-100)] px-5 py-4 text-sm text-[var(--rose-500)]">
            {error}
          </div>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="space-y-5">
            <div className="marble-card rounded-[1.5rem] p-5">
              <div className="text-sm font-semibold text-[var(--slate-900)]">模型角色</div>
              <label className="mt-4 block text-xs font-semibold text-[var(--slate-500)]">執行與改善</label>
              <select
                value={workerModelId}
                onChange={(event) => setWorkerModelId(event.target.value)}
                disabled={status === 'running'}
                className="mt-2 w-full rounded-xl border border-[var(--border-soft)] bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--emerald-400)] disabled:opacity-60"
              >
                {cloudModels.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
              </select>

              <label className="mt-4 block text-xs font-semibold text-[var(--slate-500)]">獨立驗收</label>
              <select
                value={evaluatorModelId}
                onChange={(event) => setEvaluatorModelId(event.target.value)}
                disabled={status === 'running'}
                className="mt-2 w-full rounded-xl border border-[var(--border-soft)] bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--emerald-400)] disabled:opacity-60"
              >
                {cloudModels.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
              </select>
              {evaluatorIsWorker && (
                <p className="mt-3 rounded-xl bg-[var(--amber-50)] px-3 py-2 text-xs leading-5 text-[var(--amber-900)]">
                  建議改用不同模型驗收，降低同一模型替自己背書的風險。
                </p>
              )}
            </div>

            <div className="marble-card rounded-[1.5rem] p-5">
              <div className="text-sm font-semibold text-[var(--slate-900)]">人工檢查節奏</div>
              <label className="mt-4 flex items-center justify-between gap-4 text-xs font-semibold text-[var(--slate-500)]">
                人工檢查前自動輪數
                <span className="text-sm text-[var(--slate-900)]">{maxIterations}</span>
              </label>
              <input
                type="range"
                min={1}
                max={5}
                value={maxIterations}
                onChange={(event) => setMaxIterations(Number(event.target.value))}
                disabled={status === 'running'}
                className="mt-2 w-full accent-[var(--emerald-600)] disabled:opacity-60"
              />
              <label className="mt-5 flex items-center justify-between gap-4 text-xs font-semibold text-[var(--slate-500)]">
                人工合格分數
                <span className="text-sm text-[var(--slate-900)]">{targetScore}</span>
              </label>
              <input
                type="range"
                min={60}
                max={100}
                step={5}
                value={targetScore}
                onChange={(event) => setTargetScore(Number(event.target.value))}
                disabled={status === 'running'}
                className="mt-2 w-full accent-[var(--emerald-600)] disabled:opacity-60"
              />
              <p className="mt-4 text-xs leading-6 text-[var(--slate-500)]">
                每批最多呼叫 {maxIterations * 2} 次雲端模型。跑完會等待人工評分，不會由模型自動宣告合格。
              </p>
            </div>

            <div className="marble-card rounded-[1.5rem] p-5">
              <div className="text-sm font-semibold text-[var(--slate-900)]">每輪執行界線</div>
              <div className="mt-4 space-y-2">
                {GUARDRAILS.map((guardrail) => {
                  const active = selectedGuardrails.includes(guardrail.id);
                  return (
                    <button
                      key={guardrail.id}
                      type="button"
                      onClick={() => toggleGuardrail(guardrail.id)}
                      disabled={status === 'running'}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-3 text-left text-sm font-semibold transition-colors disabled:opacity-60 ${
                        active
                          ? 'border-[rgba(24,172,126,0.3)] bg-[var(--emerald-50)] text-[var(--emerald-800)]'
                          : 'border-[var(--border-soft)] bg-white text-[var(--slate-600)]'
                      }`}
                    >
                      {guardrail.label}
                      <span className={`h-2.5 w-2.5 rounded-full ${active ? 'bg-[var(--emerald-500)]' : 'bg-[var(--slate-400)]/30'}`} />
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          <section className="min-w-0">
            {status === 'idle' ? (
              <div className="marble-card rounded-[1.75rem] p-5 sm:p-7">
                <div className="flex flex-col gap-5 border-b border-[var(--border-soft)] pb-6 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-2xl font-semibold tracking-[-0.02em] text-[var(--slate-900)]">定義任務與驗收標準</h2>
                    <p className="mt-2 text-sm leading-7 text-[var(--slate-500)]">
                      模糊目標容易讓迴圈只是不斷改寫；可驗收標準才能提供收斂方向。
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-[var(--slate-400)]">範例任務</span>
                    {TASK_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => applyPreset(preset)}
                        className="rounded-full bg-[var(--surface-muted)] px-3 py-2 text-xs font-semibold text-[var(--slate-600)] hover:text-[var(--emerald-700)]"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="mt-6 block text-xs font-semibold text-[var(--slate-500)]">要完成的任務</label>
                <textarea
                  value={task}
                  onChange={(event) => setTask(event.target.value)}
                  rows={5}
                  className="mt-2 w-full resize-y rounded-[1.25rem] border border-[var(--border-soft)] bg-white px-4 py-4 text-base leading-8 text-[var(--slate-800)] outline-none focus:ring-2 focus:ring-[var(--emerald-400)]"
                />

                <label className="mt-5 block text-xs font-semibold text-[var(--slate-500)]">怎樣才算完成</label>
                <textarea
                  value={criteria}
                  onChange={(event) => setCriteria(event.target.value)}
                  rows={5}
                  className="mt-2 w-full resize-y rounded-[1.25rem] border border-[var(--border-soft)] bg-white px-4 py-4 text-base leading-8 text-[var(--slate-800)] outline-none focus:ring-2 focus:ring-[var(--emerald-400)]"
                />

                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs leading-6 text-[var(--slate-500)]">
                    {workerName} 產出，{evaluatorName} 先評估；人工評分達到 {targetScore} 分才合格。
                  </div>
                  <button
                    type="button"
                    onClick={() => void runLoop()}
                    disabled={!task.trim() || !criteria.trim()}
                    className="metal-button rounded-xl px-6 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    啟動第一批迴圈
                  </button>
                </div>
              </div>
            ) : (
              <div className="animate-fade-in space-y-5">
                <div className={`rounded-[1.5rem] border p-5 ${
                  status === 'passed'
                    ? 'border-[rgba(24,172,126,0.25)] bg-[var(--emerald-50)]'
                    : status === 'review'
                      ? 'border-[rgba(232,179,73,0.36)] bg-[var(--amber-50)]'
                    : 'border-[var(--border-soft)] bg-white'
                }`}>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--slate-900)]">
                        <StatusDot status={status} />
                        {status === 'running' && '自動迴圈執行中'}
                        {status === 'review' && '等待人工評分'}
                        {status === 'passed' && '人工評分已通過'}
                        {status === 'stopped' && '已由使用者停止'}
                        {status === 'error' && '執行時發生錯誤'}
                      </div>
                      <p className="mt-2 text-xs leading-6 text-[var(--slate-500)]">
                        {currentStage || `完成 ${iterations.length} 輪，總耗時 ${formatDuration(totalDuration) || '計算中'}`}
                      </p>
                      {latestHumanReview && (
                        <p className="mt-1 text-xs leading-6 text-[var(--slate-500)]">
                          最近人工分數：{latestHumanReview.score} / 100，來自第 {latestHumanReview.iterationId} 輪。
                        </p>
                      )}
                    </div>
                    {finalIteration?.evaluation && (
                      <div className="flex items-end gap-2">
                        <span className="text-4xl font-semibold tracking-[-0.04em] text-[var(--slate-900)]">
                          {finalIteration.evaluation.score}
                        </span>
                        <span className="pb-1 text-xs text-[var(--slate-500)]">/ 100 模型分數</span>
                      </div>
                    )}
                  </div>
                </div>

                {status === 'review' && finalIteration?.artifact && (
                  <article className="rounded-[1.75rem] border border-[rgba(232,179,73,0.32)] bg-white p-5 sm:p-7">
                    <div className="flex flex-col gap-2 border-b border-[var(--border-soft)] pb-5 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h2 className="text-lg font-semibold text-[var(--slate-900)]">人工評分</h2>
                        <p className="mt-1 text-xs leading-6 text-[var(--slate-500)]">
                          模型分數只作為參考；人工分數達到 {targetScore} 分才會結束。
                        </p>
                      </div>
                      <span className="rounded-full bg-[var(--amber-50)] px-3 py-1.5 text-xs font-semibold text-[var(--amber-900)]">
                        第 {finalIteration.id} 輪待確認
                      </span>
                    </div>

                    <label className="mt-5 flex items-center justify-between gap-4 text-xs font-semibold text-[var(--slate-500)]">
                      人工分數
                      <span className="text-sm text-[var(--slate-900)]">{humanScore}</span>
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={humanScore}
                      onChange={(event) => setHumanScore(clampScore(event.target.value))}
                      className="mt-2 w-full accent-[var(--emerald-600)]"
                    />

                    <label className="mt-5 block text-xs font-semibold text-[var(--slate-500)]">
                      人工建議
                    </label>
                    <textarea
                      value={humanFeedback}
                      onChange={(event) => setHumanFeedback(event.target.value)}
                      rows={4}
                      placeholder="如果分數未達標，請寫下下一批必須優先修正的問題。"
                      className="mt-2 w-full resize-y rounded-[1.25rem] border border-[var(--border-soft)] bg-white px-4 py-3 text-sm leading-7 text-[var(--slate-800)] outline-none focus:ring-2 focus:ring-[var(--emerald-400)]"
                    />

                    <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs leading-6 text-[var(--slate-500)]">
                        未達標時會立刻進入下一批 {maxIterations} 輪，並用這次人工分數與建議校準 evaluator。
                      </p>
                      <button
                        type="button"
                        onClick={submitHumanReview}
                        disabled={humanScore < targetScore && !humanFeedback.trim()}
                        className="metal-button rounded-xl px-6 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {humanScore >= targetScore ? '通過並結束' : '送出並繼續下一批'}
                      </button>
                    </div>
                  </article>
                )}

                <div className="space-y-3">
                  {iterations.map((iteration) => (
                    <article key={iteration.id} className="overflow-hidden rounded-[1.5rem] border border-[var(--border-soft)] bg-white">
                      <div className="flex flex-col gap-4 border-b border-[var(--border-soft)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="text-sm font-semibold text-[var(--slate-900)]">第 {iteration.id} 輪</div>
                          <div className="mt-1 text-xs text-[var(--slate-500)]">
                            {iteration.status === 'producing' && '正在產生完整成果'}
                            {iteration.status === 'evaluating' && '正在接受獨立驗收'}
                            {iteration.status === 'complete' && `完成於 ${formatDuration(iteration.durationMs)}`}
                          </div>
                        </div>
                        {iteration.evaluation && (
                          <div className="flex items-center gap-3">
                            <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                              iteration.evaluation.passed
                                ? 'bg-[var(--emerald-50)] text-[var(--emerald-700)]'
                                : 'bg-[var(--amber-50)] text-[var(--amber-900)]'
                            }`}>
                              {iteration.evaluation.passed ? '模型達標' : '模型建議改善'}
                            </span>
                            <span className="text-2xl font-semibold text-[var(--slate-900)]">{iteration.evaluation.score}</span>
                          </div>
                        )}
                      </div>

                      {iteration.evaluation && (
                        <div className="grid gap-px bg-[var(--border-soft)] sm:grid-cols-2">
                          <div className="bg-[var(--amber-50)] px-5 py-4">
                            <div className="text-xs font-semibold text-[var(--amber-900)]">Evaluator 判斷</div>
                            <p className="mt-2 text-sm leading-7 text-[var(--slate-700)]">{iteration.evaluation.summary}</p>
                          </div>
                          <div className="bg-[var(--emerald-50)] px-5 py-4">
                            <div className="text-xs font-semibold text-[var(--emerald-800)]">下一輪只改善這件事</div>
                            <p className="mt-2 text-sm leading-7 text-[var(--slate-700)]">{iteration.evaluation.nextAction}</p>
                          </div>
                        </div>
                      )}

                      {iteration.artifact && (
                        <details className="group">
                          <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-[var(--slate-600)] hover:text-[var(--emerald-700)]">
                            查看本輪完整成果
                          </summary>
                          <div className="response-text border-t border-[var(--border-soft)] px-5 py-5 text-sm">{iteration.artifact}</div>
                        </details>
                      )}
                    </article>
                  ))}
                </div>

                {status !== 'running' && finalIteration?.artifact && (
                  <article className="rounded-[1.75rem] bg-[var(--slate-900)] p-5 text-white sm:p-7">
                    <div className="flex flex-col gap-2 border-b border-white/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
                      <h2 className="text-lg font-semibold">目前最佳成果</h2>
                      <span className="text-xs text-white/45">來自第 {finalIteration.id} 輪</span>
                    </div>
                    <div className="mt-5 whitespace-pre-wrap text-sm leading-8 text-white/75">{finalIteration.artifact}</div>
                  </article>
                )}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
