/**
 * EconoMe — Enhanced API Client v2 (Phase 1 Upgrade)
 * Cookie-based authentication with OTP support
 * Replaces localStorage token usage with HTTP-only cookies
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

// ── Auth helpers ──────────────────────────────────────────────────────────────

/**
 * Enhanced fetch that:
 * 1. Sends credentials (cookies) automatically
 * 2. Extracts and sends CSRF token for state-changing requests
 * 3. Handles token refresh automatically
 */
async function secureApiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  // Get CSRF token from cookie
  const csrfToken = getCsrfToken();

  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");

  // Add CSRF token for state-changing requests
  if (["POST", "PUT", "DELETE", "PATCH"].includes(options.method || "GET")) {
    if (csrfToken) {
      headers.set("X-CSRF-Token", csrfToken);
    }
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include", // Include cookies automatically
    headers,
  });

  // Handle 401 - try to refresh token
  if (res.status === 401) {
    await refreshAccessToken();
    // Retry once
    return secureApiFetch<T>(path, options);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }

  return res.json();
}

/**
 * Get CSRF token from cookie
 */
function getCsrfToken(): string | null {
  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split("=");
    if (name === "csrf_token") {
      return decodeURIComponent(value);
    }
  }
  return null;
}

/**
 * Request new CSRF token and set cookie
 */
async function requestCsrfToken(): Promise<string> {
  const res = await fetch(`${API_BASE}/auth/v2/csrf-token`, {
    credentials: "include",
  });
  const data = await res.json();
  return data.csrf_token;
}

/**
 * Refresh access token using refresh token cookie
 */
async function refreshAccessToken(): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/auth/v2/refresh-token`, {
      method: "POST",
      credentials: "include", // Will send refresh_token cookie
    });

    if (!res.ok) {
      // Refresh failed, redirect to login
      window.location.href = "/login";
    }
  } catch (err) {
    window.location.href = "/login";
  }
}

// ── Auth Hooks ─────────────────────────────────────────────────────────────

/**
 * Step 1: Login with email and password
 * Returns OTP token for next step
 */
export function useLoginStep1() {
  return useMutation({
    mutationFn: async (data: {
      email: string;
      password: string;
      device_info?: Record<string, unknown>;
    }) => {
      return secureApiFetch<{ otp_token: string; expires_in: number }>(
        "/auth/v2/login/step1",
        {
          method: "POST",
          body: JSON.stringify(data),
        },
      );
    },
  });
}

/**
 * Step 2: Verify OTP and get authenticated
 * Tokens will be set as HTTP-only cookies automatically
 */
export function useLoginStep2() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      email: string;
      otp: string;
      otp_token: string;
    }) => {
      return secureApiFetch("/auth/v2/login/step2", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      // Invalidate all queries to refetch with new auth
      qc.clear();
    },
  });
}

/**
 * Send OTP to email
 */
export function useSendOtp() {
  return useMutation({
    mutationFn: async (data: { email: string; purpose?: string }) => {
      return secureApiFetch("/auth/v2/send-otp", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
  });
}

/**
 * Logout user and clear cookies
 */
export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (logout_all_devices: boolean = false) => {
      return secureApiFetch("/auth/v2/logout", {
        method: "POST",
        body: JSON.stringify({ logout_all_devices }),
      });
    },
    onSuccess: () => {
      qc.clear();
      // Redirect to login
      window.location.href = "/login";
    },
  });
}

/**
 * Get current user profile
 */
export function useProfile() {
  return useQuery({
    queryKey: ["auth", "profile"],
    queryFn: () => secureApiFetch("/auth/v2/me"),
    staleTime: 5 * 60_000, // 5 minutes
    retry: 1,
  });
}

// ── Finance Hooks ─────────────────────────────────────────────────────────────

export function useFinanceSummary(period?: string) {
  const p = period ?? new Date().toISOString().slice(0, 7);
  return useQuery({
    queryKey: ["finance", "summary", p],
    queryFn: () => secureApiFetch(`/finance/summary?period=${p}`),
    staleTime: 30_000,
  });
}

export function useFinanceEntries(
  filters: {
    page?: number;
    category?: string;
    start_date?: string;
    end_date?: string;
  } = {},
) {
  const params = new URLSearchParams({
    page: String(filters.page ?? 1),
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.start_date ? { start_date: filters.start_date } : {}),
    ...(filters.end_date ? { end_date: filters.end_date } : {}),
  });
  return useQuery({
    queryKey: ["finance", "entries", filters],
    queryFn: () => secureApiFetch(`/finance/entries?${params}`),
    staleTime: 30_000,
  });
}

export function useAddExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      raw_text: string;
      amount: number;
      entry_date?: string;
      note?: string;
    }) =>
      secureApiFetch("/finance/expense", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance"] });
      qc.invalidateQueries({ queryKey: ["insights"] });
    },
  });
}

export function useAddIncome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { amount: number; note?: string; source?: string }) =>
      secureApiFetch("/finance/income", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance"] }),
  });
}

export function useDeleteEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entryId: string) =>
      secureApiFetch(`/finance/entry/${entryId}`, {
        method: "DELETE",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance"] }),
  });
}

// ── AI Insights Hooks ─────────────────────────────────────────────────────────

export function useInsight() {
  return useQuery({
    queryKey: ["insights", "today"],
    queryFn: () => secureApiFetch("/insights/today"),
    staleTime: 60_000,
  });
}

export function useSimulation() {
  return useMutation({
    mutationFn: (params: {
      expense_delta?: number;
      income_delta?: number;
      emi_delta?: number;
    }) =>
      secureApiFetch("/insights/simulate", {
        method: "POST",
        body: JSON.stringify(params),
      }),
  });
}

// ── Learning Hooks ────────────────────────────────────────────────────────────

export function useLessons(difficulty?: string) {
  return useQuery({
    queryKey: ["learning", "lessons", difficulty],
    queryFn: () =>
      secureApiFetch(
        `/learning/lessons${difficulty ? `?difficulty=${difficulty}` : ""}`,
      ),
    staleTime: 7 * 24 * 3600_000, // 7 days
  });
}

export function useLessonDetail(lessonId: string) {
  return useQuery({
    queryKey: ["learning", "lesson", lessonId],
    queryFn: () => secureApiFetch(`/learning/lessons/${lessonId}`),
    enabled: !!lessonId,
  });
}

export function useProgress() {
  return useQuery({
    queryKey: ["learning", "progress"],
    queryFn: () => secureApiFetch("/learning/progress"),
    staleTime: 60_000,
  });
}

export function useCompleteLesson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ lessonId, score }: { lessonId: string; score: number }) =>
      secureApiFetch(`/learning/lessons/${lessonId}/complete`, {
        method: "POST",
        body: JSON.stringify({ score }),
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["learning", "progress"] }),
  });
}

// ── Chat Hook ─────────────────────────────────────────────────────────────────

export function useChatSession(sessionId: string) {
  return useMutation({
    mutationFn: (message: string) =>
      secureApiFetch("/chat/message", {
        method: "POST",
        body: JSON.stringify({ session_id: sessionId, message }),
      }),
  });
}

// ── Macro Data Hook ───────────────────────────────────────────────────────────

export function useMacroData() {
  return useQuery({
    queryKey: ["macro", "snapshot"],
    queryFn: () => secureApiFetch("/macro/snapshot"),
    staleTime: 5 * 60_000, // 5 minutes
    refetchInterval: 5 * 60_000,
  });
}

export function useLiveMacro() {
  return useQuery({
    queryKey: ["macro", "live"],
    queryFn: () => secureApiFetch("/macro/live"),
    refetchInterval: 60_000, // refresh every 60 seconds
    staleTime: 30_000,
  });
}

/**
 * Initialize on app load - request CSRF token
 */
export async function initializeSecureApi() {
  try {
    await requestCsrfToken();
  } catch (err) {
    console.warn("Failed to initialize CSRF token");
  }
}
