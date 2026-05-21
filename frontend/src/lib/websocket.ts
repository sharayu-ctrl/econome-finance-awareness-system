/**
 * EconoMe WebSocket Manager (Phase 3a)
 * Manages Socket.io connection for real-time updates
 * Handles: finance updates, AI insights, chat messages, dashboard refresh
 */
import io, { Socket } from "socket.io-client";

interface FinanceUpdate {
  type: "transaction" | "budget" | "goal";
  userId: string;
  data: Record<string, unknown>;
  timestamp: number;
}

interface InsightUpdate {
  type: "insight" | "recommendation";
  userId: string;
  content: string;
  timestamp: number;
}

interface ChatMessage {
  roomId: string;
  userId: string;
  message: string;
  timestamp: number;
}

export type WebSocketEvent =
  | { type: "finance-update"; data: FinanceUpdate }
  | { type: "insight-update"; data: InsightUpdate }
  | { type: "chat-message"; data: ChatMessage }
  | { type: "dashboard-refresh"; data: Record<string, unknown> }
  | { type: "connection"; data: { connected: boolean } };

export class WebSocketManager {
  private socket: Socket | null = null;
  private listeners: Map<string, ((data: unknown) => void)[]> = new Map();
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private readonly reconnectDelay = 3000;
  private userId: string | null = null;

  connect(userId: string, token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve();
        return;
      }

      this.userId = userId;
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";

      this.socket = io(apiUrl, {
        auth: { token },
        reconnection: true,
        reconnectionDelay: this.reconnectDelay,
        reconnectionDelayMax: this.reconnectDelay * 10,
        reconnectionAttempts: this.maxReconnectAttempts,
        transports: ["websocket"],
      });

      this.setupEventHandlers();

      this.socket.on("connect", () => {
        console.log("✅ WebSocket connected");
        this.reconnectAttempts = 0;
        this.emitListeners("connection", { connected: true });
        resolve();
      });

      this.socket.on("connect_error", (error) => {
        console.error("❌ WebSocket connection error:", error);
        reject(error);
      });

      this.socket.on("disconnect", () => {
        console.log("🔌 WebSocket disconnected");
        this.emitListeners("connection", { connected: false });
      });
    });
  }

  private setupEventHandlers() {
    if (!this.socket) return;

    // Finance updates: transaction, budget, or goal changes
    this.socket.on("finance-update", (data: FinanceUpdate) => {
      console.log("📊 Finance update:", data);
      this.emitListeners("finance-update", data);
    });

    // AI insights and recommendations
    this.socket.on("insight-update", (data: InsightUpdate) => {
      console.log("💡 Insight update:", data);
      this.emitListeners("insight-update", data);
    });

    // Chat messages from AI tutor or other users
    this.socket.on("chat-message", (data: ChatMessage) => {
      console.log("💬 Chat message:", data);
      this.emitListeners("chat-message", data);
    });

    // Dashboard refresh signal (when data changes elsewhere)
    this.socket.on("dashboard-refresh", (data: Record<string, unknown>) => {
      console.log("🔄 Dashboard refresh requested");
      this.emitListeners("dashboard-refresh", data);
    });

    // Handle errors
    this.socket.on("error", (error) => {
      console.error("🔴 WebSocket error:", error);
      this.emitListeners("error", { message: error });
    });
  }

  private emitListeners(event: string, data: unknown) {
    const listeners = this.listeners.get(event) || [];
    listeners.forEach((cb) => {
      try {
        cb(data);
      } catch (err) {
        console.error(`Error in listener for ${event}:`, err);
      }
    });
  }

  /**
   * Subscribe to WebSocket events
   */
  on(event: string, callback: (data: unknown) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);

    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(event) || [];
      const index = listeners.indexOf(callback);
      if (index > -1) listeners.splice(index, 1);
    };
  }

  /**
   * Emit events to server
   */
  emit(event: string, data: unknown) {
    if (!this.socket?.connected) {
      console.warn("⚠️  WebSocket not connected, queuing event:", event);
      return;
    }
    this.socket.emit(event, data);
  }

  /**
   * Send finance update (e.g., after transaction creation)
   */
  sendFinanceUpdate(update: FinanceUpdate) {
    this.emit("finance-update", update);
  }

  /**
   * Send chat message
   */
  sendChatMessage(roomId: string, message: string) {
    this.emit("chat-message", {
      roomId,
      userId: this.userId,
      message,
      timestamp: Date.now(),
    });
  }

  /**
   * Request dashboard refresh for specific user
   */
  requestDashboardRefresh(targetUserId?: string) {
    this.emit("request-dashboard-refresh", {
      targetUserId: targetUserId || this.userId,
      timestamp: Date.now(),
    });
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  /**
   * Disconnect gracefully
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.userId = null;
      this.emitListeners("connection", { connected: false });
    }
  }

  /**
   * Force reconnection
   */
  reconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket.connect();
    }
  }
}

// Singleton instance
export const wsManager = new WebSocketManager();

// React hook for WebSocket connection
export function useWebSocket(userId?: string, token?: string) {
  return {
    connect: async () => {
      if (userId && token) {
        return wsManager.connect(userId, token);
      }
    },
    disconnect: () => wsManager.disconnect(),
    on: (event: string, cb: (data: unknown) => void) => wsManager.on(event, cb),
    emit: (event: string, data: unknown) => wsManager.emit(event, data),
    isConnected: () => wsManager.isConnected(),
    sendFinanceUpdate: (update: FinanceUpdate) =>
      wsManager.sendFinanceUpdate(update),
    sendChatMessage: (roomId: string, msg: string) =>
      wsManager.sendChatMessage(roomId, msg),
    requestDashboardRefresh: (targetUserId?: string) =>
      wsManager.requestDashboardRefresh(targetUserId),
  };
}
