/**
 * LangGraph StateGraph orchestration for multi-model arena modes.
 * Expert discussion, debate, and pressure test workflows.
 */

import { StateGraph, Annotation, START, END } from '@langchain/langgraph';
import type { StreamChunk, ArenaOrchestrationConfig } from '@/types';
import {
  streamCloudModel,
  resolveResponseTokenLimit,
  isCloudTextModelId,
  type ProviderOptions,
} from '@/lib/cloud-providers';

// Minimal StreamController interface used by orchestration nodes
interface Emitter {
  emit(chunk: StreamChunk): void;
}

function formatFailure(modelId: string, error: unknown): string {
  const message = error instanceof Error ? error.message : '未知錯誤';
  return `[${modelId}] 本輪未取得有效回應：${message}`;
}

async function streamToEmitter(
  prompt: string,
  modelId: string,
  options: ProviderOptions,
  emitter?: Emitter
): Promise<string> {
  let fullText = '';
  try {
    for await (const token of streamCloudModel(prompt, modelId, options)) {
      fullText += token;
      emitter?.emit({ type: 'token', content: token });
    }
    return fullText.trim() || `[${modelId}] 本輪未取得有效文字回應。`;
  } catch (error) {
    const msg = formatFailure(modelId, error);
    emitter?.emit({ type: 'token', content: msg });
    return msg;
  }
}

// ── Expert Discussion ─────────────────────────────────────────────────────────

const ExpertState = Annotation.Root({
  prompt: Annotation<string>(),
  options: Annotation<ProviderOptions>(),
  memberModelIds: Annotation<string[]>(),
  synthesisModelId: Annotation<string>(),
  expertResponses: Annotation<Array<{ modelId: string; response: string }>>({
    reducer: (a, b) => [...a, ...b],
    default: () => [],
  }),
  finalResponse: Annotation<string>({ reducer: (_, b) => b, default: () => '' }),
});

function makeExpertNode(idx: number) {
  return async (
    state: typeof ExpertState.State,
    config: { configurable?: { emitter?: Emitter } }
  ) => {
    const emitter = config.configurable?.emitter;
    const modelId = state.memberModelIds[idx];
    emitter?.emit({ type: 'stage', name: `expert-${idx + 1}`, label: `專家 ${idx + 1}` });

    const options: ProviderOptions = {
      ...state.options,
      systemPrompt: [
        '你是專家討論會成員。請直接提出你最有判斷力的分析、風險提醒、例外情境與建議。',
        '不要模擬對話，不要提到其他模型，也不要描述你正在參與會議。',
        state.options.systemPrompt?.trim() ?? '',
      ]
        .filter(Boolean)
        .join('\n\n'),
      responseTokenLimit: Math.min(resolveResponseTokenLimit(state.options.responseTokenLimit), 3072),
      temperature: 0.35,
    };

    const response = await streamToEmitter(state.prompt, modelId, options, emitter);
    return { expertResponses: [{ modelId, response }] };
  };
}

async function synthesizerNode(
  state: typeof ExpertState.State,
  config: { configurable?: { emitter?: Emitter } }
) {
  const emitter = config.configurable?.emitter;
  emitter?.emit({ type: 'stage', name: 'synthesis', label: '統整結果' });

  const synthesisPrompt = [
    '使用者題目如下，後面附上三位專家模型對同一題的意見。',
    '請直接輸出給使用者的單一最終答案。',
    '你必須整合共識、吸收有價值的分歧，補足關鍵限制與建議。',
    '不要提到專家、模型、討論會、正反意見或任何投票過程。',
    `題目：\n${state.prompt}`,
    ...state.expertResponses.map((item, i) => `意見 ${i + 1}：\n${item.response}`),
  ].join('\n\n');

  const options: ProviderOptions = {
    ...state.options,
    systemPrompt: [
      '你是最終統整者。請把多方專家意見濃縮成像單一高品質模型寫出的最終答案。',
      '不要暴露任何討論過程、來源模型、角色分工或中間筆記。',
      state.options.systemPrompt?.trim() ?? '',
    ]
      .filter(Boolean)
      .join('\n\n'),
    temperature: 0.3,
  };

  const finalResponse = await streamToEmitter(synthesisPrompt, state.synthesisModelId, options, emitter);
  return {
    finalResponse: finalResponse || '本輪統整模型未回傳有效內容，請改用其他模型組合再試一次。',
  };
}

const expertDiscussionGraph = new StateGraph(ExpertState)
  .addNode('expert1', makeExpertNode(0))
  .addNode('expert2', makeExpertNode(1))
  .addNode('expert3', makeExpertNode(2))
  .addNode('synthesizer', synthesizerNode)
  .addEdge(START, 'expert1')
  .addEdge('expert1', 'expert2')
  .addEdge('expert2', 'expert3')
  .addEdge('expert3', 'synthesizer')
  .addEdge('synthesizer', END)
  .compile();

// ── Debate ────────────────────────────────────────────────────────────────────

const DebateState = Annotation.Root({
  prompt: Annotation<string>(),
  options: Annotation<ProviderOptions>(),
  propositionModelId: Annotation<string>(),
  oppositionModelId: Annotation<string>(),
  judgeModelId: Annotation<string>(),
  propositionResponse: Annotation<string>({ reducer: (_, b) => b, default: () => '' }),
  oppositionResponse: Annotation<string>({ reducer: (_, b) => b, default: () => '' }),
  finalResponse: Annotation<string>({ reducer: (_, b) => b, default: () => '' }),
});

async function propositionNode(
  state: typeof DebateState.State,
  config: { configurable?: { emitter?: Emitter } }
) {
  const emitter = config.configurable?.emitter;
  emitter?.emit({ type: 'stage', name: 'proposition', label: '正方論述' });

  const options: ProviderOptions = {
    ...state.options,
    systemPrompt: [
      '你是辯論中的先發主張者。請先提出你認為最合理、最完整的答案。',
      '回答要有論點、依據、限制與建議，但不要提到辯論流程。',
      state.options.systemPrompt?.trim() ?? '',
    ]
      .filter(Boolean)
      .join('\n\n'),
    temperature: 0.35,
  };

  const propositionResponse = await streamToEmitter(
    state.prompt,
    state.propositionModelId,
    options,
    emitter
  );
  return { propositionResponse };
}

async function oppositionNode(
  state: typeof DebateState.State,
  config: { configurable?: { emitter?: Emitter } }
) {
  const emitter = config.configurable?.emitter;
  emitter?.emit({ type: 'stage', name: 'opposition', label: '反方論述' });

  const oppositionPrompt = [
    `原始題目：\n${state.prompt}`,
    `先發主張：\n${state.propositionResponse}`,
    '請扮演反對者，找出上述答案中最值得質疑、挑戰、補充或修正的地方。',
    '你的重點是指出漏洞、錯誤假設、忽略的風險或更好的替代觀點。',
  ].join('\n\n');

  const options: ProviderOptions = {
    ...state.options,
    systemPrompt: [
      '你是辯論中的反對者。你的任務是嚴格挑戰前一位模型的答案。',
      '不要客套，不要重述整題，只聚焦在反駁與修正。',
      state.options.systemPrompt?.trim() ?? '',
    ]
      .filter(Boolean)
      .join('\n\n'),
    temperature: 0.35,
  };

  const oppositionResponse = await streamToEmitter(
    oppositionPrompt,
    state.oppositionModelId,
    options,
    emitter
  );
  return { oppositionResponse };
}

async function judgeNode(
  state: typeof DebateState.State,
  config: { configurable?: { emitter?: Emitter } }
) {
  const emitter = config.configurable?.emitter;
  emitter?.emit({ type: 'stage', name: 'judgment', label: '裁判判決' });

  const judgePrompt = [
    `使用者題目：\n${state.prompt}`,
    `主張方內容：\n${state.propositionResponse}`,
    `反對方內容：\n${state.oppositionResponse}`,
    '請判定哪一方更有道理，並整理成給使用者的最終答案。',
    '輸出應像單一模型的成熟回答，可以先簡短指出哪一方論證更站得住腳，再給出整理後的觀點與建議。',
    '不要逐字轉錄辯論，也不要提到模型名稱。',
  ].join('\n\n');

  const options: ProviderOptions = {
    ...state.options,
    systemPrompt: [
      '你是辯論裁判。請以證據、邏輯完整性、風險意識與可執行性來判定哪一方較有說服力。',
      '最終輸出要像單一模型的回答，而不是會議紀錄。',
      state.options.systemPrompt?.trim() ?? '',
    ]
      .filter(Boolean)
      .join('\n\n'),
    temperature: 0.25,
  };

  const finalResponse = await streamToEmitter(judgePrompt, state.judgeModelId, options, emitter);
  return {
    finalResponse: finalResponse || '本輪裁判模型未回傳有效內容，請改用其他模型組合再試一次。',
  };
}

const debateGraph = new StateGraph(DebateState)
  .addNode('proposition', propositionNode)
  .addNode('opposition', oppositionNode)
  .addNode('judge', judgeNode)
  .addEdge(START, 'proposition')
  .addEdge('proposition', 'opposition')
  .addEdge('opposition', 'judge')
  .addEdge('judge', END)
  .compile();

// ── Pressure Test ─────────────────────────────────────────────────────────────

const PressureState = Annotation.Root({
  prompt: Annotation<string>(),
  options: Annotation<ProviderOptions>(),
  targetModelId: Annotation<string>(),
  attackerModelIds: Annotation<string[]>(),
  initialResponse: Annotation<string>({ reducer: (_, b) => b, default: () => '' }),
  attackerResponses: Annotation<Array<{ modelId: string; response: string }>>({
    reducer: (a, b) => [...a, ...b],
    default: () => [],
  }),
  finalResponse: Annotation<string>({ reducer: (_, b) => b, default: () => '' }),
});

async function initialAnswerNode(
  state: typeof PressureState.State,
  config: { configurable?: { emitter?: Emitter } }
) {
  const emitter = config.configurable?.emitter;
  emitter?.emit({ type: 'stage', name: 'initial', label: '受測模型初始回應' });

  const options: ProviderOptions = {
    ...state.options,
    systemPrompt: [
      '你是受測模型。請先就使用者問題給出你目前最完整、最有把握的原始答案。',
      '先正常回答，不要預先替自己辯護，也不要提到壓力測試流程。',
      state.options.systemPrompt?.trim() ?? '',
    ]
      .filter(Boolean)
      .join('\n\n'),
    temperature: 0.35,
  };

  const initialResponse = await streamToEmitter(state.prompt, state.targetModelId, options, emitter);
  return { initialResponse };
}

function makeAttackerNode(idx: number) {
  return async (
    state: typeof PressureState.State,
    config: { configurable?: { emitter?: Emitter } }
  ) => {
    const emitter = config.configurable?.emitter;
    const modelId = state.attackerModelIds[idx];
    emitter?.emit({ type: 'stage', name: `attack-${idx + 1}`, label: `攻擊者 ${idx + 1} 挑戰` });

    const attackerPrompt = [
      `使用者題目：\n${state.prompt}`,
      `受測模型原始答案：\n${state.initialResponse}`,
      '請你從強勢專家或高壓審查者角度，盡可能挑出這份答案最脆弱、最值得攻擊的地方。',
      '你應該指出邏輯漏洞、證據不足、過度自信、忽略情境、風險與反例。',
    ].join('\n\n');

    const options: ProviderOptions = {
      ...state.options,
      systemPrompt: [
        `你是攻擊者 ${idx + 1}。請自稱為強勢專家、嚴格審查者或高標準顧問。`,
        '你的任務不是平衡討論，而是施加壓力、提出尖銳質疑、逼迫對方修正漏洞。',
        '不要幫受測模型說話。',
        state.options.systemPrompt?.trim() ?? '',
      ]
        .filter(Boolean)
        .join('\n\n'),
      responseTokenLimit: Math.min(resolveResponseTokenLimit(state.options.responseTokenLimit), 3072),
      temperature: 0.45,
    };

    const response = await streamToEmitter(attackerPrompt, modelId, options, emitter);
    return { attackerResponses: [{ modelId, response }] };
  };
}

async function reconsiderNode(
  state: typeof PressureState.State,
  config: { configurable?: { emitter?: Emitter } }
) {
  const emitter = config.configurable?.emitter;
  emitter?.emit({ type: 'stage', name: 'reconsider', label: '受測模型重新考量' });

  const reconsiderPrompt = [
    `使用者題目：\n${state.prompt}`,
    `你先前的原始答案：\n${state.initialResponse}`,
    ...state.attackerResponses.map((item, i) => `攻擊意見 ${i + 1}：\n${item.response}`),
    '現在請重新審視自己的立場。',
    '如果你認為攻擊成立，就修正答案；如果你認為原本立場仍然成立，就說明為何不改變。',
    '最終輸出必須是給使用者的單一成熟答案，可以自然帶出你是否調整立場，但不要寫成會議紀錄。',
  ].join('\n\n');

  const options: ProviderOptions = {
    ...state.options,
    systemPrompt: [
      '你是接受壓力測試後再次作答的模型。',
      '請誠實面對兩位強勢攻擊者的質疑，必要時修正立場，不必要時清楚捍衛原先觀點。',
      '最終輸出要像單一模型在深思後寫出的答案。',
      state.options.systemPrompt?.trim() ?? '',
    ]
      .filter(Boolean)
      .join('\n\n'),
    temperature: 0.25,
  };

  const finalResponse = await streamToEmitter(
    reconsiderPrompt,
    state.targetModelId,
    options,
    emitter
  );
  return { finalResponse };
}

const pressureTestGraph = new StateGraph(PressureState)
  .addNode('initial', initialAnswerNode)
  .addNode('attacker1', makeAttackerNode(0))
  .addNode('attacker2', makeAttackerNode(1))
  .addNode('reconsider', reconsiderNode)
  .addEdge(START, 'initial')
  .addEdge('initial', 'attacker1')
  .addEdge('attacker1', 'attacker2')
  .addEdge('attacker2', 'reconsider')
  .addEdge('reconsider', END)
  .compile();

// ── Validation helpers ────────────────────────────────────────────────────────

function assertCloud(modelId: string, role: string): void {
  if (!isCloudTextModelId(modelId)) {
    throw new Error(`${role} 必須使用雲端文字模型，目前收到：${modelId}`);
  }
}

export function validateExpertConfig(
  orchestration: ArenaOrchestrationConfig | undefined
): Extract<ArenaOrchestrationConfig, { kind: 'expert-discussion' }> {
  if (!orchestration || orchestration.kind !== 'expert-discussion')
    throw new Error('專家討論模式缺少有效設定');
  if (orchestration.memberModelIds.length !== 3)
    throw new Error('專家討論模式必須指定 3 個成員模型');
  if (new Set(orchestration.memberModelIds).size !== 3)
    throw new Error('專家討論模式的 3 個成員模型必須互不重複');
  orchestration.memberModelIds.forEach((id, i) => assertCloud(id, `專家成員 ${i + 1}`));
  assertCloud(orchestration.synthesisModelId, '統整者');
  return orchestration;
}

export function validateDebateConfig(
  orchestration: ArenaOrchestrationConfig | undefined
): Extract<ArenaOrchestrationConfig, { kind: 'debate' }> {
  if (!orchestration || orchestration.kind !== 'debate') throw new Error('辯論模式缺少有效設定');
  assertCloud(orchestration.propositionModelId, '正方');
  assertCloud(orchestration.oppositionModelId, '反方');
  assertCloud(orchestration.judgeModelId, '裁判');
  return orchestration;
}

export function validatePressureConfig(
  orchestration: ArenaOrchestrationConfig | undefined
): Extract<ArenaOrchestrationConfig, { kind: 'pressure-test' }> {
  if (!orchestration || orchestration.kind !== 'pressure-test')
    throw new Error('壓力測試模式缺少有效設定');
  assertCloud(orchestration.targetModelId, '受測模型');
  if (orchestration.attackerModelIds.length !== 2)
    throw new Error('壓力測試模式必須指定 2 個攻擊模型');
  orchestration.attackerModelIds.forEach((id, i) => assertCloud(id, `攻擊者 ${i + 1}`));
  return orchestration;
}

// ── Public run functions ──────────────────────────────────────────────────────

export async function runExpertDiscussion(
  prompt: string,
  config: Extract<ArenaOrchestrationConfig, { kind: 'expert-discussion' }>,
  options: ProviderOptions,
  emitter?: Emitter
): Promise<string> {
  const result = await expertDiscussionGraph.invoke(
    {
      prompt,
      options,
      memberModelIds: config.memberModelIds,
      synthesisModelId: config.synthesisModelId,
      expertResponses: [],
      finalResponse: '',
    },
    { configurable: { emitter } }
  );
  return result.finalResponse;
}

export async function runDebate(
  prompt: string,
  config: Extract<ArenaOrchestrationConfig, { kind: 'debate' }>,
  options: ProviderOptions,
  emitter?: Emitter
): Promise<string> {
  const result = await debateGraph.invoke(
    {
      prompt,
      options,
      propositionModelId: config.propositionModelId,
      oppositionModelId: config.oppositionModelId,
      judgeModelId: config.judgeModelId,
      propositionResponse: '',
      oppositionResponse: '',
      finalResponse: '',
    },
    { configurable: { emitter } }
  );
  return result.finalResponse;
}

export async function runPressureTest(
  prompt: string,
  config: Extract<ArenaOrchestrationConfig, { kind: 'pressure-test' }>,
  options: ProviderOptions,
  emitter?: Emitter
): Promise<string> {
  const result = await pressureTestGraph.invoke(
    {
      prompt,
      options,
      targetModelId: config.targetModelId,
      attackerModelIds: config.attackerModelIds,
      initialResponse: '',
      attackerResponses: [],
      finalResponse: '',
    },
    { configurable: { emitter } }
  );

  const initial = result.initialResponse.trim() || '本輪受測模型未回傳有效的初始內容。';
  const final =
    result.finalResponse.trim() ||
    '本輪受測模型在壓力測試後未回傳有效內容，請改用其他模型組合再試一次。';
  return `初始回應：\n\n${initial}\n\n被挑戰後的回應：\n\n${final}`;
}
