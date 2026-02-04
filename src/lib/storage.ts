import { STORAGE_KEYS } from '@/config/models';
import { ArenaSession, AnonymousRankingData } from '@/types';

/**
 * Storage utilities for persisting data
 * Uses localStorage for now, designed for easy migration to remote DB
 */

/**
 * Save the current session to localStorage
 */
export function saveCurrentSession(session: ArenaSession): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(STORAGE_KEYS.currentSession, JSON.stringify(session));
  } catch (error) {
    console.error('Failed to save session:', error);
  }
}

/**
 * Load the current session from localStorage
 */
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

/**
 * Clear the current session
 */
export function clearCurrentSession(): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem(STORAGE_KEYS.currentSession);
  } catch (error) {
    console.error('Failed to clear session:', error);
  }
}

/**
 * Save session to history
 */
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

/**
 * Load session history
 */
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

/**
 * Hook for future database integration
 * This function is a placeholder for saving anonymized ranking data
 * to a global database (e.g., Supabase, Firebase)
 */
export async function saveToGlobalDB(data: AnonymousRankingData): Promise<boolean> {
  // TODO: Implement actual database integration
  // Example implementation for Supabase:
  /*
  import { createClient } from '@supabase/supabase-js';
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  
  const { error } = await supabase
    .from('anonymous_rankings')
    .insert({
      model_ids: data.modelIds,
      ranks: data.ranks,
      timestamp: data.timestamp,
    });
  
  if (error) {
    console.error('Failed to save to database:', error);
    return false;
  }
  
  return true;
  */
  
  // Example implementation for Firebase:
  /*
  import { getFirestore, collection, addDoc } from 'firebase/firestore';
  
  const db = getFirestore();
  
  try {
    await addDoc(collection(db, 'anonymous_rankings'), {
      modelIds: data.modelIds,
      ranks: data.ranks,
      timestamp: data.timestamp,
    });
    return true;
  } catch (error) {
    console.error('Failed to save to Firebase:', error);
    return false;
  }
  */
  
  // For now, just log the data (mock implementation)
  console.log('Saving to global DB (mock):', data);
  return Promise.resolve(true);
}

/**
 * Convert session rankings to anonymous data format
 */
export function sessionToAnonymousData(session: ArenaSession): AnonymousRankingData[] {
  return session.rounds.map((round) => ({
    modelIds: round.rankings.map((r) => r.modelId),
    ranks: round.rankings.map((r) => r.rank),
    timestamp: round.timestamp,
  }));
}
