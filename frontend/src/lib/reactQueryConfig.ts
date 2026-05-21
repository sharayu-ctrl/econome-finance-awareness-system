/**
 * EconoMe React Query Configuration (Phase 3b)
 * Centralized cache management with smart invalidation strategies
 * Handles: query keys, cache times, refetch strategies, mutations
 */
import { QueryClient } from "@tanstack/react-query";

/**
 * Standardized query keys for cache organization
 * Format: [domain, resource, filter1, filter2, ...]
 */
export const queryKeys = {
  // Auth queries
  auth: {
    all: () => ["auth"],
    me: () => ["auth", "me"],
    profile: () => ["auth", "profile"],
    sessions: () => ["auth", "sessions"],
    devices: () => ["auth", "devices"],
  },

  // Finance queries
  finance: {
    all: () => ["finance"],
    transactions: {
      all: () => ["finance", "transactions"],
      byDate: (startDate: string, endDate: string) => [
        "finance",
        "transactions",
        { startDate, endDate },
      ],
      byCategory: (category: string) => [
        "finance",
        "transactions",
        { category },
      ],
      detail: (id: string) => ["finance", "transactions", id],
    },
    budgets: {
      all: () => ["finance", "budgets"],
      detail: (id: string) => ["finance", "budgets", id],
      byPeriod: (period: "monthly" | "quarterly" | "yearly") => [
        "finance",
        "budgets",
        { period },
      ],
    },
    goals: {
      all: () => ["finance", "goals"],
      detail: (id: string) => ["finance", "goals", id],
      progress: (id: string) => ["finance", "goals", id, "progress"],
    },
    accounts: {
      all: () => ["finance", "accounts"],
      detail: (id: string) => ["finance", "accounts", id],
      balance: (id: string) => ["finance", "accounts", id, "balance"],
    },
    analytics: {
      all: () => ["finance", "analytics"],
      summary: () => ["finance", "analytics", "summary"],
      trends: (period: string) => [
        "finance",
        "analytics",
        "trends",
        { period },
      ],
      categoryBreakdown: () => ["finance", "analytics", "category-breakdown"],
    },
  },

  // Insights queries
  insights: {
    all: () => ["insights"],
    recommendations: () => ["insights", "recommendations"],
    patterns: () => ["insights", "patterns"],
    alerts: () => ["insights", "alerts"],
    detail: (id: string) => ["insights", id],
  },

  // Chat queries
  chat: {
    all: () => ["chat"],
    conversations: () => ["chat", "conversations"],
    messages: {
      all: () => ["chat", "messages"],
      byRoom: (roomId: string) => ["chat", "messages", roomId],
    },
    history: () => ["chat", "history"],
  },

  // Learning queries
  learning: {
    all: () => ["learning"],
    courses: () => ["learning", "courses"],
    modules: {
      all: () => ["learning", "modules"],
      detail: (id: string) => ["learning", "modules", id],
    },
    progress: () => ["learning", "progress"],
  },

  // Macro queries
  macro: {
    all: () => ["macro"],
    economyData: () => ["macro", "economy-data"],
    indicators: () => ["macro", "indicators"],
    predictions: () => ["macro", "predictions"],
  },
};

/**
 * Cache time configuration (in milliseconds)
 * Shorter for frequently changing data, longer for static data
 */
const CACHE_TIMES = {
  // Instant (no caching, always fresh)
  instant: 0,

  // Short (cache for 30 seconds)
  short: 30 * 1000,

  // Medium (cache for 5 minutes)
  medium: 5 * 60 * 1000,

  // Long (cache for 30 minutes)
  long: 30 * 60 * 1000,

  // Very long (cache for 1 hour)
  veryLong: 60 * 60 * 1000,

  // Infinite (cache indefinitely until manually invalidated)
  infinite: Infinity,
};

/**
 * Create configured QueryClient with smart defaults
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Cache strategy
        staleTime: CACHE_TIMES.medium, // Data is fresh for 5 minutes
        gcTime: CACHE_TIMES.long, // Keep unused data for 30 minutes
        retry: 1, // Retry failed queries once
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

        // Refetch strategy
        refetchOnWindowFocus: false, // Don't refetch on window focus for now
        refetchOnReconnect: "stale", // Refetch when connection restored if stale
        refetchIntervalInBackground: false, // Don't refetch in background tab

        // Misc
        throwOnError: false, // Don't throw errors, handle them in components
      },

      mutations: {
        // Mutation retry strategy
        retry: 1,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      },
    },
  });
}

/**
 * Custom hook for cache invalidation
 * Groups related queries to invalidate together
 */
export function useQueryInvalidation(queryClient: QueryClient) {
  return {
    // Invalidate all auth-related queries
    invalidateAuth: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.all() }),

    // Invalidate all finance queries
    invalidateAllFinance: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.all() }),

    // Invalidate specific finance sub-queries
    invalidateTransactions: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.finance.transactions.all(),
      }),
    invalidateBudgets: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.finance.budgets.all(),
      }),
    invalidateGoals: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.finance.goals.all(),
      }),
    invalidateAccounts: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.finance.accounts.all(),
      }),
    invalidateAnalytics: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.finance.analytics.all(),
      }),

    // Invalidate insights
    invalidateInsights: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.insights.all() }),

    // Invalidate chat
    invalidateChat: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.chat.all() }),

    // Invalidate learning
    invalidateLearning: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.learning.all() }),

    // Invalidate macro data
    invalidateMacro: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.macro.all() }),

    // Invalidate everything
    invalidateAll: () => queryClient.invalidateQueries(),

    // Invalidate specific transaction
    invalidateTransaction: (id: string) =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.finance.transactions.detail(id),
      }),

    // Prefetch transactions for dashboard
    prefetchTransactions: async (queryFn: () => Promise<unknown>) => {
      await queryClient.prefetchQuery({
        queryKey: queryKeys.finance.transactions.all(),
        queryFn: () => queryFn(),
        staleTime: CACHE_TIMES.short,
      });
    },

    // Set optimistic data
    setOptimistic: (key: string[], data: unknown) => {
      queryClient.setQueryData(key, data);
    },

    // Get cached data
    getCached: (key: string[]) => queryClient.getQueryData(key),
  };
}

/**
 * Cache timing configuration for different query types
 * Used to set different stale times based on query type
 */
export const getCacheConfig = (
  queryType:
    | "auth"
    | "transactions"
    | "budgets"
    | "goals"
    | "analytics"
    | "insights"
    | "chat"
    | "learning"
    | "macro",
) => {
  const configs: Record<string, { staleTime: number; gcTime: number }> = {
    auth: { staleTime: CACHE_TIMES.long, gcTime: CACHE_TIMES.veryLong },
    transactions: {
      staleTime: CACHE_TIMES.short,
      gcTime: CACHE_TIMES.medium,
    },
    budgets: { staleTime: CACHE_TIMES.medium, gcTime: CACHE_TIMES.long },
    goals: { staleTime: CACHE_TIMES.medium, gcTime: CACHE_TIMES.long },
    analytics: { staleTime: CACHE_TIMES.medium, gcTime: CACHE_TIMES.long },
    insights: { staleTime: CACHE_TIMES.short, gcTime: CACHE_TIMES.medium },
    chat: { staleTime: CACHE_TIMES.instant, gcTime: CACHE_TIMES.short },
    learning: { staleTime: CACHE_TIMES.long, gcTime: CACHE_TIMES.veryLong },
    macro: { staleTime: CACHE_TIMES.long, gcTime: CACHE_TIMES.veryLong },
  };
  return configs[queryType] || configs.analytics;
};

export const CACHE_TIMES_EXPORT = CACHE_TIMES;
