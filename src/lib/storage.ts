import { STORAGE_KEYS } from '@/config/models';
import { ArenaSession } from '@/types';

export function saveCurrentSession(session: ArenaSession): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(STORAGE_KEYS.currentSession, JSON.stringify(session));
  } catch (error) {
    console.error('Failed to save session:', error);
  }
}

export function loadCurrentSession(): ArenaSession | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const data = localStorage.getItem(STORAGE_KEYS.currentSession);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Failed to load session:', error);
    return null;
  }
}

export function clearCurrentSession(): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem(STORAGE_KEYS.currentSession);
  } catch (error) {
    console.error('Failed to clear session:', error);
  }
}

export function saveSessionToHistory(session: ArenaSession): void {
  if (typeof window === 'undefined') return;
  
  try {
    const history = loadSessionHistory();
    history.push(session);
    localStorage.setItem(STORAGE_KEYS.sessionHistory, JSON.stringify(history));
  } catch (error) {
    console.error('Failed to save session to history:', error);
  }
}

export function loadSessionHistory(): ArenaSession[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const data = localStorage.getItem(STORAGE_KEYS.sessionHistory);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to load session history:', error);
    return [];
  }
}

