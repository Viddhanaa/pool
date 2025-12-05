'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/auth-store';
import { useRealtimeStore } from '@/stores/realtime-store';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

// Singleton socket instance
let socket: Socket | null = null;

function getSocket(): Socket {
  if (!socket) {
    socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    // Connection event handlers
    socket.on('connect', () => {
      console.log('[Socket] Connected');
      useRealtimeStore.getState().setConnected(true);
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      useRealtimeStore.getState().setConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error.message);
      useRealtimeStore.getState().setConnected(false);
    });
  }
  return socket;
}

// Hook to subscribe to a specific socket event
export function useSocket<T>(event: string, handler: (data: T) => void) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  const { token, isAuthenticated } = useAuthStore();

  useEffect(() => {
    const socket = getSocket();

    // Authenticate and connect
    if (isAuthenticated && token) {
      socket.auth = { token };
      if (!socket.connected) {
        socket.connect();
      }
    }

    // Subscribe to event
    const eventHandler = (data: T) => handlerRef.current(data);
    socket.on(event, eventHandler);

    return () => {
      socket.off(event, eventHandler);
    };
  }, [event, isAuthenticated, token]);
}

// Hook to emit events
export function useSocketEmit() {
  return useCallback(<T>(event: string, data: T) => {
    const socket = getSocket();
    if (socket.connected) {
      socket.emit(event, data);
    } else {
      console.warn('[Socket] Cannot emit, not connected');
    }
  }, []);
}

// Hook to get connection status
export function useSocketConnection() {
  const [isConnected, setIsConnected] = useState(false);
  const { isAuthenticated, token } = useAuthStore();

  useEffect(() => {
    const socket = getSocket();

    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    // Initial connection
    if (isAuthenticated && token && !socket.connected) {
      socket.auth = { token };
      socket.connect();
    }

    // Update initial state
    setIsConnected(socket.connected);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [isAuthenticated, token]);

  const connect = useCallback(() => {
    const socket = getSocket();
    const token = useAuthStore.getState().token;
    if (token) {
      socket.auth = { token };
      socket.connect();
    }
  }, []);

  const disconnect = useCallback(() => {
    const socket = getSocket();
    socket.disconnect();
  }, []);

  return { isConnected, connect, disconnect };
}

// Hook for subscribing to pool stats updates
export function usePoolStats() {
  const poolStats = useRealtimeStore((state) => state.poolStats);
  
  useSocket('pool:stats', (data: typeof poolStats) => {
    useRealtimeStore.getState().setPoolStats(data);
  });

  return poolStats;
}

// Cleanup function for use in app unmount
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
