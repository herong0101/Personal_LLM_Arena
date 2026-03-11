import { STORAGE_KEYS } from '@/config/models';
import { StudioConversation } from '@/types';

const STUDIO_DB_NAME = 'arena-of-intelligence-studio';
const STUDIO_DB_VERSION = 1;
const STUDIO_STORE_NAME = 'studio-keyval';

type StudioStoreKey =
  | typeof STORAGE_KEYS.studioConversations
  | typeof STORAGE_KEYS.studioActiveConversation;

interface StudioStoreRecord<T> {
  key: StudioStoreKey;
  value: T;
}

function isIndexedDbAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

function openStudioDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDbAvailable()) {
      reject(new Error('IndexedDB is not available in this browser'));
      return;
    }

    const request = window.indexedDB.open(STUDIO_DB_NAME, STUDIO_DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(STUDIO_STORE_NAME)) {
        database.createObjectStore(STUDIO_STORE_NAME, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
  });
}

async function withStudioStore<T>(
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => Promise<T>
): Promise<T> {
  const database = await openStudioDatabase();

  try {
    const transaction = database.transaction(STUDIO_STORE_NAME, mode);
    const store = transaction.objectStore(STUDIO_STORE_NAME);
    const result = await callback(store);

    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed'));
      transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted'));
    });

    return result;
  } finally {
    database.close();
  }
}

async function getStoredValue<T>(key: StudioStoreKey): Promise<T | null> {
  try {
    return await withStudioStore('readonly', async (store) => {
      const record = await requestToPromise(
        store.get(key) as IDBRequest<StudioStoreRecord<T> | undefined>
      );
      return record?.value ?? null;
    });
  } catch (error) {
    console.error(`Failed to read ${key} from IndexedDB:`, error);
    return null;
  }
}

async function setStoredValue<T>(key: StudioStoreKey, value: T): Promise<void> {
  try {
    await withStudioStore('readwrite', async (store) => {
      await requestToPromise(store.put({ key, value }));
    });
  } catch (error) {
    console.error(`Failed to write ${key} to IndexedDB:`, error);
  }
}

async function deleteStoredValue(key: StudioStoreKey): Promise<void> {
  try {
    await withStudioStore('readwrite', async (store) => {
      await requestToPromise(store.delete(key));
    });
  } catch (error) {
    console.error(`Failed to delete ${key} from IndexedDB:`, error);
  }
}

async function migrateStudioStorageFromLocalStorage(): Promise<void> {
  if (typeof window === 'undefined') return;

  const existingConversations = await getStoredValue<StudioConversation[]>(STORAGE_KEYS.studioConversations);
  const existingActiveConversationId = await getStoredValue<string>(STORAGE_KEYS.studioActiveConversation);

  if (existingConversations || existingActiveConversationId) {
    return;
  }

  try {
    const legacyConversations = localStorage.getItem(STORAGE_KEYS.studioConversations);
    const legacyActiveConversationId = localStorage.getItem(STORAGE_KEYS.studioActiveConversation);

    if (legacyConversations) {
      await setStoredValue(
        STORAGE_KEYS.studioConversations,
        JSON.parse(legacyConversations) as StudioConversation[]
      );
    }

    if (legacyActiveConversationId) {
      await setStoredValue(STORAGE_KEYS.studioActiveConversation, legacyActiveConversationId);
    }

    if (legacyConversations || legacyActiveConversationId) {
      localStorage.removeItem(STORAGE_KEYS.studioConversations);
      localStorage.removeItem(STORAGE_KEYS.studioActiveConversation);
    }
  } catch (error) {
    console.error('Failed to migrate Studio storage from localStorage:', error);
  }
}

export async function loadStudioConversations(): Promise<StudioConversation[]> {
  if (typeof window === 'undefined') return [];

  await migrateStudioStorageFromLocalStorage();
  return (await getStoredValue<StudioConversation[]>(STORAGE_KEYS.studioConversations)) ?? [];
}

export async function saveStudioConversations(conversations: StudioConversation[]): Promise<void> {
  if (typeof window === 'undefined') return;

  await setStoredValue(STORAGE_KEYS.studioConversations, conversations);
}

export async function loadActiveStudioConversationId(): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  await migrateStudioStorageFromLocalStorage();
  return await getStoredValue<string>(STORAGE_KEYS.studioActiveConversation);
}

export async function saveActiveStudioConversationId(conversationId: string): Promise<void> {
  if (typeof window === 'undefined') return;

  await setStoredValue(STORAGE_KEYS.studioActiveConversation, conversationId);
}

export async function clearActiveStudioConversationId(): Promise<void> {
  if (typeof window === 'undefined') return;

  await deleteStoredValue(STORAGE_KEYS.studioActiveConversation);
}