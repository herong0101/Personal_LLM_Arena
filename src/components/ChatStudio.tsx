'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ChangeEvent, KeyboardEvent, useEffect, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  AVAILABLE_MODELS,
  STUDIO_DEFAULT_EXPERT_MODEL_IDS,
  STUDIO_DEFAULT_IMAGE_MODEL_ID,
  STUDIO_DEFAULT_MODEL_ID,
  STUDIO_MODE_LABELS,
} from '@/config/models';
import { callImageModel, callModel } from '@/lib/api';
import {
  clearActiveStudioConversationId,
  loadActiveStudioConversationId,
  loadStudioConversations,
  saveActiveStudioConversationId,
  saveStudioConversations,
} from '@/lib/studio-storage';
import { StudioConversation, StudioDocument, StudioGeneratedImage, StudioMessage, StudioMode } from '@/types';

const DIRECT_CONTEXT_TOKEN_LIMIT = 1000;
const SUMMARY_OUTPUT_TOKEN_LIMIT = 1200;
const CHAT_OUTPUT_TOKEN_LIMIT = 4096;
const IMAGE_OUTPUT_TOKEN_LIMIT = 1200;
const EXPERT_MEMBER_OUTPUT_TOKEN_LIMIT = 4096;
const EXPERT_SYNTHESIS_OUTPUT_TOKEN_LIMIT = 4096;
const MAX_DOCUMENT_CHARS = 12000;
const MAX_DOCUMENT_SIZE_BYTES = 1024 * 1024;
const SUPPORTED_TEXT_EXTENSIONS = ['txt', 'md', 'csv', 'json', 'tsv', 'log'];

function SidebarPanelIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <rect x="3.5" y="4" width="17" height="16" rx="3" />
      <path d="M9 4v16" />
    </svg>
  );
}

function ComposeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="M4 10.5 12 4l8 6.5" />
      <path d="M6.5 9.5V20h11V9.5" />
    </svg>
  );
}

function ArenaIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="M8 5h8v3a4 4 0 0 1-8 0V5Z" />
      <path d="M8 7H5a3 3 0 0 0 3 3" />
      <path d="M16 7h3a3 3 0 0 1-3 3" />
      <path d="M12 12v4" />
      <path d="M9 20h6" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="M12 8.5A3.5 3.5 0 1 0 12 15.5A3.5 3.5 0 1 0 12 8.5Z" />
      <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 0 1-4 0v-.2a1 1 0 0 0-.7-.9 1 1 0 0 0-1 .2l-.2.1a2 2 0 1 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 0 1 0-4h.2a1 1 0 0 0 .9-.7 1 1 0 0 0-.2-1l-.1-.2a2 2 0 1 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4a2 2 0 0 1 4 0v.2a1 1 0 0 0 .7.9 1 1 0 0 0 1-.2l.2-.1a2 2 0 1 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6H20a2 2 0 0 1 0 4h-.2a1 1 0 0 0-.9.7Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="M4 7h16" />
      <path d="M9.5 4h5" />
      <path d="M7 7l1 12h8l1-12" />
      <path d="M10 11v5" />
      <path d="M14 11v5" />
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
  const [isDraftComposing, setIsDraftComposing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = useState(false);
  const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false);
  const [isExpertModelsExpanded, setIsExpertModelsExpanded] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadStudioState = async () => {
      const [storedConversations, storedActiveConversationId] = await Promise.all([
        loadStudioConversations(),
        loadActiveStudioConversationId(),
      ]);

      if (!isMounted) {
        return;
      }

      if (storedConversations.length === 0) {
        const initialConversation = createEmptyConversation();
        setConversations([initialConversation]);
        setActiveConversationId(initialConversation.id);
        setIsHydrated(true);
        return;
      }

      setConversations(storedConversations);
      setActiveConversationId(storedActiveConversationId || storedConversations[0].id);
      setIsHydrated(true);
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
  };

  const deleteConversation = (conversationId: string) => {
    setConversations((current) => {
      const nextConversations = current.filter((conversation) => conversation.id !== conversationId);

      if (nextConversations.length === 0) {
        const replacement = createEmptyConversation();
        setActiveConversationId(replacement.id);
        return [replacement];
      }

      if (activeConversationId === conversationId) {
        setActiveConversationId(nextConversations[0].id);
      }

      return nextConversations;
    });
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

  const removeDocument = (documentId: string) => {
    if (!activeConversation) {
      return;
    }

    updateConversation(activeConversation.id, (conversation) => ({
      ...conversation,
      updatedAt: Date.now(),
      documents: conversation.documents.filter((document) => document.id !== documentId),
    }));
  };

  const clearMemory = () => {
    if (!activeConversation) {
      return;
    }

    updateConversation(activeConversation.id, (conversation) => ({
      ...conversation,
      updatedAt: Date.now(),
      memory: {
        summary: '',
        sourceMessageCount: 0,
      },
    }));
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

  const handleDraftKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const nativeEvent = event.nativeEvent as unknown as {
      isComposing?: boolean;
      keyCode?: number;
    };

    if (isDraftComposing || nativeEvent.isComposing || nativeEvent.keyCode === 229) {
      return;
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  };

  const handleLeftPanelToggle = () => {
    const nextValue = !isLeftPanelCollapsed;
    setIsLeftPanelCollapsed(nextValue);

    if (nextValue) {
      setIsSettingsPanelOpen(false);
    }
  };

  if (!activeConversation) {
    return null;
  }

  const isConversationEmpty = activeConversation.messages.length === 0;

  return (
    <div className="page-shell h-screen overflow-hidden px-3 py-3">
      <div
        className="mx-auto grid h-full max-w-[1720px] gap-3"
        style={{
          gridTemplateColumns: `${isLeftPanelCollapsed ? '5.5rem' : '320px'} minmax(0, 1fr)`,
        }}
      >
        <aside className="flex h-full min-h-0 flex-col rounded-[2rem] border border-[rgba(123,104,77,0.14)] bg-[rgba(255,255,255,0.78)] p-3 shadow-[0_24px_60px_rgba(55,40,20,0.08)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-2 border-b border-[var(--border-soft)] px-2 pb-3">
            {!isLeftPanelCollapsed && (
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--slate-500)]">Chat Studio</div>
                <div className="mt-1 text-lg font-semibold text-[var(--slate-900)]">本機對話</div>
              </div>
            )}
            <button
              type="button"
              onClick={handleLeftPanelToggle}
              className={`soft-button rounded-2xl text-sm font-semibold ${isLeftPanelCollapsed ? 'flex h-12 w-12 items-center justify-center p-0' : 'px-3 py-2'}`}
              title={isLeftPanelCollapsed ? '展開左側欄' : '收起左側欄'}
            >
              {isLeftPanelCollapsed ? <SidebarPanelIcon /> : '收'}
            </button>
          </div>

          {isLeftPanelCollapsed ? (
            <div className="flex flex-1 flex-col items-center justify-between py-4">
              <div className="flex flex-col items-center gap-3">
                <button
                  type="button"
                  onClick={createConversation}
                  className="metal-button flex h-12 w-12 items-center justify-center rounded-2xl text-white"
                  title="新對話"
                >
                  <ComposeIcon />
                </button>
                <Link
                  href="/"
                  className="soft-button flex h-12 w-12 items-center justify-center rounded-2xl"
                  title="平台首頁"
                >
                  <HomeIcon />
                </Link>
                <Link
                  href="/arena"
                  className="soft-button flex h-12 w-12 items-center justify-center rounded-2xl"
                  title="模型競技場"
                >
                  <ArenaIcon />
                </Link>
                <div className="mt-1 h-px w-8 bg-[var(--border-soft)]" />
              </div>

              <div className="flex flex-col items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsSettingsPanelOpen((value) => !value)}
                  className={`soft-button flex h-12 w-12 items-center justify-center rounded-2xl ${isSettingsPanelOpen ? 'text-[var(--emerald-700)]' : 'text-[var(--slate-600)]'}`}
                  title="展開設定"
                >
                  <SettingsIcon />
                </button>
                <button
                  type="button"
                  onClick={() => deleteConversation(activeConversation.id)}
                  className="soft-button flex h-12 w-12 items-center justify-center rounded-2xl text-[var(--rose-500)]"
                  title="刪除此對話與記憶"
                >
                  <TrashIcon />
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-4 space-y-2 border-b border-[var(--border-soft)] pb-4">
                <button
                  type="button"
                  onClick={createConversation}
                  className="metal-button flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold text-white"
                >
                  + 新對話
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <Link href="/" className="soft-button rounded-2xl px-4 py-3 text-center text-sm font-semibold">
                    平台首頁
                  </Link>
                  <Link href="/arena" className="soft-button rounded-2xl px-4 py-3 text-center text-sm font-semibold">
                    模型競技場
                  </Link>
                </div>
              </div>

              <div className="mt-4 flex-1 min-h-0">
                <div className="px-2 text-xs font-medium text-[var(--slate-500)]">最近對話</div>
                <div className="mt-3 h-full space-y-1.5 overflow-y-auto pr-1">
                {conversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => setActiveConversationId(conversation.id)}
                    className={`w-full rounded-[1.15rem] px-3 py-3 text-left transition-all ${
                      activeConversationId === conversation.id
                        ? 'bg-[rgba(24,172,126,0.12)] text-[var(--slate-900)] shadow-[0_12px_26px_rgba(14,109,83,0.08)]'
                        : 'bg-transparent text-[var(--slate-700)] hover:bg-white/65'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-[var(--slate-800)]">{conversation.title}</div>
                        <div className="mt-1 text-xs text-[var(--slate-500)]">
                          {new Date(conversation.updatedAt).toLocaleString('zh-TW', {
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                      <span className="shrink-0 whitespace-nowrap rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-medium text-[var(--slate-500)]">
                        {STUDIO_MODE_LABELS[conversation.settings.mode]}
                      </span>
                    </div>
                    <div className="mt-2 line-clamp-2 text-xs leading-6 text-[var(--slate-500)]">
                      {conversation.messages[conversation.messages.length - 1]?.content || '尚無內容'}
                    </div>
                  </button>
                ))}
                </div>
              </div>

              <div className="mt-3 border-t border-[var(--border-soft)] pt-3">
                <button
                  type="button"
                  onClick={() => setIsSettingsPanelOpen((value) => !value)}
                  className="soft-button w-full rounded-2xl px-4 py-2.5 text-sm font-semibold"
                >
                  {isSettingsPanelOpen ? '收起設定' : '展開設定'}
                </button>

                {isSettingsPanelOpen && (
                  <div className="mt-3 max-h-[42vh] space-y-3 overflow-y-auto pr-1">
                    <div className="rounded-[1.3rem] bg-[#f7f7f4] p-3">
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--slate-500)]">
                        對話設定
                      </div>
                      <div className="mt-3 space-y-2">
                        <label className="flex items-center justify-between rounded-[1rem] bg-white px-3 py-3 text-sm text-[var(--slate-700)]">
                          <span>啟用長期記憶</span>
                          <input
                            type="checkbox"
                            checked={activeConversation.settings.useLongTermMemory}
                            onChange={(event) => handleConversationSetting('useLongTermMemory', event.target.checked)}
                          />
                        </label>
                        <label className="flex items-center justify-between rounded-[1rem] bg-white px-3 py-3 text-sm text-[var(--slate-700)]">
                          <span>送出時帶入文件</span>
                          <input
                            type="checkbox"
                            checked={activeConversation.settings.includeDocuments}
                            onChange={(event) => handleConversationSetting('includeDocuments', event.target.checked)}
                          />
                        </label>
                      </div>
                    </div>

                    {activeConversation.settings.mode === 'expert' && (
                      <div className="rounded-[1.3rem] bg-[#f7f7f4] p-3">
                        <div className="text-sm font-semibold text-[var(--slate-800)]">專家模型</div>
                        <div className="mt-3 flex flex-wrap gap-2">
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
                      </div>
                    )}

                    <div className="rounded-[1.3rem] bg-[rgba(24,172,126,0.08)] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-[var(--slate-800)]">長期記憶摘要</div>
                        <button
                          type="button"
                          onClick={clearMemory}
                          className="text-xs font-semibold text-[var(--emerald-700)]"
                        >
                          清除
                        </button>
                      </div>
                      <p className="mt-3 text-sm leading-7 text-[var(--slate-600)]">
                        {activeConversation.memory.summary || '目前尚未建立摘要。對話變長後，系統會自動整理較舊內容。'}
                      </p>
                    </div>

                    <div className="rounded-[1.3rem] bg-[#f7f7f4] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-[var(--slate-800)]">已附加文件</div>
                        <div className="text-xs text-[var(--slate-500)]">{activeConversation.documents.length} 份</div>
                      </div>
                      <div className="mt-3 space-y-2">
                        {activeConversation.documents.length === 0 ? (
                          <div className="rounded-[1rem] border border-dashed border-[var(--border-soft)] px-3 py-4 text-sm text-[var(--slate-500)]">
                            尚未加入文件
                          </div>
                        ) : (
                          activeConversation.documents.map((document) => (
                            <div key={document.id} className="rounded-[1rem] bg-white px-3 py-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-sm font-semibold text-[var(--slate-800)]">{document.name}</div>
                                  <div className="mt-1 text-xs text-[var(--slate-500)]">
                                    {(document.size / 1024).toFixed(1)} KB
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeDocument(document.id)}
                                  className="text-xs font-semibold text-[var(--rose-500)]"
                                >
                                  移除
                                </button>
                              </div>
                              <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--slate-600)]">{document.content}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => deleteConversation(activeConversation.id)}
                  className="soft-button mt-3 w-full rounded-2xl px-4 py-2.5 text-sm font-semibold text-[var(--rose-500)]"
                >
                  刪除此對話
                </button>
              </div>
            </>
          )}
        </aside>

        <section className="flex h-full min-h-0 flex-col rounded-[2rem] border border-[rgba(255,255,255,0.58)] bg-[rgba(255,255,255,0.48)] shadow-[0_28px_80px_rgba(55,40,20,0.08)] backdrop-blur-xl">
          <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6 pt-8">
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
                        ? 'rounded-[1.65rem] bg-[var(--emerald-500)] text-white shadow-[0_18px_40px_rgba(14,109,83,0.16)]'
                        : 'rounded-[1.75rem] border border-[rgba(123,104,77,0.12)] bg-white/84 text-[var(--slate-700)] shadow-[0_16px_36px_rgba(55,40,20,0.06)]'
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
                  <div className="rounded-[1.65rem] border border-[rgba(123,104,77,0.12)] bg-white/84 px-5 py-4 text-sm text-[var(--slate-500)] shadow-[0_16px_36px_rgba(55,40,20,0.06)]">
                    模型正在整理回應...
                  </div>
                </div>
              )}
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-[var(--border-soft)] px-4 py-4">
            <div className="mx-auto max-w-[920px]">
              {error && (
                <div className="mb-3 rounded-2xl bg-[var(--rose-100)] px-4 py-3 text-sm text-[var(--rose-500)]">
                  {error}
                </div>
              )}

              <div className="field-shell rounded-[2rem] bg-white/92 p-3 shadow-[0_20px_50px_rgba(55,40,20,0.08)]">
                <div className="flex flex-wrap items-center gap-2 border-b border-[rgba(123,104,77,0.1)] px-1 pb-3">
                  {modeOptions.map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => handleModeChange(mode)}
                      className={`rounded-full px-3 py-2 text-sm font-semibold transition-colors ${
                        activeConversation.settings.mode === mode
                          ? 'bg-[var(--slate-800)] text-white'
                          : 'bg-[#f3f4f1] text-[var(--slate-600)] hover:text-[var(--slate-900)]'
                      }`}
                    >
                      {STUDIO_MODE_LABELS[mode]}
                    </button>
                  ))}

                  <label className="field-shell flex min-w-[320px] flex-1 items-center gap-3 rounded-full px-3 py-2 text-sm text-[var(--slate-600)]">
                    <span className="shrink-0 whitespace-nowrap rounded-full bg-[#f3f4f1] px-3 py-1.5 text-[11px] font-semibold tracking-[0.08em] text-[var(--slate-500)]">
                      模型
                    </span>
                    <select
                      value={activeConversation.settings.activeModelId}
                      onChange={(event) => handleConversationSetting('activeModelId', event.target.value)}
                      className="min-w-0 w-full bg-transparent text-[15px] text-[var(--slate-700)] outline-none"
                    >
                      {selectableModels.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.name} · {model.source === 'local' ? '地端' : '雲端'}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="soft-button inline-flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-[var(--slate-700)]">
                    <input
                      type="file"
                      multiple
                      onChange={handleDocumentUpload}
                      className="hidden"
                    />
                    文件
                  </label>

                  <span className="rounded-full bg-[#f3f4f1] px-3 py-2 text-xs text-[var(--slate-500)]">
                    已附加 {activeConversation.documents.length} 份
                  </span>
                </div>

                {activeConversation.settings.mode === 'expert' && (
                  <div className="mt-3 rounded-[1.4rem] bg-[#f7f7f4] p-3">
                    <button
                      type="button"
                      onClick={() => setIsExpertModelsExpanded((value) => !value)}
                      className="flex w-full items-center justify-between gap-3 rounded-[1rem] px-1 py-1 text-left"
                    >
                      <div>
                        <div className="text-sm font-semibold text-[var(--slate-800)]">專家模型</div>
                        <div className="mt-1 text-xs text-[var(--slate-500)]">
                          最多 3 個，已選 {activeConversation.settings.expertModelIds.length} 個
                        </div>
                      </div>
                      <span className="soft-button inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold text-[var(--slate-600)]">
                        {isExpertModelsExpanded ? '收起' : '展開'}
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

                <div className="mt-3 flex items-end gap-3">
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onCompositionStart={() => setIsDraftComposing(true)}
                    onCompositionEnd={() => setIsDraftComposing(false)}
                    onKeyDown={handleDraftKeyDown}
                    placeholder={activeConversation.settings.mode === 'image' ? '描述您想生成的圖片...' : '想問點什麼？'}
                    rows={1}
                    className="min-h-[108px] flex-1 resize-none bg-transparent px-2 py-2 text-base outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => void sendMessage()}
                    disabled={isSending || !draft.trim()}
                    className="metal-button rounded-[1.45rem] px-5 py-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    送出
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--slate-500)]">
                  <div className="flex flex-wrap gap-2">
                    {activeConversation.settings.useLongTermMemory && (
                      <span className="rounded-full bg-[#f3f4f1] px-3 py-1.5">長期記憶開啟</span>
                    )}
                    {activeConversation.settings.includeDocuments && (
                      <span className="rounded-full bg-[#f3f4f1] px-3 py-1.5">文件上下文開啟</span>
                    )}
                    {activeConversation.settings.mode === 'expert' && (
                      <span className="rounded-full bg-[#f3f4f1] px-3 py-1.5">
                        專家模型 {activeConversation.settings.expertModelIds.length} 個
                      </span>
                    )}
                  </div>
                  <span>Enter 送出，Shift + Enter 換行</span>
                </div>
              </div>
            </div>
          </div>
          </section>
        </div>
    </div>
  );
}