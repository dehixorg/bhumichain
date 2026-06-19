'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { WsMessage, WsEventHandler } from '@/types';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000/ws';

type HandlerMap = Map<string, WsEventHandler[]>;

export function useWebSocket(dlpiId?: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<HandlerMap>(new Map());
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();

  const connect = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      if (dlpiId) {
        ws.send(JSON.stringify({ type: 'SUBSCRIBE_DLPI', dlpiId }));
      }
    };

    ws.onmessage = (evt) => {
      try {
        const msg: WsMessage = JSON.parse(evt.data);
        // Fire handlers for this specific event
        const specific = handlersRef.current.get(msg.event) || [];
        // Fire wildcard handlers
        const wildcards = handlersRef.current.get('*') || [];
        [...specific, ...wildcards].forEach((h) => h(msg));
      } catch (_) {}
    };

    ws.onclose = () => {
      // Reconnect after 3s
      reconnectTimer.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => ws.close();
  }, [dlpiId]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const on = useCallback((event: string, handler: WsEventHandler) => {
    const existing = handlersRef.current.get(event) || [];
    handlersRef.current.set(event, [...existing, handler]);
    return () => {
      const updated = (handlersRef.current.get(event) || []).filter((h) => h !== handler);
      handlersRef.current.set(event, updated);
    };
  }, []);

  // Trigger a pre-scripted mock event (demo presenter tool)
  const triggerMock = useCallback((key: string) => {
    wsRef.current?.send(JSON.stringify({ type: 'TRIGGER_MOCK_EVENT', key }));
  }, []);

  return { on, triggerMock };
}
