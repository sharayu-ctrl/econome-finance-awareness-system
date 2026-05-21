/**
 * EconoMe WebSocket React Hook (Phase 3a - Frontend Integration)
 * Auto-manages WebSocket connection lifecycle
 * Handles: connection, reconnection, event listeners, cleanup
 */
import { useEffect, useRef } from "react";
import { useAuthStore } from "../store";
import { wsManager } from "../lib/websocket";
import type { FinanceUpdate } from "../lib/websocket";

interface UseWebSocketOptions {
  onFinanceUpdate?: (data: FinanceUpdate) => void;
  onInsightUpdate?: (data: Record<string, unknown>) => void;
  onChatMessage?: (data: Record<string, unknown>) => void;
  onDashboardRefresh?: (data: Record<string, unknown>) => void;
}

/**
 * React hook for WebSocket integration
 * Auto-connects on mount if authenticated, auto-disconnects on logout
 */
export function useWebSocketConnection(options: UseWebSocketOptions = {}) {
  const {
    onFinanceUpdate,
    onInsightUpdate,
    onChatMessage,
    onDashboardRefresh,
  } = options;

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const unsubscribeRef = useRef<Array<() => void>>([]);

  // Connect WebSocket when authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      wsManager.disconnect();
      return;
    }

    // Connect to WebSocket
    const token = document.cookie
      .split("; ")
      .find((row) => row.startsWith("access_token="))
      ?.split("=")[1];

    if (!token) {
      console.warn("⚠️  No access token available for WebSocket");
      return;
    }

    // Get user ID from session or API
    const connectWebSocket = async () => {
      try {
        // This will fail gracefully if already connected
        await wsManager.connect("user-id", token);
      } catch (err) {
        console.error("Failed to connect WebSocket:", err);
      }
    };

    connectWebSocket();

    // Setup event listeners
    if (onFinanceUpdate) {
      const unsub = wsManager.on("finance-update", (data) => {
        onFinanceUpdate(data as FinanceUpdate);
      });
      unsubscribeRef.current.push(unsub);
    }

    if (onInsightUpdate) {
      const unsub = wsManager.on("insight-update", (data) => {
        onInsightUpdate(data as Record<string, unknown>);
      });
      unsubscribeRef.current.push(unsub);
    }

    if (onChatMessage) {
      const unsub = wsManager.on("chat-message", (data) => {
        onChatMessage(data as Record<string, unknown>);
      });
      unsubscribeRef.current.push(unsub);
    }

    if (onDashboardRefresh) {
      const unsub = wsManager.on("dashboard-refresh", (data) => {
        onDashboardRefresh(data as Record<string, unknown>);
      });
      unsubscribeRef.current.push(unsub);
    }

    // Cleanup on logout
    return () => {
      unsubscribeRef.current.forEach((unsub) => unsub());
      unsubscribeRef.current = [];
      wsManager.disconnect();
    };
  }, [
    isAuthenticated,
    onFinanceUpdate,
    onInsightUpdate,
    onChatMessage,
    onDashboardRefresh,
  ]);

  // Return utilities
  return {
    isConnected: () => wsManager.isConnected(),
    emit: (event: string, data: unknown) => wsManager.emit(event, data),
    sendFinanceUpdate: (update: FinanceUpdate) =>
      wsManager.sendFinanceUpdate(update),
    sendChatMessage: (roomId: string, message: string) =>
      wsManager.sendChatMessage(roomId, message),
    requestDashboardRefresh: (targetUserId?: string) =>
      wsManager.requestDashboardRefresh(targetUserId),
  };
}
