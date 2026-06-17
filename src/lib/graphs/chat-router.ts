import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import type { ArenaOrchestrationConfig, StreamChunk } from '@/types';
import {
  callGeminiImage,
  callOllama,
  callVllm,
  isCloudTextModelId,
  sanitizeModelResponse,
  streamCloudModel,
  type GeneratedImagePayload,
  type ProviderOptions,
} from '@/lib/cloud-providers';
import {
  runDebate,
  runExpertDiscussion,
  runPressureTest,
  validateDebateConfig,
  validateExpertConfig,
  validatePressureConfig,
} from '@/lib/graphs/orchestration';
import { LOCAL_OLLAMA_4090_API_URL, LOCAL_OLLAMA_5090_API_URL } from '@/lib/local-endpoints';

type LocalRuntimeConfig =
  | { kind: 'ollama'; apiUrl: string; model: string }
  | { kind: 'vllm'; apiUrl: string; model: string };

const LOCAL_MODEL_CONFIGS: Record<string, LocalRuntimeConfig> = {
  'local-vllm-4090-gemma-3-27b-it-qat': { kind: 'ollama', apiUrl: LOCAL_OLLAMA_4090_API_URL, model: 'gemma3:27b-it-qat' },
  'local-ollama-5090-translategemma-27b': { kind: 'ollama', apiUrl: LOCAL_OLLAMA_5090_API_URL, model: 'translategemma:27b' },
  'local-ollama-4090-translategemma-27b': { kind: 'ollama', apiUrl: LOCAL_OLLAMA_4090_API_URL, model: 'translategemma:27b' },
  'local-ollama-5090-translategemma-12b': { kind: 'ollama', apiUrl: LOCAL_OLLAMA_5090_API_URL, model: 'translategemma:12b' },
  'local-ollama-4090-translategemma-12b': { kind: 'ollama', apiUrl: LOCAL_OLLAMA_4090_API_URL, model: 'translategemma:12b' },
  'local-ollama-5090-translategemma-4b': { kind: 'ollama', apiUrl: LOCAL_OLLAMA_5090_API_URL, model: 'translategemma:4b' },
  'local-ollama-5090-medgemma-1.5-4b': { kind: 'ollama', apiUrl: LOCAL_OLLAMA_5090_API_URL, model: 'hf.co/unsloth/medgemma-1.5-4b-it-GGUF:Q4_K_M' },
  'local-ollama-4090-medgemma-1.5-4b': { kind: 'ollama', apiUrl: LOCAL_OLLAMA_4090_API_URL, model: 'MedAIBase/MedGemma1.5:4b-it-q4_0' },
  'local-ollama-5090-gpt-oss-20b': { kind: 'ollama', apiUrl: LOCAL_OLLAMA_5090_API_URL, model: 'gpt-oss:20b' },
  'local-ollama-4090-gpt-oss-20b': { kind: 'ollama', apiUrl: LOCAL_OLLAMA_4090_API_URL, model: 'gpt-oss:20b' },
  'local-ollama-5090-gpt-oss-20b-202511': { kind: 'ollama', apiUrl: LOCAL_OLLAMA_5090_API_URL, model: 'gpt-oss:20b-202511' },
  'local-ollama-5090-mistral-small3.2-24b': { kind: 'ollama', apiUrl: LOCAL_OLLAMA_5090_API_URL, model: 'mistral-small3.2:24b' },
  'local-ollama-5090-ministral-3-3b': { kind: 'ollama', apiUrl: LOCAL_OLLAMA_5090_API_URL, model: 'ministral-3:3b' },
  'local-ollama-4090-ministral-3-3b': { kind: 'ollama', apiUrl: LOCAL_OLLAMA_4090_API_URL, model: 'ministral-3:3b' },
  'local-ollama-5090-ministral-3-8b': { kind: 'ollama', apiUrl: LOCAL_OLLAMA_5090_API_URL, model: 'ministral-3:8b' },
  'local-ollama-4090-ministral-3-8b': { kind: 'ollama', apiUrl: LOCAL_OLLAMA_4090_API_URL, model: 'ministral-3:8b' },
  'local-ollama-5090-ministral-3-14b': { kind: 'ollama', apiUrl: LOCAL_OLLAMA_5090_API_URL, model: 'ministral-3:14b' },
  'local-ollama-4090-ministral-3-14b': { kind: 'ollama', apiUrl: LOCAL_OLLAMA_4090_API_URL, model: 'ministral-3:14b' },
  'local-ollama-4090-llama-breeze2-8b': { kind: 'ollama', apiUrl: LOCAL_OLLAMA_4090_API_URL, model: 'willqiu/Llama-Breeze2-8B-Instruct:latest' },
  'local-ollama-4090-phi4': { kind: 'ollama', apiUrl: LOCAL_OLLAMA_4090_API_URL, model: 'phi4:latest' },
  'local-ollama-4090-phi4-mini': { kind: 'ollama', apiUrl: LOCAL_OLLAMA_4090_API_URL, model: 'phi4-mini:latest' },
  'local-ollama-4090-gemma3-latest': { kind: 'ollama', apiUrl: LOCAL_OLLAMA_4090_API_URL, model: 'gemma3:latest' },
  'local-ollama-4090-gemma3-270m': { kind: 'ollama', apiUrl: LOCAL_OLLAMA_4090_API_URL, model: 'gemma3:270m' },
  'local-ollama-4090-gemma3n-e4b': { kind: 'ollama', apiUrl: LOCAL_OLLAMA_4090_API_URL, model: 'gemma3n:e4b' },
  'local-ollama-4090-gemma3-27b-it-qat': { kind: 'ollama', apiUrl: LOCAL_OLLAMA_4090_API_URL, model: 'gemma3:27b-it-qat' },
  'local-ollama-5090-gemma3-27b-it-qat': { kind: 'ollama', apiUrl: LOCAL_OLLAMA_5090_API_URL, model: 'gemma3:27b-it-qat' },
  'local-ollama-5090-gemma3-27b': { kind: 'ollama', apiUrl: LOCAL_OLLAMA_5090_API_URL, model: 'gemma3:27b' },
  'local-ollama-4090-gemma3-27b': { kind: 'ollama', apiUrl: LOCAL_OLLAMA_4090_API_URL, model: 'gemma3:27b' },
  'local-ollama-4090-gemma3-12b-it-qat': { kind: 'ollama', apiUrl: LOCAL_OLLAMA_4090_API_URL, model: 'gemma3:12b-it-qat' },
  'local-ollama-4090-gemma3-12b': { kind: 'ollama', apiUrl: LOCAL_OLLAMA_4090_API_URL, model: 'gemma3:12b' },
  'local-ollama-4090-amoral-gemma3-12b-v2-qat': { kind: 'ollama', apiUrl: LOCAL_OLLAMA_4090_API_URL, model: 'hf.co/soob3123/amoral-gemma3-12B-v2-qat-Q4_0-GGUF:latest' },
  'local-ollama-4090-granite-3.2-vision': { kind: 'ollama', apiUrl: LOCAL_OLLAMA_4090_API_URL, model: 'ollama.com/library/granite3.2-vision:latest' },
  'local-ollama-4090-msmall-3.1-q6': { kind: 'ollama', apiUrl: LOCAL_OLLAMA_4090_API_URL, model: 'djdeniro/msmall-3.1-q6:latest' },
  'local-ollama-4090-mistral-small': { kind: 'ollama', apiUrl: LOCAL_OLLAMA_4090_API_URL, model: 'mistral-small:latest' },
  'local-ollama-4090-mistral-small-3.1-24b-q4-ks': { kind: 'ollama', apiUrl: LOCAL_OLLAMA_4090_API_URL, model: 'cnjack/mistral-samll-3.1:24b-it-q4_K_S' },
  'local-ollama-4090-breeze-7b-instruct-v1-0': { kind: 'ollama', apiUrl: LOCAL_OLLAMA_4090_API_URL, model: 'Breeze-7B-Instruct-v1_0:latest' },
  'local-ollama-5090-nemotron-3-nano-30b': { kind: 'ollama', apiUrl: LOCAL_OLLAMA_5090_API_URL, model: 'nemotron-3-nano:30b' },
  'local-ollama-5090-granite-docling': { kind: 'ollama', apiUrl: LOCAL_OLLAMA_5090_API_URL, model: 'granite-docling:latest' },
  'local-ollama-5090-apriel-1.6-15b-thinker': { kind: 'ollama', apiUrl: LOCAL_OLLAMA_5090_API_URL, model: 'Apriel-1.6-15b-Thinker:Q4_K_M' },
  'local-ollama-5090-apriel-1.5-15b-thinker': { kind: 'ollama', apiUrl: LOCAL_OLLAMA_5090_API_URL, model: 'Apriel-1.5-15b-Thinker:Q4_K_M' },
  'local-ollama-5090-llama3.2-vision-11b': { kind: 'ollama', apiUrl: LOCAL_OLLAMA_5090_API_URL, model: 'llama3.2-vision:11b' },
};

interface Emitter {
  emit(chunk: StreamChunk): void;
}

export interface ChatGraphInput {
  modelId: string;
  prompt: string;
  orchestration?: ArenaOrchestrationConfig;
  options: ProviderOptions;
}

const ChatRouterState = Annotation.Root({
  modelId: Annotation<string>(),
  prompt: Annotation<string>(),
  orchestration: Annotation<ArenaOrchestrationConfig | undefined>(),
  options: Annotation<ProviderOptions>(),
  response: Annotation<string>({ reducer: (_, next) => next, default: () => '' }),
  images: Annotation<GeneratedImagePayload[]>({ reducer: (_, next) => next, default: () => [] }),
});

async function routerNode(
  state: typeof ChatRouterState.State,
  config: { configurable?: { emitter?: Emitter } }
) {
  const emitter = config.configurable?.emitter;
  const { modelId, prompt, orchestration, options } = state;

  if (modelId === 'arena-special-expert-discussion') {
    const cfg = validateExpertConfig(orchestration);
    return { response: await runExpertDiscussion(prompt, cfg, options, emitter) };
  }

  if (modelId === 'arena-special-debate') {
    const cfg = validateDebateConfig(orchestration);
    return { response: await runDebate(prompt, cfg, options, emitter) };
  }

  if (modelId === 'arena-special-pressure-test') {
    const cfg = validatePressureConfig(orchestration);
    return { response: await runPressureTest(prompt, cfg, options, emitter) };
  }

  if (modelId === 'gemini-3.1-flash-image-preview') {
    const result = await callGeminiImage(prompt, modelId, options);
    return { response: result.response, images: result.images };
  }

  if (isCloudTextModelId(modelId)) {
    let fullText = '';
    for await (const token of streamCloudModel(prompt, modelId, options)) {
      fullText += token;
      emitter?.emit({ type: 'token', content: token });
    }
    return { response: sanitizeModelResponse(fullText) };
  }

  if (modelId in LOCAL_MODEL_CONFIGS) {
    const cfg = LOCAL_MODEL_CONFIGS[modelId];
    const text =
      cfg.kind === 'ollama'
        ? await callOllama(prompt, cfg.apiUrl, cfg.model, options)
        : await callVllm(prompt, cfg.apiUrl, cfg.model, options);
    return { response: sanitizeModelResponse(text) };
  }

  throw new Error(`Unsupported model: ${modelId}`);
}

const chatRouterGraph = new StateGraph(ChatRouterState)
  .addNode('route-request', routerNode)
  .addEdge(START, 'route-request')
  .addEdge('route-request', END)
  .compile();

export async function runChatGraph(input: ChatGraphInput, emitter?: Emitter): Promise<{
  response: string;
  images?: GeneratedImagePayload[];
}> {
  try {
    const result = await chatRouterGraph.invoke(
      {
        ...input,
        response: '',
        images: [],
      },
      { configurable: { emitter } }
    );

    emitter?.emit({ type: 'done', response: result.response, images: result.images });
    return { response: result.response, images: result.images };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    emitter?.emit({ type: 'error', message });
    throw error;
  }
}
