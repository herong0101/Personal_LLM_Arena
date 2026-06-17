// 跨模組交接：讓「模型競技場」選出的模型可以一鍵帶進其他模組（目前支援 Chat Studio）。
// 採用 localStorage 的一次性 payload，由目標模組在掛載時 consume（讀取後即清除）。

const STUDIO_HANDOFF_KEY = 'arena_handoff_studio_v1';

export interface StudioHandoff {
  modelId: string;
  modelName: string;
  /** 來源模組，用於標題與追蹤，例如 'arena'。 */
  source: string;
  createdAt: number;
}

export function setStudioHandoff(payload: Omit<StudioHandoff, 'createdAt'>): void {
  if (typeof window === 'undefined') return;

  try {
    const record: StudioHandoff = { ...payload, createdAt: Date.now() };
    window.localStorage.setItem(STUDIO_HANDOFF_KEY, JSON.stringify(record));
  } catch (error) {
    console.error('Failed to set studio handoff:', error);
  }
}

/** 讀取並清除待處理的 Studio 交接（一次性）。 */
export function consumeStudioHandoff(): StudioHandoff | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(STUDIO_HANDOFF_KEY);
    if (!raw) return null;

    window.localStorage.removeItem(STUDIO_HANDOFF_KEY);
    const parsed = JSON.parse(raw) as Partial<StudioHandoff>;

    if (typeof parsed?.modelId !== 'string' || typeof parsed?.modelName !== 'string') {
      return null;
    }

    return {
      modelId: parsed.modelId,
      modelName: parsed.modelName,
      source: typeof parsed.source === 'string' ? parsed.source : 'arena',
      createdAt: typeof parsed.createdAt === 'number' ? parsed.createdAt : Date.now(),
    };
  } catch (error) {
    console.error('Failed to consume studio handoff:', error);
    return null;
  }
}
