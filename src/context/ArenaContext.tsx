'use client';

import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { AIModel, ArenaSession, MatchRound, ModelResponse, RankingResult } from '@/types';
import { BLIND_NAMES, ARENA_CONFIG } from '@/config/models';
import { saveCurrentSession, loadCurrentSession, clearCurrentSession } from '@/lib/storage';

// State type
interface ArenaState {
  currentPhase: 'landing' | 'selection' | 'arena' | 'analytics';
  selectedModels: AIModel[];
  session: ArenaSession | null;
  currentResponses: ModelResponse[];
  isLoading: boolean;
  error: string | null;
}

// Action types
type ArenaAction =
  | { type: 'SET_PHASE'; payload: ArenaState['currentPhase'] }
  | { type: 'SET_SELECTED_MODELS'; payload: AIModel[] }
  | { type: 'START_SESSION'; payload: AIModel[] }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_RESPONSES'; payload: ModelResponse[] }
  | { type: 'UPDATE_RESPONSE'; payload: { index: number; response: Partial<ModelResponse> } }
  | { type: 'SUBMIT_RANKING'; payload: RankingResult[] }
  | { type: 'REVEAL_MODELS' }
  | { type: 'NEXT_ROUND' }
  | { type: 'END_SESSION' }
  | { type: 'RESET' }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'LOAD_SESSION'; payload: ArenaSession };

// Initial state
const initialState: ArenaState = {
  currentPhase: 'landing',
  selectedModels: [],
  session: null,
  currentResponses: [],
  isLoading: false,
  error: null,
};

// Reducer
function arenaReducer(state: ArenaState, action: ArenaAction): ArenaState {
  switch (action.type) {
    case 'SET_PHASE':
      return { ...state, currentPhase: action.payload };

    case 'SET_SELECTED_MODELS':
      return { ...state, selectedModels: action.payload };

    case 'START_SESSION': {
      const newSession: ArenaSession = {
        id: uuidv4(),
        selectedModels: action.payload,
        rounds: [],
        startTime: Date.now(),
        completed: false,
      };
      return {
        ...state,
        session: newSession,
        selectedModels: action.payload,
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

    case 'SUBMIT_RANKING': {
      if (!state.session) return state;

      const newRound: MatchRound = {
        id: uuidv4(),
        prompt: state.currentResponses[0]?.response ? '' : '', // Will be set separately
        responses: state.currentResponses,
        rankings: action.payload,
        timestamp: Date.now(),
        revealed: false,
      };

      const updatedSession: ArenaSession = {
        ...state.session,
        rounds: [...state.session.rounds, newRound],
      };

      return {
        ...state,
        session: updatedSession,
      };
    }

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
      };

    case 'END_SESSION': {
      if (!state.session) return state;

      const completedSession: ArenaSession = {
        ...state.session,
        endTime: Date.now(),
        completed: true,
      };

      return {
        ...state,
        session: completedSession,
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
        currentPhase: action.payload.completed ? 'analytics' : 'arena',
      };

    default:
      return state;
  }
}

// Context
interface ArenaContextType {
  state: ArenaState;
  dispatch: React.Dispatch<ArenaAction>;
  // Helper functions
  startSession: (models: AIModel[]) => void;
  submitPrompt: (prompt: string) => Promise<void>;
  submitRanking: (rankings: RankingResult[], prompt: string) => void;
  revealModels: () => void;
  nextRound: () => void;
  endSession: () => void;
  resetArena: () => void;
  canStartNewRound: () => boolean;
  getRoundCount: () => number;
}

const ArenaContext = createContext<ArenaContextType | null>(null);

// Provider
interface ArenaProviderProps {
  children: ReactNode;
}

export function ArenaProvider({ children }: ArenaProviderProps) {
  const [state, dispatch] = useReducer(arenaReducer, initialState);

  // Load session from storage on mount
  useEffect(() => {
    const savedSession = loadCurrentSession();
    if (savedSession && !savedSession.completed) {
      dispatch({ type: 'LOAD_SESSION', payload: savedSession });
    }
  }, []);

  // Save session to storage on changes
  useEffect(() => {
    if (state.session) {
      saveCurrentSession(state.session);
    }
  }, [state.session]);

  // Helper functions
  const startSession = (models: AIModel[]) => {
    clearCurrentSession();
    dispatch({ type: 'START_SESSION', payload: models });
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
    // First create the round with the prompt
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

    dispatch({ type: 'LOAD_SESSION', payload: updatedSession });
  };

  const revealModels = () => {
    dispatch({ type: 'REVEAL_MODELS' });
  };

  const nextRound = () => {
    dispatch({ type: 'NEXT_ROUND' });
  };

  const endSession = () => {
    dispatch({ type: 'END_SESSION' });
    clearCurrentSession();
  };

  const resetArena = () => {
    clearCurrentSession();
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
    startSession,
    submitPrompt,
    submitRanking,
    revealModels,
    nextRound,
    endSession,
    resetArena,
    canStartNewRound,
    getRoundCount,
  };

  return <ArenaContext.Provider value={value}>{children}</ArenaContext.Provider>;
}

// Custom hook
export function useArena() {
  const context = useContext(ArenaContext);
  if (!context) {
    throw new Error('useArena must be used within an ArenaProvider');
  }
  return context;
}
