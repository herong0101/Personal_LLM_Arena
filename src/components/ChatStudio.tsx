'use client';

import Image from 'next/image';
import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  AVAILABLE_MODELS,
  STUDIO_DEFAULT_EXPERT_MODEL_IDS,
  STUDIO_DEFAULT_IMAGE_MODEL_ID,
  STUDIO_DEFAULT_MODEL_ID,
  STUDIO_MODE_LABELS,
} from '@/config/models';
import { callImageModel, callModel } from '@/lib/api';
import { consumeStudioHandoff } from '@/lib/handoff';
import {
  clearActiveStudioConversationId,
  loadActiveStudioConversationId,
  loadStudioConversations,
  saveActiveStudioConversationId,
  saveStudioConversations,
} from '@/lib/studio-storage';
import { StudioConversation, StudioDocument, StudioGeneratedImage, StudioMessage, StudioMode } from '@/types';
import PromptComposer from './PromptComposer';

const DIRECT_CONTEXT_TOKEN_LIMIT = 1000;
const SUMMARY_OUTPUT_TOKEN_LIMIT = 1200;
const CHAT_OUTPUT_TOKEN_LIMIT = 4096;
const IMAGE_OUTPUT_TOKEN_LIMIT = 1200;
const EXPERT_MEMBER_OUTPUT_TOKEN_LIMIT = 4096;
const EXPERT_SYNTHESIS_OUTPUT_TOKEN_LIMIT = 4096;
const MAX_DOCUMENT_CHARS = 12000;
const MAX_DOCUMENT_SIZE_BYTES = 1024 * 1024;
const SUPPORTED_TEXT_EXTENSIONS = ['txt', 'md', 'csv', 'json', 'tsv', 'log'];

function ComposeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function ChevronIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <path d={isOpen ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'} />
    </svg>
  );
}

function estimateTokens(value: string): number {
  return Math.ceil(value.length / 4);
}

function estimateMessagesTokens(messages: StudioMessage[]): number {
  return messages.reduce((total, message) => total + estimateTokens(message.content), 0);
}

function deriveConversationTitle(input: string): string {
  const text = input.trim().replace(/\s+/g, ' ');
  return text.length > 24 ? `${text.slice(0, 24)}...` : text || '新對話';
}

function getModelName(modelId: string): string {
  return AVAILABLE_MODELS.find((model) => model.id === modelId)?.name || modelId;
}

function isValidStudioMode(value: string): value is StudioMode {
  return value in STUDIO_MODE_LABELS;
}

function normalizeStudioConversation(conversation: StudioConversation): StudioConversation {
  const now = Date.now();
  const textCapableModelIds = AVAILABLE_MODELS.filter((model) => model.capabilities?.includes('chat')).map((model) => model.id);
  const imageCapableModelIds = AVAILABLE_MODELS.filter((model) => model.capabilities?.includes('image')).map((model) => model.id);
  const resolvedMode =
    typeof conversation.settings?.mode === 'string' && isValidStudioMode(conversation.settings.mode)
      ? conversation.settings.mode
      : 'chat';
  const requestedModelId = conversation.settings?.activeModelId;

  let activeModelId =
    typeof requestedModelId === 'string' && AVAILABLE_MODELS.some((model) => model.id === requestedModelId)
      ? requestedModelId
      : STUDIO_DEFAULT_MODEL_ID;

  if (resolvedMode === 'image' && !imageCapableModelIds.includes(activeModelId)) {
    activeModelId = STUDIO_DEFAULT_IMAGE_MODEL_ID;
  }

  if (resolvedMode !== 'image' && !textCapableModelIds.includes(activeModelId)) {
    activeModelId = STUDIO_DEFAULT_MODEL_ID;
  }

  const expertModelIds = Array.isArray(conversation.settings?.expertModelIds)
    ? conversation.settings.expertModelIds.filter((modelId) => textCapableModelIds.includes(modelId)).slice(0, 3)
    : [];

  const normalizedMessages: StudioMessage[] = Array.isArray(conversation.messages)
    ? conversation.messages
        .filter((message) => message && typeof message.content === 'string')
        .map((message) => ({
          ...message,
          id: message.id || uuidv4(),
          role: message.role === 'user' ? 'user' : 'assistant',
          createdAt: typeof message.createdAt === 'number' ? message.createdAt : now,
        }))
    : [];

  const normalizedDocuments = Array.isArray(conversation.documents)
    ? conversation.documents.filter((document) => document && typeof document.content === 'string')
    : [];

  return {
    ...conversation,
    id: conversation.id || uuidv4(),
    title: typeof conversation.title === 'string' && conversation.title.trim() ? conversation.title : '新對話',
    createdAt: typeof conversation.createdAt === 'number' ? conversation.createdAt : now,
    updatedAt: typeof conversation.updatedAt === 'number' ? conversation.updatedAt : now,
    messages: normalizedMessages,
    documents: normalizedDocuments,
    memory: {
      summary: typeof conversation.memory?.summary === 'string' ? conversation.memory.summary : '',
      sourceMessageCount:
        typeof conversation.memory?.sourceMessageCount === 'number'
          ? conversation.memory.sourceMessageCount
          : 0,
      updatedAt:
        typeof conversation.memory?.updatedAt === 'number' ? conversation.memory.updatedAt : undefined,
    },
    settings: {
      activeModelId,
      mode: resolvedMode,
      expertModelIds: expertModelIds.length > 0 ? expertModelIds : STUDIO_DEFAULT_EXPERT_MODEL_IDS,
      useLongTermMemory:
        typeof conversation.settings?.useLongTermMemory === 'boolean'
          ? conversation.settings.useLongTermMemory
          : true,
      includeDocuments:
        typeof conversation.settings?.includeDocuments === 'boolean'
          ? conversation.settings.includeDocuments
          : true,
    },
  };
}

function createEmptyConversation(): StudioConversation {
  const now = Date.now();

  return {
    id: uuidv4(),
    title: '新對話',
    createdAt: now,
    updatedAt: now,
    messages: [],
    documents: [],
    memory: {
      summary: '',
      sourceMessageCount: 0,
    },
    settings: {
      activeModelId: STUDIO_DEFAULT_MODEL_ID,
      mode: 'chat',
      expertModelIds: STUDIO_DEFAULT_EXPERT_MODEL_IDS,
      useLongTermMemory: true,
      includeDocuments: true,
    },
  };
}

// 由跨模組交接（例如競技場冠軍）建立一個預設好模型的新對話。回傳 null 代表模型不適用於 Studio。
function createConversationFromHandoff(modelId: string, modelName: string): StudioConversation | null {
  const model = AVAILABLE_MODELS.find((item) => item.id === modelId);
  if (!model || model.isArenaSpecial || !model.capabilities?.includes('chat')) {
    return null;
  }

  const conversation = createEmptyConversation();
  return {
    ...conversation,
    title: `來自競技場 · ${modelName}`,
    settings: {
      ...conversation.settings,
      activeModelId: modelId,
    },
  };
}

function isTextDocument(file: File): boolean {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  return file.type.startsWith('text/') || SUPPORTED_TEXT_EXTENSIONS.includes(extension);
}

async function readDocument(file: File): Promise<StudioDocument> {
  if (!isTextDocument(file)) {
    throw new Error(`目前初版只支援 txt、md、csv、json、tsv、log 等文字型文件：${file.name}`);
  }

  if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
    throw new Error(`文件過大，請先縮小到 1 MB 內：${file.name}`);
  }

  const content = (await file.text()).trim();

  if (!content) {
    throw new Error(`文件內容為空白：${file.name}`);
  }

  return {
    id: uuidv4(),
    name: file.name,
    mimeType: file.type || 'text/plain',
    size: file.size,
    content: content.slice(0, MAX_DOCUMENT_CHARS),
    createdAt: Date.now(),
  };
}

function selectDirectMessages(messages: StudioMessage[]): StudioMessage[] {
  const selected: StudioMessage[] = [];
  let total = 0;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    const messageTokens = estimateTokens(message.content);

    if (selected.length > 0 && total + messageTokens > DIRECT_CONTEXT_TOKEN_LIMIT) {
      break;
    }

    selected.unshift(message);
    total += messageTokens;
  }

  return selected;
}

function buildDocumentContext(documents: StudioDocument[]): string {
  if (documents.length === 0) {
    return '無';
  }

  return documents
    .map(
      (document, index) =>
        `文件 ${index + 1}：${document.name}\n${document.content}`
    )
    .join('\n\n');
}

function buildTranscript(messages: StudioMessage[]): string {
  if (messages.length === 0) {
    return '無';
  }

  return messages
    .map((message) => `${message.role === 'user' ? '使用者' : '助理'}：${message.content}`)
    .join('\n\n');
}

function buildSystemPrompt(mode: StudioMode): string {
  switch (mode) {
    case 'reasoning':
      return '請提供精簡且可驗證的推理摘要，說明關鍵依據、判斷步驟與結論，但不要揭露內部思考過程。';
    case 'expert':
      return '請扮演專家討論的整合者，整理不同觀點、指出共識與分歧，最後給出可執行建議。';
    case 'image':
      return '這是一個圖片生成工作模式；若目前模型不支援圖片生成，請明確說明限制並提出可行替代做法。';
    default:
      return '請用清楚、直接、可執行的方式回答。';
  }
}

function buildPrompt(
  conversation: StudioConversation,
  directMessages: StudioMessage[],
  userPrompt: string
): string {
  const historyMessages =
    directMessages.at(-1)?.role === 'user' && directMessages.at(-1)?.content === userPrompt
      ? directMessages.slice(0, -1)
      : directMessages;
  const memoryBlock = conversation.settings.useLongTermMemory && conversation.memory.summary
    ? conversation.memory.summary
    : '無';
  const documentBlock = conversation.settings.includeDocuments
    ? buildDocumentContext(conversation.documents)
    : '使用者本輪未啟用文件上下文';

  return [
    '請根據以下資訊回應最新需求。',
    `對話模式：${STUDIO_MODE_LABELS[conversation.settings.mode]}`,
    `長期記憶摘要：\n${memoryBlock}`,
    `使用者文件資料：\n${documentBlock}`,
    `近期對話：\n${buildTranscript(historyMessages)}`,
    `最新使用者需求：\n${userPrompt}`,
  ].join('\n\n');
}

function buildImagePrompt(
  conversation: StudioConversation,
  directMessages: StudioMessage[],
  userPrompt: string
): string {
  const memoryBlock =
    conversation.settings.useLongTermMemory && conversation.memory.summary
      ? `長期記憶摘要：\n${conversation.memory.summary}`
      : '';
  const documentBlock =
    conversation.settings.includeDocuments && conversation.documents.length > 0
      ? `參考文件：\n${buildDocumentContext(conversation.documents)}`
      : '';
  const transcriptBlock = directMessages.length > 0 ? `近期對話：\n${buildTranscript(directMessages)}` : '';

  return [
    '請根據以下需求生成圖片。',
    '若圖片中有文字，請使用繁體中文。',
    memoryBlock,
    documentBlock,
    transcriptBlock,
    `圖片需求：\n${userPrompt}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

function buildImageDataUrl(image: StudioGeneratedImage): string {
  return `data:${image.mimeType};base64,${image.base64Data}`;
}

function base64ToBlob(base64Data: string, mimeType: string): Blob {
  const binary = window.atob(base64Data);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
}

function getImageFileExtension(mimeType: string): string {
  if (mimeType === 'image/jpeg') {
    return 'jpg';
  }

  return mimeType.split('/')[1] || 'png';
}

async function summarizeConversationMemory(conversation: StudioConversation): Promise<string> {
  const directMessages = selectDirectMessages(conversation.messages);
  const archivedMessages = conversation.messages.slice(0, conversation.messages.length - directMessages.length);

  if (estimateMessagesTokens(archivedMessages) <= DIRECT_CONTEXT_TOKEN_LIMIT) {
    return conversation.memory.summary;
  }

  if (
    conversation.memory.summary &&
    archivedMessages.length <= conversation.memory.sourceMessageCount
  ) {
    return conversation.memory.summary;
  }

  const summaryPrompt = [
    '請將以下對話整理成下次延續可直接使用的長期記憶。',
    '請保留：使用者背景、偏好、待完成事項、已確認結論、重要限制。',
    '請寫成精簡段落，不要使用 Markdown。',
    conversation.memory.summary ? `既有記憶：\n${conversation.memory.summary}` : '既有記憶：無',
    `要摘要的歷史對話：\n${buildTranscript(archivedMessages)}`,
  ].join('\n\n');

  return callModel(conversation.settings.activeModelId, summaryPrompt, {
    systemPrompt: '你是長期記憶整理助手。請只保留對未來對話有幫助的穩定資訊。',
    responseTokenLimit: SUMMARY_OUTPUT_TOKEN_LIMIT,
    temperature: 0.2,
  });
}

async function runSingleModelResponse(
  conversation: StudioConversation,
  userPrompt: string
): Promise<StudioMessage> {
  const directMessages = selectDirectMessages(conversation.messages);
  const content = await callModel(
    conversation.settings.activeModelId,
    buildPrompt(conversation, directMessages, userPrompt),
    {
      systemPrompt: buildSystemPrompt(conversation.settings.mode),
      responseTokenLimit: CHAT_OUTPUT_TOKEN_LIMIT,
      temperature: conversation.settings.mode === 'reasoning' ? 0.2 : 0.4,
    }
  );

  return {
    id: uuidv4(),
    role: 'assistant',
    content,
    createdAt: Date.now(),
    modelId: conversation.settings.activeModelId,
    label: getModelName(conversation.settings.activeModelId),
  };
}

async function runImageGeneration(
  conversation: StudioConversation,
  userPrompt: string
): Promise<StudioMessage> {
  const directMessages = selectDirectMessages(conversation.messages);
  const result = await callImageModel(
    conversation.settings.activeModelId,
    buildImagePrompt(conversation, directMessages, userPrompt),
    {
      systemPrompt: buildSystemPrompt('image'),
      responseTokenLimit: IMAGE_OUTPUT_TOKEN_LIMIT,
      temperature: 0.7,
    }
  );

  return {
    id: uuidv4(),
    role: 'assistant',
    content: result.response || `已生成 ${result.images.length} 張圖片。`,
    createdAt: Date.now(),
    modelId: conversation.settings.activeModelId,
    label: getModelName(conversation.settings.activeModelId),
    images: result.images.map((image) => ({
      id: uuidv4(),
      mimeType: image.mimeType,
      base64Data: image.data,
    })),
  };
}

async function runExpertDiscussion(
  conversation: StudioConversation,
  userPrompt: string
): Promise<StudioMessage> {
  const expertModelIds = conversation.settings.expertModelIds.slice(0, 3);
  const directMessages = selectDirectMessages(conversation.messages);
  const sharedPrompt = buildPrompt(conversation, directMessages, userPrompt);

  const expertResponses = await Promise.all(
    expertModelIds.map(async (modelId) => {
      try {
        const response = (await callModel(modelId, sharedPrompt, {
          systemPrompt:
            '你是專家討論成員。請提供完整、具判斷力且可執行的專業分析，並聚焦在依據、風險、建議與例外情境。',
          responseTokenLimit: EXPERT_MEMBER_OUTPUT_TOKEN_LIMIT,
          temperature: 0.4,
        })).trim();

        return {
          modelId,
          modelName: getModelName(modelId),
          response: response || '本輪未取得有效文字回應，可能是模型回傳空內容或暫時拒答。',
        };
      } catch (error) {
        return {
          modelId,
          modelName: getModelName(modelId),
          response:
            error instanceof Error
              ? `本輪未取得有效回應：${error.message}`
              : '本輪未取得有效回應：未知錯誤',
        };
      }
    })
  );

  const synthesisPrompt = [
    '以下是多位專家模型對同一題的意見。',
    '請整合成給使用者的最終答案，包含：共識、分歧、建議做法。',
    sharedPrompt,
    ...expertResponses.map(
      (item, index) => `專家 ${index + 1}（${item.modelName}）：\n${item.response}`
    ),
  ].join('\n\n');

  const synthesis = await callModel(conversation.settings.activeModelId, synthesisPrompt, {
    systemPrompt: buildSystemPrompt('expert'),
    responseTokenLimit: EXPERT_SYNTHESIS_OUTPUT_TOKEN_LIMIT,
    temperature: 0.3,
  });
  const normalizedSynthesis =
    synthesis.trim() || '本輪整合模型未回傳有效內容，請改用其他整合模型或重新送出。';

  const detailBlock = expertResponses
    .map((item) => `【${item.modelName}】\n${item.response}`)
    .join('\n\n');

  return {
    id: uuidv4(),
    role: 'assistant',
    content: `整合結論：\n${normalizedSynthesis}\n\n專家意見紀錄：\n${detailBlock}`,
    createdAt: Date.now(),
    modelId: conversation.settings.activeModelId,
    label: `專家討論 · ${getModelName(conversation.settings.activeModelId)}`,
  };
}

export default function ChatStudio() {
  const [conversations, setConversations] = useState<StudioConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isExpertModelsExpanded, setIsExpertModelsExpanded] = useState(false);
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadStudioState = async () => {
      try {
        const [storedConversations, storedActiveConversationId] = await Promise.all([
          loadStudioConversations(),
          loadActiveStudioConversationId(),
        ]);

        if (!isMounted) {
          return;
        }

        const normalizedConversations = storedConversations
          .filter((conversation) => conversation && typeof conversation === 'object')
          .map((conversation) => normalizeStudioConversation(conversation));

        // 跨模組交接：若是從競技場帶模型過來，建立一個預設好該模型的新對話並設為作用中。
        const handoff = consumeStudioHandoff();
        const handoffConversation = handoff
          ? createConversationFromHandoff(handoff.modelId, handoff.modelName)
          : null;

        if (normalizedConversations.length === 0) {
          const initialConversation = handoffConversation ?? createEmptyConversation();
          setConversations([initialConversation]);
          setActiveConversationId(initialConversation.id);
          setIsHydrated(true);
          return;
        }

        if (handoffConversation) {
          setConversations([handoffConversation, ...normalizedConversations]);
          setActiveConversationId(handoffConversation.id);
          setIsHydrated(true);
          return;
        }

        const resolvedActiveConversationId = normalizedConversations.some(
          (conversation) => conversation.id === storedActiveConversationId
        )
          ? storedActiveConversationId
          : normalizedConversations[0].id;

        setConversations(normalizedConversations);
        setActiveConversationId(resolvedActiveConversationId);
        setIsHydrated(true);
      } catch (error) {
        console.error('Failed to initialize Chat Studio state:', error);

        if (!isMounted) {
          return;
        }

        const initialConversation = createEmptyConversation();
        setConversations([initialConversation]);
        setActiveConversationId(initialConversation.id);
        setError('已自動回復 Chat Studio 狀態，若先前資料異常可重新建立對話。');
        setIsHydrated(true);
      }
    };

    void loadStudioState();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    void saveStudioConversations(conversations);
  }, [conversations, isHydrated]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (!activeConversationId) {
      void clearActiveStudioConversationId();
      return;
    }

    void saveActiveStudioConversationId(activeConversationId);
  }, [activeConversationId, isHydrated]);

  useEffect(() => {
    if (!isHydrated || conversations.length === 0) {
      return;
    }

    if (!activeConversationId || !conversations.some((conversation) => conversation.id === activeConversationId)) {
      setActiveConversationId(conversations[0].id);
    }
  }, [activeConversationId, conversations, isHydrated]);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId) || null,
    [activeConversationId, conversations]
  );

  useEffect(() => {
    if (activeConversation?.settings.mode !== 'expert') {
      setIsExpertModelsExpanded(false);
    }
  }, [activeConversation?.id, activeConversation?.settings.mode]);

  const availableTextModels = useMemo(
    () => AVAILABLE_MODELS.filter((model) => model.capabilities?.includes('chat')),
    []
  );

  const availableImageModels = useMemo(
    () => AVAILABLE_MODELS.filter((model) => model.capabilities?.includes('image')),
    []
  );

  const selectableModels =
    activeConversation?.settings.mode === 'image' ? availableImageModels : availableTextModels;
  const activeModel = AVAILABLE_MODELS.find((model) => model.id === activeConversation?.settings.activeModelId);

  const modeOptions = Object.keys(STUDIO_MODE_LABELS) as StudioMode[];

  const updateConversation = (conversationId: string, updater: (conversation: StudioConversation) => StudioConversation) => {
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === conversationId ? updater(conversation) : conversation
      )
    );
  };

  const createConversation = () => {
    const conversation = createEmptyConversation();
    setConversations((current) => [conversation, ...current]);
    setActiveConversationId(conversation.id);
    setDraft('');
    setError(null);
    setIsMobileSidebarOpen(false);
  };

  const deleteConversation = (conversationId: string) => {
    if (!window.confirm('確定要刪除目前對話嗎？此動作無法復原。')) {
      return;
    }

    const nextConversations = conversations.filter((conversation) => conversation.id !== conversationId);

    if (nextConversations.length === 0) {
      const replacement = createEmptyConversation();
      setConversations([replacement]);
      setActiveConversationId(replacement.id);
      setDraft('');
      setError(null);
      return;
    }

    setConversations(nextConversations);

    if (activeConversationId === conversationId) {
      setActiveConversationId(nextConversations[0].id);
    }

    setDraft('');
    setError(null);
  };

  const handleDocumentUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!activeConversation || !event.target.files?.length) {
      return;
    }

    setError(null);

    try {
      const documents = await Promise.all(Array.from(event.target.files).map((file) => readDocument(file)));

      updateConversation(activeConversation.id, (conversation) => ({
        ...conversation,
        updatedAt: Date.now(),
        documents: [...documents, ...conversation.documents],
      }));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : '文件讀取失敗');
    } finally {
      event.target.value = '';
    }
  };

  const handleConversationSetting = <K extends keyof StudioConversation['settings']>(
    key: K,
    value: StudioConversation['settings'][K]
  ) => {
    if (!activeConversation) {
      return;
    }

    updateConversation(activeConversation.id, (conversation) => ({
      ...conversation,
      updatedAt: Date.now(),
      settings: {
        ...conversation.settings,
        [key]: value,
      },
    }));
  };

  const handleModeChange = (mode: StudioMode) => {
    if (!activeConversation) {
      return;
    }

    const currentModel = AVAILABLE_MODELS.find(
      (model) => model.id === activeConversation.settings.activeModelId
    );
    let nextModelId = activeConversation.settings.activeModelId;

    if (mode === 'image') {
      if (!currentModel?.capabilities?.includes('image')) {
        nextModelId = STUDIO_DEFAULT_IMAGE_MODEL_ID;
      }
    } else if (!currentModel?.capabilities?.includes('chat')) {
      nextModelId = STUDIO_DEFAULT_MODEL_ID;
    }

    updateConversation(activeConversation.id, (conversation) => ({
      ...conversation,
      updatedAt: Date.now(),
      settings: {
        ...conversation.settings,
        mode,
        activeModelId: nextModelId,
      },
    }));
  };

  const toggleExpertModel = (modelId: string) => {
    if (!activeConversation) {
      return;
    }

    const current = activeConversation.settings.expertModelIds;
    const exists = current.includes(modelId);
    const next = exists
      ? current.filter((id) => id !== modelId)
      : [...current, modelId].slice(-3);

    handleConversationSetting('expertModelIds', next.length > 0 ? next : [activeConversation.settings.activeModelId]);
  };

  const handleDownloadImage = (image: StudioGeneratedImage, index: number) => {
    const blob = base64ToBlob(image.base64Data, image.mimeType);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const fileExtension = getImageFileExtension(image.mimeType);
    const conversationTitle = activeConversation?.title.replace(/\s+/g, '-') || 'generated-image';

    link.href = url;
    link.download = `${conversationTitle}-${index + 1}.${fileExtension}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleCopyImage = async (image: StudioGeneratedImage) => {
    try {
      if (!navigator.clipboard || typeof ClipboardItem === 'undefined' || !window.isSecureContext) {
        throw new Error('目前瀏覽器環境不支援直接複製圖片');
      }

      const blob = base64ToBlob(image.base64Data, image.mimeType);
      await navigator.clipboard.write([
        new ClipboardItem({
          [image.mimeType]: blob,
        }),
      ]);
    } catch (copyError) {
      setError(copyError instanceof Error ? copyError.message : '複製圖片失敗');
    }
  };

  const handleCopyMessage = async (content: string) => {
    try {
      if (!navigator.clipboard || !window.isSecureContext) {
        throw new Error('目前瀏覽器環境不支援直接複製文字');
      }

      await navigator.clipboard.writeText(content);
    } catch (copyError) {
      setError(copyError instanceof Error ? copyError.message : '複製文字失敗');
    }
  };

  const sendMessage = async () => {
    if (!activeConversation || !draft.trim() || isSending) {
      return;
    }

    const prompt = draft.trim();
    const timestamp = Date.now();
    const userMessage: StudioMessage = {
      id: uuidv4(),
      role: 'user',
      content: prompt,
      createdAt: timestamp,
    };

    setDraft('');
    setError(null);
    setIsSending(true);

    const conversationAfterUserMessage: StudioConversation = {
      ...activeConversation,
      title: activeConversation.messages.length === 0 ? deriveConversationTitle(prompt) : activeConversation.title,
      updatedAt: timestamp,
      messages: [...activeConversation.messages, userMessage],
    };

    updateConversation(activeConversation.id, () => conversationAfterUserMessage);

    try {
      let assistantMessage: StudioMessage;

      switch (conversationAfterUserMessage.settings.mode) {
        case 'expert':
          assistantMessage = await runExpertDiscussion(conversationAfterUserMessage, prompt);
          break;
        case 'image':
          assistantMessage = await runImageGeneration(conversationAfterUserMessage, prompt);
          break;
        default:
          assistantMessage = await runSingleModelResponse(conversationAfterUserMessage, prompt);
          break;
      }

      const finalConversation: StudioConversation = {
        ...conversationAfterUserMessage,
        updatedAt: assistantMessage.createdAt,
        messages: [...conversationAfterUserMessage.messages, assistantMessage],
      };

      updateConversation(activeConversation.id, () => finalConversation);

      if (finalConversation.settings.useLongTermMemory) {
        const summary = await summarizeConversationMemory(finalConversation);

        if (summary && summary !== finalConversation.memory.summary) {
          updateConversation(activeConversation.id, (conversation) => ({
            ...conversation,
            updatedAt: Date.now(),
            memory: {
              summary,
              updatedAt: Date.now(),
              sourceMessageCount: conversation.messages.length,
            },
          }));
        }
      }
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : '送出訊息失敗');
    } finally {
      setIsSending(false);
    }
  };

  if (!activeConversation) {
    return (
      <div className="page-shell flex h-screen items-center justify-center bg-white px-6 py-6">
        <div className="text-center">
          <div className="text-sm text-[var(--slate-500)]">Chat Studio 正在恢復對話狀態...</div>
        </div>
      </div>
    );
  }

  const isConversationEmpty = activeConversation.messages.length === 0;

  return (
    <div className="page-shell h-full overflow-hidden bg-white">
      {isMobileSidebarOpen && (
        <button
          type="button"
          aria-label="關閉對話列表"
          onClick={() => setIsMobileSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-[rgba(17,24,39,0.28)] backdrop-blur-[2px] lg:hidden"
        />
      )}

      <div
        className={`grid h-full grid-cols-1 ${
          isDesktopSidebarOpen ? 'lg:grid-cols-[244px_minmax(0,1fr)]' : 'lg:grid-cols-1'
        }`}
      >
        <aside
          className={`fixed inset-y-0 left-0 z-50 flex min-h-0 w-[min(20rem,88vw)] flex-col border-r border-[var(--border-soft)] bg-[#f7f7f5] px-3 py-4 transition-transform duration-300 lg:static lg:z-auto lg:w-auto lg:translate-x-0 ${
            isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } ${isDesktopSidebarOpen ? 'lg:flex' : 'lg:hidden'}`}
        >
          <div className="flex items-center justify-between gap-2 px-2 pb-3">
            <div>
              <div className="text-sm font-semibold text-[var(--slate-900)]">Chat Studio</div>
              <div className="mt-0.5 text-xs text-[var(--slate-500)]">本機對話</div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={createConversation}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--slate-900)] text-white transition-colors hover:bg-[var(--slate-700)]"
                aria-label="新增對話"
                title="新對話"
              >
                <ComposeIcon />
              </button>
              <button
                type="button"
                onClick={() => setIsMobileSidebarOpen(false)}
                className="soft-button h-9 rounded-full px-3 text-xs font-semibold lg:hidden"
              >
                關閉
              </button>
              <button
                type="button"
                onClick={() => setIsDesktopSidebarOpen(false)}
                className="soft-button hidden h-9 rounded-full px-3 text-xs font-semibold lg:inline-flex lg:items-center"
              >
                收合
              </button>
            </div>
          </div>

          <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
            <div className="space-y-1">
              {conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => {
                    setActiveConversationId(conversation.id);
                    setIsMobileSidebarOpen(false);
                  }}
                  className={`w-full rounded-xl px-3 py-2.5 text-left transition-colors ${
                    activeConversationId === conversation.id
                      ? 'bg-white text-[var(--slate-900)]'
                      : 'text-[var(--slate-600)] hover:bg-white/70 hover:text-[var(--slate-900)]'
                  }`}
                >
                  <div className="truncate text-sm font-medium">{conversation.title}</div>
                  <div className="mt-1 truncate text-xs text-[var(--slate-500)]">
                    {conversation.messages[conversation.messages.length - 1]?.content || STUDIO_MODE_LABELS[conversation.settings.mode]}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => deleteConversation(activeConversation.id)}
            className="mt-3 rounded-xl px-3 py-2 text-left text-xs text-[var(--slate-400)] transition-colors hover:bg-white/70 hover:text-[var(--rose-500)]"
          >
            刪除目前對話
          </button>
        </aside>

        <section className="flex min-h-0 flex-col bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border-soft)] px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setIsMobileSidebarOpen(true)}
                className="soft-button rounded-full px-3 py-2 text-xs font-semibold lg:hidden"
              >
                對話
              </button>
              <button
                type="button"
                onClick={() => setIsDesktopSidebarOpen((value) => !value)}
                className="soft-button hidden rounded-full px-3 py-2 text-xs font-semibold lg:inline-flex"
              >
                {isDesktopSidebarOpen ? '收合對話' : '展開對話'}
              </button>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-[var(--slate-900)]">{activeConversation.title}</div>
                <div className="truncate text-xs text-[var(--slate-500)]">
                  {STUDIO_MODE_LABELS[activeConversation.settings.mode]} · {getModelName(activeConversation.settings.activeModelId)}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={createConversation}
              className="shrink-0 rounded-full bg-[var(--slate-900)] px-3 py-2 text-xs font-semibold text-white"
            >
              新對話
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-8 sm:px-6">
            <div className="mx-auto flex h-full max-w-[920px] flex-col">
              {isConversationEmpty ? (
                <div className="flex flex-1 items-center justify-center px-4 text-center">
                  <div>
                    <div className="text-[clamp(2rem,4.2vw,3.6rem)] font-semibold tracking-[-0.04em] text-[var(--slate-800)]">
                      我們該從哪裡開始？
                    </div>
                    <p className="mt-4 text-base text-[var(--slate-500)]">
                      模式、模型與文件都在下方輸入框，直接 Enter 即可送出。
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-6 py-2">
              {activeConversation.messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`px-5 py-4 ${
                      message.images && message.images.length > 0 ? 'max-w-[92%]' : message.role === 'user' ? 'max-w-[76%]' : 'max-w-full'
                    } ${
                      message.role === 'user'
                        ? 'rounded-[1.65rem] bg-[var(--slate-900)] text-white'
                        : 'text-[var(--slate-700)]'
                    }`}
                  >
                    {(message.label || message.modelId) && (
                      <div className={`mb-2 text-xs font-semibold ${message.role === 'user' ? 'text-white/80' : 'text-[var(--slate-500)]'}`}>
                        {message.label || getModelName(message.modelId || '')}
                      </div>
                    )}
                    {message.content ? (
                      <div className={`response-text text-sm sm:text-base ${message.role === 'user' ? '!text-white' : ''}`}>
                        {message.content}
                      </div>
                    ) : null}
                    {message.content ? (
                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          onClick={() => void handleCopyMessage(message.content)}
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                            message.role === 'user'
                              ? 'bg-white/14 text-white hover:bg-white/20'
                              : 'soft-button text-[var(--slate-600)]'
                          }`}
                        >
                          複製文字
                        </button>
                      </div>
                    ) : null}
                    {message.images && message.images.length > 0 ? (
                      <div className="mt-4 grid gap-4 xl:grid-cols-2">
                        {message.images.map((image, index) => (
                          <div key={image.id} className="rounded-[1.25rem] bg-white/70 p-3">
                            <Image
                              src={buildImageDataUrl(image)}
                              alt={`生成圖片 ${index + 1}`}
                              width={1024}
                              height={1024}
                              unoptimized
                              className="h-auto w-full rounded-[1rem] border border-[var(--border-soft)] object-cover"
                            />
                            <div className="mt-3 flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => void handleCopyImage(image)}
                                className="soft-button rounded-xl px-3 py-2 text-xs font-semibold"
                              >
                                複製圖片
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDownloadImage(image, index)}
                                className="metal-button rounded-xl px-3 py-2 text-xs font-semibold text-white"
                              >
                                下載圖片
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}

              {isSending && (
                <div className="flex justify-start">
                  <div className="px-5 py-4 text-sm text-[var(--slate-500)]">
                    模型正在整理回應...
                  </div>
                </div>
              )}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white px-4 pb-5 pt-3">
            <div className="mx-auto max-w-[920px]">
              {error && (
                <div className="mb-3 rounded-2xl bg-[var(--rose-100)] px-4 py-3 text-sm text-[var(--rose-500)]">
                  {error}
                </div>
              )}
              {activeModel?.source === 'local' && (
                <div className="mb-3 rounded-2xl bg-[rgba(255,248,230,0.9)] px-4 py-3 text-sm text-[var(--gold-600)]">
                  目前地端推論伺服器可能無法連線；若送出失敗，請先切換至雲端模型。
                </div>
              )}

              <PromptComposer
                value={draft}
                onChange={setDraft}
                onSubmit={sendMessage}
                disabled={isSending}
                isLoading={isSending}
                placeholder={activeConversation.settings.mode === 'image' ? '描述您想生成的圖片...' : '想問點什麼？'}
                submitLabel="送出"
                leadingControls={
                  <>
                    <label className="inline-flex items-center rounded-full bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--slate-600)]">
                      <select
                        value={activeConversation.settings.mode}
                        onChange={(event) => handleModeChange(event.target.value as StudioMode)}
                        className="bg-transparent text-sm font-medium text-[var(--slate-700)] outline-none"
                      >
                        {modeOptions.map((mode) => (
                          <option key={mode} value={mode}>
                            {STUDIO_MODE_LABELS[mode]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="inline-flex min-w-[180px] flex-1 items-center rounded-full bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--slate-600)] sm:max-w-[300px]">
                      <select
                        value={activeConversation.settings.activeModelId}
                        onChange={(event) => handleConversationSetting('activeModelId', event.target.value)}
                        className="min-w-0 w-full bg-transparent text-sm font-medium text-[var(--slate-700)] outline-none"
                      >
                        {selectableModels.map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="inline-flex cursor-pointer items-center rounded-full bg-[var(--surface-muted)] px-3 py-2 text-sm font-medium text-[var(--slate-600)] transition-colors hover:text-[var(--slate-900)]">
                      <input type="file" multiple onChange={handleDocumentUpload} className="hidden" />
                      {activeConversation.documents.length > 0 ? `文件 ${activeConversation.documents.length}` : '文件'}
                    </label>
                  </>
                }
                helperText="Enter 送出，Shift + Enter 換行"
              />

                {activeConversation.settings.mode === 'expert' && (
                  <div className="mx-auto mt-2 max-w-[860px] text-sm text-[var(--slate-600)]">
                    <p className="rounded-xl bg-[var(--surface-muted)] px-3 py-2 text-xs leading-5 text-[var(--slate-500)]">
                      專家模式會同時呼叫下列多個模型各自作答，再由目前模型整合結論；回應較慢、耗用較多額度。
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsExpertModelsExpanded((value) => !value)}
                      className="mt-2 flex w-full items-center justify-between gap-3 rounded-xl px-2 py-2 text-left hover:bg-[var(--background)]"
                    >
                      <span>專家模型：已選 {activeConversation.settings.expertModelIds.length} 個</span>
                      <span className="inline-flex items-center gap-1 text-xs text-[var(--slate-500)]">
                        <ChevronIcon isOpen={isExpertModelsExpanded} />
                      </span>
                    </button>

                    {isExpertModelsExpanded && (
                      <div className="mt-3 flex max-h-[136px] flex-wrap gap-2 overflow-y-auto pr-1">
                        {availableTextModels.map((model) => {
                          const checked = activeConversation.settings.expertModelIds.includes(model.id);

                          return (
                            <button
                              key={model.id}
                              type="button"
                              onClick={() => toggleExpertModel(model.id)}
                              className={`rounded-full px-3 py-2 text-xs font-medium transition-colors ${
                                checked
                                  ? 'bg-[var(--emerald-500)] text-white'
                                  : 'bg-white text-[var(--slate-600)] hover:text-[var(--emerald-700)]'
                              }`}
                            >
                              {model.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
            </div>
          </div>
          </section>
        </div>
    </div>
  );
}
