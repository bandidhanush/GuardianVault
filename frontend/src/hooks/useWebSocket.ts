import { useEffect, useRef, useState, useCallback } from 'react';

export interface WSMessage {
    type: 'accident_detected' | 'system_status' | 'alert_sent' | 'detection_update' | 'pong';
    data?: Record<string, unknown>;
}

export function useWebSocket(url?: string) {
    const [isConnected, setIsConnected] = useState(false);
    const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);
    const [messages, setMessages] = useState<WSMessage[]>([]);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) return;

        const defaultUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;
        const socketUrl = url || defaultUrl;

        try {
            const ws = new WebSocket(socketUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                setIsConnected(true);
                console.log('[WebSocket] Connected');
            };

            ws.onmessage = (event) => {
                try {
                    const msg: WSMessage = JSON.parse(event.data);
                    setLastMessage(msg);
                    setMessages(prev => [msg, ...prev].slice(0, 100)); // keep last 100
                } catch {
                    // ignore parse errors
                }
            };

            ws.onclose = () => {
                setIsConnected(false);
                console.log('[WebSocket] Disconnected, reconnecting in 3s...');
                if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
                reconnectTimer.current = setTimeout(connect, 3000);
            };

            ws.onerror = () => {
                ws.close();
            };
        } catch (e) {
            console.error('[WebSocket] Connection error:', e);
            if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
            reconnectTimer.current = setTimeout(connect, 5000);
        }
    }, [url]);

    useEffect(() => {
        connect();
        return () => {
            if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
            wsRef.current?.close();
        };
    }, [connect]);

    const sendMessage = useCallback((msg: string | object) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(typeof msg === 'string' ? msg : JSON.stringify(msg));
        }
    }, []);

    const ping = useCallback(() => sendMessage('ping'), [sendMessage]);

    return { isConnected, lastMessage, messages, sendMessage, ping };
}
