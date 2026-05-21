/**
 * EconoMe React Query Hooks (Phase 3b)
 * Pre-configured hooks for common data fetching patterns
 * Automatically handles caching, invalidation, and error handling
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys, getCacheConfig } from "./reactQueryConfig";
import { secureApiFetch } from "./secureApi";

/**
 * Fetch transactions with automatic caching
 */
export function useTransactions(startDate?: string, endDate?: string) {
  const queryKey =
    startDate && endDate
      ? queryKeys.finance.transactions.byDate(startDate, endDate)
      : queryKeys.finance.transactions.all();

  const config = getCacheConfig("transactions");

  return useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.append("start_date", startDate);
      if (endDate) params.append("end_date", endDate);
      const query = params.toString() ? `?${params.toString()}` : "";

      const response = await secureApiFetch(`/finance/transactions${query}`);
      if (!response.ok) throw new Error("Failed to fetch transactions");
      return response.json();
    },
    ...config,
  });
}

/**
 * Fetch single transaction
 */
export function useTransaction(id: string) {
  const config = getCacheConfig("transactions");

  return useQuery({
    queryKey: queryKeys.finance.transactions.detail(id),
    queryFn: async () => {
      const response = await secureApiFetch(`/finance/transactions/${id}`);
      if (!response.ok) throw new Error("Failed to fetch transaction");
      return response.json();
    },
    ...config,
    enabled: !!id, // Only fetch if id is provided
  });
}

/**
 * Fetch budgets with caching
 */
export function useBudgets() {
  const config = getCacheConfig("budgets");

  return useQuery({
    queryKey: queryKeys.finance.budgets.all(),
    queryFn: async () => {
      const response = await secureApiFetch("/finance/budgets");
      if (!response.ok) throw new Error("Failed to fetch budgets");
      return response.json();
    },
    ...config,
  });
}

/**
 * Fetch goals
 */
export function useGoals() {
  const config = getCacheConfig("goals");

  return useQuery({
    queryKey: queryKeys.finance.goals.all(),
    queryFn: async () => {
      const response = await secureApiFetch("/finance/goals");
      if (!response.ok) throw new Error("Failed to fetch goals");
      return response.json();
    },
    ...config,
  });
}

/**
 * Fetch financial analytics/summary
 */
export function useAnalytics() {
  const config = getCacheConfig("analytics");

  return useQuery({
    queryKey: queryKeys.finance.analytics.summary(),
    queryFn: async () => {
      const response = await secureApiFetch("/finance/analytics/summary");
      if (!response.ok) throw new Error("Failed to fetch analytics");
      return response.json();
    },
    ...config,
  });
}

/**
 * Fetch AI insights/recommendations
 */
export function useInsights() {
  const config = getCacheConfig("insights");

  return useQuery({
    queryKey: queryKeys.insights.recommendations(),
    queryFn: async () => {
      const response = await secureApiFetch("/insights/recommendations");
      if (!response.ok) throw new Error("Failed to fetch insights");
      return response.json();
    },
    ...config,
  });
}

/**
 * Create transaction mutation with automatic cache invalidation
 */
export function useCreateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const response = await secureApiFetch("/finance/transactions", {
        method: "POST",
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create transaction");
      return response.json();
    },
    onSuccess: async (data) => {
      // Invalidate related queries
      await queryClient.invalidateQueries({
        queryKey: queryKeys.finance.transactions.all(),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.finance.analytics.all(),
      });
      return data;
    },
    onError: (error) => {
      console.error("Transaction creation failed:", error);
    },
  });
}

/**
 * Update transaction mutation
 */
export function useUpdateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Record<string, unknown>;
    }) => {
      const response = await secureApiFetch(`/finance/transactions/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update transaction");
      return response.json();
    },
    onSuccess: async (_, variables) => {
      // Invalidate specific transaction and all transactions
      await queryClient.invalidateQueries({
        queryKey: queryKeys.finance.transactions.detail(variables.id),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.finance.transactions.all(),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.finance.analytics.all(),
      });
    },
  });
}

/**
 * Delete transaction mutation
 */
export function useDeleteTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await secureApiFetch(`/finance/transactions/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete transaction");
      return response.json();
    },
    onSuccess: async (_, id) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.finance.transactions.all(),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.finance.analytics.all(),
      });
    },
  });
}

/**
 * Fetch user profile
 */
export function useProfile() {
  const config = getCacheConfig("auth");

  return useQuery({
    queryKey: queryKeys.auth.profile(),
    queryFn: async () => {
      const response = await secureApiFetch("/auth/v2/me");
      if (!response.ok) throw new Error("Failed to fetch profile");
      return response.json();
    },
    ...config,
  });
}

/**
 * Fetch learning progress
 */
export function useLearningProgress() {
  const config = getCacheConfig("learning");

  return useQuery({
    queryKey: queryKeys.learning.progress(),
    queryFn: async () => {
      const response = await secureApiFetch("/learning/progress");
      if (!response.ok) throw new Error("Failed to fetch learning progress");
      return response.json();
    },
    ...config,
  });
}

/**
 * Fetch macro economic data
 */
export function useMacroData() {
  const config = getCacheConfig("macro");

  return useQuery({
    queryKey: queryKeys.macro.economyData(),
    queryFn: async () => {
      const response = await secureApiFetch("/macro/data");
      if (!response.ok) throw new Error("Failed to fetch macro data");
      return response.json();
    },
    ...config,
  });
}

/**
 * Utility hook to get access to query invalidation
 */
export function useQueryInvalidation() {
  const queryClient = useQueryClient();

  return {
    invalidateTransactions: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.finance.transactions.all(),
      }),
    invalidateAnalytics: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.finance.analytics.all(),
      }),
    invalidateInsights: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.insights.recommendations(),
      }),
    invalidateAll: () => queryClient.invalidateQueries(),
  };
}
