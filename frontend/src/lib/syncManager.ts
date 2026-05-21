/**
 * EconoMe Data Synchronization Layer (Phase 3c)
 * Synchronizes data across all open browser tabs/windows
 * Uses: BroadcastChannel API for tab-to-tab communication
 * Fallback: localStorage events for older browsers
 */
import { queryKeys } from "./reactQueryConfig";

export type SyncEventType =
  | "transaction-created"
  | "transaction-updated"
  | "transaction-deleted"
  | "budget-updated"
  | "goal-progress-updated"
  | "insight-received"
  | "profile-updated"
  | "user-logout";

export interface SyncEvent<T = unknown> {
  type: SyncEventType;
  timestamp: number;
  data: T;
  source: "local" | "broadcast";
}

/**
 * Cross-tab data synchronization manager
 */
export class DataSyncManager {
  private channel: BroadcastChannel | null = null;
  private listeners: Map<SyncEventType, ((event: SyncEvent) => void)[]> =
    new Map();
  private readonly channelName = "econome-data-sync";
  private isSupported = typeof BroadcastChannel !== "undefined";

  constructor() {
    if (this.isSupported) {
      try {
        this.channel = new BroadcastChannel(this.channelName);
        this.channel.onmessage = (event) => this.handleMessage(event.data);
        console.log("✅ BroadcastChannel enabled for cross-tab sync");
      } catch (err) {
        console.warn(
          "⚠️  BroadcastChannel not available, using localStorage",
          err,
        );
        this.setupStorageListener();
      }
    } else {
      console.warn("⚠️  BroadcastChannel not supported, using localStorage");
      this.setupStorageListener();
    }
  }

  /**
   * Setup localStorage fallback for older browsers
   */
  private setupStorageListener() {
    window.addEventListener("storage", (event) => {
      if (event.key?.startsWith(this.channelName)) {
        try {
          const data = JSON.parse(event.newValue || "{}");
          this.handleMessage(data);
        } catch (err) {
          console.error("Storage event parse error:", err);
        }
      }
    });
  }

  /**
   * Handle incoming sync events
   */
  private handleMessage(message: SyncEvent) {
    // Don't process messages from current tab to avoid loops
    if (message.source === "local") return;

    const listeners = this.listeners.get(message.type) || [];
    listeners.forEach((callback) => {
      try {
        callback(message);
      } catch (err) {
        console.error(`Error in listener for ${message.type}:`, err);
      }
    });
  }

  /**
   * Broadcast event to all tabs
   */
  broadcast(type: SyncEventType, data: unknown) {
    const event: SyncEvent = {
      type,
      timestamp: Date.now(),
      data,
      source: "local",
    };

    if (this.channel) {
      this.channel.postMessage(event);
    } else {
      // Fallback: store in localStorage
      const key = `${this.channelName}-${type}-${Date.now()}`;
      localStorage.setItem(key, JSON.stringify(event));
      // Clean up old entries
      setTimeout(() => localStorage.removeItem(key), 5000);
    }
  }

  /**
   * Subscribe to sync events
   */
  on(type: SyncEventType, callback: (event: SyncEvent) => void): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(callback);

    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(type) || [];
      const index = listeners.indexOf(callback);
      if (index > -1) listeners.splice(index, 1);
    };
  }

  /**
   * Notify other tabs that a transaction was created
   */
  notifyTransactionCreated(
    transactionId: string,
    data: Record<string, unknown>,
  ) {
    this.broadcast("transaction-created", { transactionId, ...data });
  }

  /**
   * Notify other tabs that a transaction was updated
   */
  notifyTransactionUpdated(
    transactionId: string,
    data: Record<string, unknown>,
  ) {
    this.broadcast("transaction-updated", { transactionId, ...data });
  }

  /**
   * Notify other tabs that a transaction was deleted
   */
  notifyTransactionDeleted(transactionId: string) {
    this.broadcast("transaction-deleted", { transactionId });
  }

  /**
   * Notify other tabs about budget update
   */
  notifyBudgetUpdated(budgetId: string, data: Record<string, unknown>) {
    this.broadcast("budget-updated", { budgetId, ...data });
  }

  /**
   * Notify other tabs about goal progress
   */
  notifyGoalProgressUpdated(
    goalId: string,
    progress: number,
    data: Record<string, unknown>,
  ) {
    this.broadcast("goal-progress-updated", { goalId, progress, ...data });
  }

  /**
   * Notify other tabs about new insight
   */
  notifyInsightReceived(insightId: string, content: string) {
    this.broadcast("insight-received", { insightId, content });
  }

  /**
   * Notify other tabs about profile update
   */
  notifyProfileUpdated(data: Record<string, unknown>) {
    this.broadcast("profile-updated", data);
  }

  /**
   * Notify other tabs about logout
   */
  notifyLogout() {
    this.broadcast("user-logout", { timestamp: Date.now() });
  }

  /**
   * Cleanup
   */
  disconnect() {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
  }
}

// Singleton instance
export const syncManager = new DataSyncManager();

/**
 * React hook for syncing data across tabs
 */
export function useDataSync(
  options: Partial<Record<SyncEventType, (event: SyncEvent) => void>> = {},
) {
  const unsubscribeRef: Array<() => void> = [];

  // Subscribe to events
  Object.entries(options).forEach(([eventType, handler]) => {
    if (handler) {
      const unsub = syncManager.on(eventType as SyncEventType, handler);
      unsubscribeRef.push(unsub);
    }
  });

  // Return cleanup function
  return () => {
    unsubscribeRef.forEach((unsub) => unsub());
  };
}

/**
 * Utility hook to broadcast events
 */
export function useBroadcastSync() {
  return {
    notifyTransactionCreated: (id: string, data: Record<string, unknown>) =>
      syncManager.notifyTransactionCreated(id, data),
    notifyTransactionUpdated: (id: string, data: Record<string, unknown>) =>
      syncManager.notifyTransactionUpdated(id, data),
    notifyTransactionDeleted: (id: string) =>
      syncManager.notifyTransactionDeleted(id),
    notifyBudgetUpdated: (id: string, data: Record<string, unknown>) =>
      syncManager.notifyBudgetUpdated(id, data),
    notifyGoalProgressUpdated: (
      id: string,
      progress: number,
      data: Record<string, unknown>,
    ) => syncManager.notifyGoalProgressUpdated(id, progress, data),
    notifyInsightReceived: (id: string, content: string) =>
      syncManager.notifyInsightReceived(id, content),
    notifyProfileUpdated: (data: Record<string, unknown>) =>
      syncManager.notifyProfileUpdated(data),
    notifyLogout: () => syncManager.notifyLogout(),
  };
}
