import { create } from 'zustand';
import type { RealtimePoolStats, RealtimeWorkerUpdate } from '@/types';

interface RealtimeState {
  // Pool stats
  poolStats: RealtimePoolStats;
  
  // Worker updates (keyed by worker ID)
  workerUpdates: Record<string, RealtimeWorkerUpdate>;
  
  // Connection status
  isConnected: boolean;
  lastUpdate: string | null;
  
  // Actions
  setPoolStats: (stats: RealtimePoolStats | null) => void;
  updateWorker: (update: RealtimeWorkerUpdate) => void;
  updateMultipleWorkers: (updates: RealtimeWorkerUpdate[]) => void;
  setConnected: (connected: boolean) => void;
  clearWorkerUpdates: () => void;
}

const initialPoolStats: RealtimePoolStats = {
  hashrate: 0,
  networkHashrate: 0,
  activeMiners: 0,
  difficulty: 0,
};

export const useRealtimeStore = create<RealtimeState>((set) => ({
  poolStats: initialPoolStats,
  workerUpdates: {},
  isConnected: false,
  lastUpdate: null,

  setPoolStats: (stats) =>
    set({
      poolStats: stats ?? initialPoolStats,
      lastUpdate: new Date().toISOString(),
    }),

  updateWorker: (update) =>
    set((state) => ({
      workerUpdates: {
        ...state.workerUpdates,
        [update.id]: update,
      },
      lastUpdate: new Date().toISOString(),
    })),

  updateMultipleWorkers: (updates) =>
    set((state) => {
      const newUpdates = { ...state.workerUpdates };
      updates.forEach((update) => {
        newUpdates[update.id] = update;
      });
      return {
        workerUpdates: newUpdates,
        lastUpdate: new Date().toISOString(),
      };
    }),

  setConnected: (isConnected) =>
    set({ isConnected }),

  clearWorkerUpdates: () =>
    set({ workerUpdates: {} }),
}));

// Selectors
export const selectPoolStats = (state: RealtimeState) => state.poolStats;
export const selectWorkerUpdate = (workerId: string) => (state: RealtimeState) =>
  state.workerUpdates[workerId];
export const selectIsConnected = (state: RealtimeState) => state.isConnected;
