import { create } from 'zustand';
import { AskUserAnswer, AskUserQuestion } from '../types';

interface PendingAsk {
  conversationId: string;
  provider: string;
  questions: AskUserQuestion[];
}

interface AskState {
  pending: Record<string, PendingAsk>;
  submitted: Record<string, AskUserAnswer[]>;
  registerAsk: (requestId: string, data: PendingAsk) => void;
  forgetAsk: (requestId: string) => void;
  markSubmitted: (requestId: string, answers: AskUserAnswer[]) => void;
}

export const useAskStore = create<AskState>((set) => ({
  pending: {},
  submitted: {},

  registerAsk: (requestId, data) =>
    set((state) => ({ pending: { ...state.pending, [requestId]: data } })),

  forgetAsk: (requestId) =>
    set((state) => {
      if (!state.pending[requestId]) return state;
      const pending = { ...state.pending };
      delete pending[requestId];
      return { pending };
    }),

  markSubmitted: (requestId, answers) =>
    set((state) => {
      const pending = { ...state.pending };
      delete pending[requestId];
      return { pending, submitted: { ...state.submitted, [requestId]: answers } };
    })
}));
