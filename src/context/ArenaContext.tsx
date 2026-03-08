'use client';

import React, { createContext, useContext, useReducer, useEffect, useRef, ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  AIModel,
  ArenaMode,
  ArenaSession,
  ExportMetadata,
  MatchRound,
  ModelResponse,
  RankingResult,
  SessionSummary,
  UserFeedback,
} from '@/types';
import { BLIND_NAMES, ARENA_CONFIG } from '@/config/models';
import { clearCurrentSession, saveCurrentSession, saveSessionToHistory } from '@/lib/storage';
import { createSessionSummary } from '@/lib/session-summary';

interface ArenaState {
  currentPhase: 'landing' | 'selection' | 'arena' | 'analytics';
  arenaMode: ArenaMode;
  selectedModels: AIModel[];
  session: ArenaSession | null;
  currentResponses: ModelResponse[];
  isLoading: boolean;
  error: string | null;
}

type ArenaAction =
  | { type: 'SET_PHASE'; payload: ArenaState['currentPhase'] }
  | { type: 'SET_MODE'; payload: ArenaMode }
  | { type: 'SET_SELECTED_MODELS'; payload: AIModel[] }
  | { type: 'START_SESSION'; payload: { models: AIModel[]; mode: ArenaMode } }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_RESPONSES'; payload: ModelResponse[] }
  | { type: 'UPDATE_RESPONSE'; payload: { index: number; response: Partial<ModelResponse> } }
  | { type: 'SET_SESSION'; payload: ArenaSession }
  | { type: 'REVEAL_MODELS' }
  | { type: 'NEXT_ROUND' }
  | { type: 'END_SESSION'; payload: ArenaSession }
  | { type: 'RESET' }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'LOAD_SESSION'; payload: ArenaSession }
  | { type: 'SET_FEEDBACK'; payload: UserFeedback }
  | { type: 'SET_EXPORT_METADATA'; payload: ExportMetadata };

const initialState: ArenaState = {
  currentPhase: 'landing',
  arenaMode: 'blind',
  selectedModels: [],
  session: null,
  currentResponses: [],
  isLoading: false,
  error: null,
};

function arenaReducer(state: ArenaState, action: ArenaAction): ArenaState {
  switch (action.type) {
    case 'SET_PHASE':
      return { ...state, currentPhase: action.payload };

    case 'SET_MODE':
      return { ...state, arenaMode: action.payload };

    case 'SET_SELECTED_MODELS':
      return { ...state, selectedModels: action.payload };

    case 'START_SESSION': {
      const newSession: ArenaSession = {
        id: uuidv4(),
        mode: action.payload.mode,
        selectedModels: action.payload.models,
        rounds: [],
        startTime: Date.now(),
        completed: false,
      };

      return {
        ...state,
        session: newSession,
        selectedModels: action.payload.models,
        arenaMode: action.payload.mode,
        currentPhase: 'arena',
        currentResponses: [],
      };
    }

    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'SET_RESPONSES':
      return { ...state, currentResponses: action.payload };

    case 'UPDATE_RESPONSE': {
      const newResponses = [...state.currentResponses];
      newResponses[action.payload.index] = {
        ...newResponses[action.payload.index],
        ...action.payload.response,
      };
      return { ...state, currentResponses: newResponses };
    }

    case 'SET_SESSION':
      return {
        ...state,
        session: action.payload,
        selectedModels: action.payload.selectedModels,
        arenaMode: action.payload.mode,
      };

    case 'REVEAL_MODELS': {
      if (!state.session || state.session.rounds.length === 0) return state;

      const rounds = [...state.session.rounds];
      const lastRoundIndex = rounds.length - 1;
      rounds[lastRoundIndex] = {
        ...rounds[lastRoundIndex],
        revealed: true,
      };

      return {
        ...state,
        session: { ...state.session, rounds },
      };
    }

    case 'NEXT_ROUND':
      return {
        ...state,
        currentResponses: [],
        isLoading: false,
        error: null,
      };

    case 'END_SESSION': {
      return {
        ...state,
        session: action.payload,
        currentPhase: 'analytics',
      };
    }

    case 'RESET':
      return { ...initialState };

    case 'SET_ERROR':
      return { ...state, error: action.payload };

    case 'LOAD_SESSION':
      return {
        ...state,
        session: action.payload,
        selectedModels: action.payload.selectedModels,
        arenaMode: action.payload.mode,
        currentPhase: action.payload.completed ? 'analytics' : 'arena',
      };

    case 'SET_FEEDBACK':
      if (!state.session) return state;

      return {
        ...state,
        session: {
          ...state.session,
          feedback: action.payload,
        },
      };

    case 'SET_EXPORT_METADATA':
      if (!state.session) return state;

      return {
        ...state,
        session: {
          ...state.session,
          lastExport: action.payload,
        },
      };

    default:
      return state;
  }
}

interface ArenaContextType {
  state: ArenaState;
  dispatch: React.Dispatch<ArenaAction>;
  selectMode: (mode: ArenaMode) => void;
  startSession: (models: AIModel[]) => void;
  submitPrompt: (prompt: string) => Promise<void>;
  submitRanking: (rankings: RankingResult[], prompt: string) => void;
  revealModels: () => void;
  nextRound: () => void;
  endSession: () => void;
  saveFeedback: (feedback: UserFeedback) => void;
  exportSessionData: (feedback?: UserFeedback) => Promise<{ fileName: string; filePath: string; exportedAt: number; payload: SessionSummary }>;
  resetArena: () => void;
  canStartNewRound: () => boolean;
  getRoundCount: () => number;
}

const ArenaContext = createContext<ArenaContextType | null>(null);

interface ArenaProviderProps {
  children: ReactNode;
}

export function ArenaProvider({ children }: ArenaProviderProps) {
  const [state, dispatch] = useReducer(arenaReducer, initialState);
  const savedCompletedSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (state.session) {
      saveCurrentSession(state.session);
    }
  }, [state.session]);

  useEffect(() => {
    if (!state.session?.completed) {
      return;
    }

    if (savedCompletedSessionIdRef.current === state.session.id) {
      return;
    }

    saveSessionToHistory(state.session);
    savedCompletedSessionIdRef.current = state.session.id;
  }, [state.session]);

  const selectMode = (mode: ArenaMode) => {
    dispatch({ type: 'SET_MODE', payload: mode });
    dispatch({ type: 'SET_PHASE', payload: 'selection' });
  };

  const startSession = (models: AIModel[]) => {
    clearCurrentSession();
    savedCompletedSessionIdRef.current = null;
    dispatch({ type: 'START_SESSION', payload: { models, mode: state.arenaMode } });
  };

  const submitPrompt = async (prompt: string) => {
    const { callModel } = await import('@/lib/api');
    
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    // Shuffle models to randomize blind assignment
    const shuffledModels = [...state.selectedModels].sort(() => Math.random() - 0.5);

    // Initialize responses with loading state
    const initialResponses: ModelResponse[] = shuffledModels.map((model, index) => ({
      modelId: model.id,
      blindName: BLIND_NAMES[index],
      response: '',
      timestamp: Date.now(),
      isLoading: true,
    }));

    dispatch({ type: 'SET_RESPONSES', payload: initialResponses });

    // Call each model and update as responses come in
    const promises = shuffledModels.map(async (model, index) => {
      try {
        const response = await callModel(model.id, prompt);
        dispatch({
          type: 'UPDATE_RESPONSE',
          payload: {
            index,
            response: {
              response,
              isLoading: false,
              timestamp: Date.now(),
            },
          },
        });
      } catch (error) {
        dispatch({
          type: 'UPDATE_RESPONSE',
          payload: {
            index,
            response: {
              response: `錯誤：無法獲取回應 - ${error}`,
              isLoading: false,
            },
          },
        });
      }
    });

    await Promise.all(promises);
    dispatch({ type: 'SET_LOADING', payload: false });
  };

  const submitRanking = (rankings: RankingResult[], prompt: string) => {
    if (!state.session) return;

    const newRound: MatchRound = {
      id: uuidv4(),
      prompt,
      responses: state.currentResponses,
      rankings,
      timestamp: Date.now(),
      revealed: false,
    };

    const updatedSession: ArenaSession = {
      ...state.session,
      rounds: [...state.session.rounds, newRound],
    };

    dispatch({ type: 'SET_SESSION', payload: updatedSession });
  };

  const revealModels = () => {
    dispatch({ type: 'REVEAL_MODELS' });
  };

  const nextRound = () => {
    dispatch({ type: 'NEXT_ROUND' });
  };

  const endSession = () => {
    if (!state.session) return;

    const completedSession: ArenaSession = {
      ...state.session,
      endTime: Date.now(),
      completed: true,
    };

    dispatch({ type: 'END_SESSION', payload: completedSession });
    clearCurrentSession();
  };

  const saveFeedback = (feedback: UserFeedback) => {
    dispatch({ type: 'SET_FEEDBACK', payload: feedback });
  };

  const exportSessionData = async (feedback?: UserFeedback) => {
    if (!state.session) {
      throw new Error('No active session to export');
    }

    const sessionToExport = feedback
      ? {
          ...state.session,
          feedback,
        }
      : state.session;

    if (feedback) {
      dispatch({ type: 'SET_FEEDBACK', payload: feedback });
    }

    const payload = createSessionSummary(sessionToExport);
    const response = await fetch('/api/export', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to export session data');
    }

    const exportMetadata: ExportMetadata = {
      exportedAt: data.exportedAt,
      filePath: data.filePath,
      fileName: data.fileName,
    };

    dispatch({ type: 'SET_EXPORT_METADATA', payload: exportMetadata });

    return {
      fileName: data.fileName,
      filePath: data.filePath,
      exportedAt: data.exportedAt,
      payload: data.payload as SessionSummary,
    };
  };

  const resetArena = () => {
    clearCurrentSession();
    savedCompletedSessionIdRef.current = null;
    dispatch({ type: 'RESET' });
  };

  const canStartNewRound = () => {
    if (!state.session) return true;
    return state.session.rounds.length < ARENA_CONFIG.maxRoundsPerSession;
  };

  const getRoundCount = () => {
    return state.session?.rounds.length || 0;
  };

  const value: ArenaContextType = {
    state,
    dispatch,
    selectMode,
    startSession,
    submitPrompt,
    submitRanking,
    revealModels,
    nextRound,
    endSession,
    saveFeedback,
    exportSessionData,
    resetArena,
    canStartNewRound,
    getRoundCount,
  };

  return <ArenaContext.Provider value={value}>{children}</ArenaContext.Provider>;
}

export function useArena() {
  const context = useContext(ArenaContext);
  if (!context) {
    throw new Error('useArena must be used within an ArenaProvider');
  }
  return context;
}
