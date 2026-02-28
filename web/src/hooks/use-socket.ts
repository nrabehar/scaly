import { useEffect, useRef, useState, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import type { PriceTick, OrderbookData, NewsItem } from '@/types/market';

// Always use relative URL so socket.io goes through Vite dev proxy
// (avoids direct cross-origin connection that bypasses proxy)
const SOCKET_URL = 'http://localhost:4000';

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

// Module-level singleton so React StrictMode double-mount doesn't create/destroy connections
let sharedSocket: Socket | null = null;
let socketRefCount = 0;

function getSharedSocket(): Socket {
  // Cancel any pending release from StrictMode unmount
  if (releaseTimer) {
    clearTimeout(releaseTimer);
    releaseTimer = null;
  }
  if (!sharedSocket) {
    sharedSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
  }
  socketRefCount++;
  return sharedSocket;
}

let releaseTimer: ReturnType<typeof setTimeout> | null = null;

function releaseSharedSocket() {
  socketRefCount--;
  if (socketRefCount <= 0) {
    // Delay disconnect to allow StrictMode re-mount to reclaim the socket
    releaseTimer = setTimeout(() => {
      if (socketRefCount <= 0 && sharedSocket) {
        sharedSocket.disconnect();
        sharedSocket = null;
        socketRefCount = 0;
      }
    }, 200);
  }
}

export function useSocket(symbol: string) {
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');

  const subscribe = useCallback(
    (sym: string) => {
      socketRef.current?.emit('subscribe', { symbol: sym });
    },
    [],
  );

  useEffect(() => {
    const socket = getSharedSocket();
    socketRef.current = socket;

    const onConnect = () => {
      setStatus('connected');
      subscribe(symbol);
    };
    const onDisconnect = () => setStatus('disconnected');
    const onReconnectAttempt = () => setStatus('connecting');

    const onPrice = (payload: { symbol: string; data: PriceTick }) => {
      queryClient.setQueryData(['price', payload.symbol], payload.data);
    };
    const onOrderbook = (payload: { symbol: string; data: OrderbookData }) => {
      queryClient.setQueryData(['orderbook', payload.symbol], payload.data);
    };
    const onNews = (payload: { symbol: string; data: NewsItem | NewsItem[] }) => {
      queryClient.setQueryData(['news-ws', payload.symbol], payload.data);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('reconnect_attempt', onReconnectAttempt);
    socket.on('price', onPrice);
    socket.on('orderbook', onOrderbook);
    socket.on('news', onNews);

    // If already connected, fire subscribe immediately
    if (socket.connected) {
      setStatus('connected');
      subscribe(symbol);
    } else {
      setStatus('connecting');
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('reconnect_attempt', onReconnectAttempt);
      socket.off('price', onPrice);
      socket.off('orderbook', onOrderbook);
      socket.off('news', onNews);
      socketRef.current = null;
      releaseSharedSocket();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-subscribe when symbol changes
  useEffect(() => {
    if (status === 'connected') {
      subscribe(symbol);
    }
  }, [symbol, status, subscribe]);

  return { status };
}
