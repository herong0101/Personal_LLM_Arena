import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import { AVAILABLE_MODELS } from '@/config/models';
import type { NoCodeGraphDefinition, NoCodeGraphEdge, NoCodeGraphRunResult, NoCodeGraphStep } from '@/types';
import { runChatGraph } from '@/lib/graphs/chat-router';

const GraphBuilderState = Annotation.Root({
  input: Annotation<string>(),
  outputs: Annotation<Record<string, string>>({
    reducer: (current, next) => ({ ...current, ...next }),
    default: () => ({}),
  }),
  results: Annotation<NoCodeGraphRunResult[]>({
    reducer: (current, next) => [...current, ...next],
    default: () => [],
  }),
});

function renderTemplate(template: string, input: string, previous: string): string {
  const base = template.trim() || '{{input}}';
  return base
    .replaceAll('{{input}}', input)
    .replaceAll('{{previous}}', previous || input);
}

function validateDefinition(definition: NoCodeGraphDefinition): NoCodeGraphStep[] {
  const modelIds = new Set(
    AVAILABLE_MODELS.filter((model) => model.available && model.capabilities?.includes('chat')).map(
      (model) => model.id
    )
  );

  const steps = definition.steps.filter((step) => step.id && step.modelId);

  if (steps.length === 0) {
    throw new Error('Graph 至少需要一個模型節點。');
  }

  steps.forEach((step) => {
    if (!modelIds.has(step.modelId)) {
      throw new Error(`不支援的模型節點：${step.modelId}`);
    }
  });

  return steps;
}

function normalizeEdges(steps: NoCodeGraphStep[], edges?: NoCodeGraphEdge[]): NoCodeGraphEdge[] {
  const stepIds = new Set(steps.map((step) => step.id));
  const validEdges = (edges ?? []).filter((edge) => stepIds.has(edge.from) && stepIds.has(edge.to) && edge.from !== edge.to);

  if (validEdges.length > 0) {
    return validEdges;
  }

  return steps.slice(0, -1).map((step, index) => ({
    id: `${step.id}-${steps[index + 1].id}`,
    from: step.id,
    to: steps[index + 1].id,
  }));
}

function sortStepsByEdges(steps: NoCodeGraphStep[], edges: NoCodeGraphEdge[]): NoCodeGraphStep[] {
  const byId = new Map(steps.map((step) => [step.id, step]));
  const incoming = new Map(steps.map((step) => [step.id, 0]));
  const outgoing = new Map<string, string[]>();

  edges.forEach((edge) => {
    outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge.to]);
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
  });

  const queue = steps.filter((step) => (incoming.get(step.id) ?? 0) === 0);
  const ordered: NoCodeGraphStep[] = [];

  while (queue.length > 0) {
    const step = queue.shift()!;
    ordered.push(step);

    (outgoing.get(step.id) ?? []).forEach((nextId) => {
      const nextIncoming = (incoming.get(nextId) ?? 0) - 1;
      incoming.set(nextId, nextIncoming);
      if (nextIncoming === 0) {
        const nextStep = byId.get(nextId);
        if (nextStep) queue.push(nextStep);
      }
    });
  }

  if (ordered.length !== steps.length) {
    throw new Error('Graph 目前不支援循環關係，請移除形成迴圈的連線。');
  }

  return ordered;
}

function formatPreviousOutputs(
  incomingStepIds: string[],
  stepsById: Map<string, NoCodeGraphStep>,
  outputs: Record<string, string>
) {
  if (incomingStepIds.length === 0) return '';
  if (incomingStepIds.length === 1) return outputs[incomingStepIds[0]] ?? '';

  return incomingStepIds
    .map((stepId) => {
      const label = stepsById.get(stepId)?.label || stepId;
      const output = outputs[stepId] || '（尚無輸出）';
      return `【${label}】\n${output}`;
    })
    .join('\n\n');
}

function createModelNode(
  step: NoCodeGraphStep,
  incomingStepIds: string[],
  stepsById: Map<string, NoCodeGraphStep>
) {
  return async (state: typeof GraphBuilderState.State) => {
    const previous = formatPreviousOutputs(incomingStepIds, stepsById, state.outputs);
    const prompt = renderTemplate(step.promptTemplate, state.input, previous);
    const startedAt = Date.now();
    const result = await runChatGraph({
      modelId: step.modelId,
      prompt,
      options: {
        responseTokenLimit: 4096,
        temperature: 0.35,
      },
    });

    const output = result.response.trim();

    return {
      outputs: { [step.id]: output },
      results: [
        {
          stepId: step.id,
          label: step.label || step.id,
          modelId: step.modelId,
          output,
          durationMs: Date.now() - startedAt,
        },
      ],
    };
  };
}

type DynamicGraphBuilder = {
  addNode: (id: string, node: ReturnType<typeof createModelNode>) => DynamicGraphBuilder;
  addEdge: (from: string | string[], to: string) => DynamicGraphBuilder;
  compile: () => {
    invoke: (input: typeof GraphBuilderState.State) => Promise<typeof GraphBuilderState.State>;
  };
};

export async function runNoCodeGraph(
  definition: NoCodeGraphDefinition,
  input: string
): Promise<NoCodeGraphRunResult[]> {
  const steps = validateDefinition(definition);
  const edges = normalizeEdges(steps, definition.edges);
  const orderedSteps = sortStepsByEdges(steps, edges);
  const stepsById = new Map(steps.map((step) => [step.id, step]));
  const incomingByStep = new Map(steps.map((step) => [step.id, [] as string[]]));
  const outgoingByStep = new Map(steps.map((step) => [step.id, [] as string[]]));
  let builder = new StateGraph(GraphBuilderState) as unknown as DynamicGraphBuilder;

  edges.forEach((edge) => {
    incomingByStep.get(edge.to)?.push(edge.from);
    outgoingByStep.get(edge.from)?.push(edge.to);
  });

  orderedSteps.forEach((step) => {
    builder = builder.addNode(step.id, createModelNode(step, incomingByStep.get(step.id) ?? [], stepsById));
  });

  orderedSteps
    .filter((step) => (incomingByStep.get(step.id) ?? []).length === 0)
    .forEach((step) => {
      builder = builder.addEdge(START, step.id);
    });

  orderedSteps
    .filter((step) => (incomingByStep.get(step.id) ?? []).length > 0)
    .forEach((step) => {
      const incoming = incomingByStep.get(step.id) ?? [];
      builder = builder.addEdge(incoming.length === 1 ? incoming[0] : incoming, step.id);
    });

  orderedSteps
    .filter((step) => (outgoingByStep.get(step.id) ?? []).length === 0)
    .forEach((step) => {
      builder = builder.addEdge(step.id, END);
    });

  const graph = builder.compile();
  const result = await graph.invoke({
    input,
    outputs: {},
    results: [],
  });

  return result.results;
}
