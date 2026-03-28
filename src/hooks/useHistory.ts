import { useReducer, useCallback } from 'react';
import type React from 'react';
import type { BoxElement } from '../types';

const MAX_HISTORY = 50;

type HistoryState = {
  past: BoxElement[][];
  present: BoxElement[];
  future: BoxElement[][];
};

type Updater = BoxElement[] | ((p: BoxElement[]) => BoxElement[]);

type HistoryAction =
  | { type: 'COMMIT'; updater: Updater }
  | { type: 'SET_RAW'; updater: Updater }
  | { type: 'SNAPSHOT' }
  | { type: 'UNDO' }
  | { type: 'REDO' };

function resolve(updater: Updater, present: BoxElement[]): BoxElement[] {
  return typeof updater === 'function' ? updater(present) : updater;
}

function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
  switch (action.type) {
    case 'COMMIT': {
      const next = resolve(action.updater, state.present);
      return {
        past: [...state.past.slice(-(MAX_HISTORY - 1)), state.present],
        present: next,
        future: [],
      };
    }
    case 'SET_RAW': {
      return { ...state, present: resolve(action.updater, state.present) };
    }
    case 'SNAPSHOT': {
      return {
        ...state,
        past: [...state.past.slice(-(MAX_HISTORY - 1)), state.present],
        future: [],
      };
    }
    case 'UNDO': {
      if (!state.past.length) return state;
      const prev = state.past[state.past.length - 1];
      return {
        past: state.past.slice(0, -1),
        present: prev,
        future: [state.present, ...state.future.slice(0, MAX_HISTORY - 1)],
      };
    }
    case 'REDO': {
      if (!state.future.length) return state;
      const next = state.future[0];
      return {
        past: [...state.past.slice(-(MAX_HISTORY - 1)), state.present],
        present: next,
        future: state.future.slice(1),
      };
    }
    default:
      return state;
  }
}

export function useHistory() {
  const [state, dispatch] = useReducer(historyReducer, { past: [], present: [], future: [] });

  const setElements = useCallback<React.Dispatch<React.SetStateAction<BoxElement[]>>>(
    (updater) => dispatch({ type: 'COMMIT', updater }),
    []
  );

  const setElementsRaw = useCallback<React.Dispatch<React.SetStateAction<BoxElement[]>>>(
    (updater) => dispatch({ type: 'SET_RAW', updater }),
    []
  );

  const snapshotHistory = useCallback(() => dispatch({ type: 'SNAPSHOT' }), []);
  const undo = useCallback(() => dispatch({ type: 'UNDO' }), []);
  const redo = useCallback(() => dispatch({ type: 'REDO' }), []);

  return {
    elements: state.present,
    setElements,
    setElementsRaw,
    snapshotHistory,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  };
}
