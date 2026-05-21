/**
 * EconoMe — API Client & React Query Hooks (Phase 5)
 * Covers all modules: finance, macro, insights, learning, chat.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

// ── Auth helpers ──────────────────────────────────────────────────────────────

function getToken(): string | null {
  return localStorage.getItem("access_token");
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Finance Hooks ─────────────────────────────────────────────────────────────

export function useFinanceSummary(period?: string) {
  const p = period ?? new Date().toISOString().slice(0, 7);
  return useQuery({
    queryKey: ["finance", "summary", p],
    queryFn: () => apiFetch(`/finance/summary?period=${p}`),
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
    queryFn: () => apiFetch(`/finance/entries?${params}`),
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
      apiFetch("/finance/expense", {
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
      apiFetch("/finance/income", {
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
      apiFetch(`/finance/entry/${entryId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance"] }),
  });
}

// ── Macro Data Hook ───────────────────────────────────────────────────────────

export function useMacroData() {
  return useQuery({
    queryKey: ["macro", "snapshot"],
    queryFn: () => apiFetch("/macro/snapshot"),
    staleTime: 5 * 60_000, // 5 minutes
    refetchInterval: 5 * 60_000,
  });
}

// ── AI Insight Hooks ──────────────────────────────────────────────────────────

export function useInsight() {
  return useQuery({
    queryKey: ["insights", "today"],
    queryFn: () => apiFetch("/insights/today"),
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
      apiFetch("/insights/simulate", {
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
      apiFetch(
        `/learning/lessons${difficulty ? `?difficulty=${difficulty}` : ""}`,
      ),
    staleTime: 7 * 24 * 3600_000, // 7 days
  });
}

export function useLessonDetail(lessonId: string) {
  return useQuery({
    queryKey: ["learning", "lesson", lessonId],
    queryFn: () => apiFetch(`/learning/lessons/${lessonId}`),
    enabled: !!lessonId,
  });
}

export function useProgress() {
  return useQuery({
    queryKey: ["learning", "progress"],
    queryFn: () => apiFetch("/learning/progress"),
    staleTime: 60_000,
  });
}

export function useCompleteLesson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ lessonId, score }: { lessonId: string; score: number }) =>
      apiFetch(`/learning/lessons/${lessonId}/complete`, {
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
      apiFetch("/chat/message", {
        method: "POST",
        body: JSON.stringify({ session_id: sessionId, message }),
      }),
  });
}

// ── Auth Hooks ────────────────────────────────────────────────────────────────

export function useLogin() {
  return useMutation({
    mutationFn: (data: {
      email: string;
      password: string;
      device_info?: object;
    }) =>
      apiFetch<{ access_token: string; refresh_token: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => {
      localStorage.clear();
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token);
    },
  });
}
export const useSendOtp = () =>
  useMutation({
    mutationFn: (email: string) =>
      api.post("/auth/send-otp", { email }).then(r => r.data),
  });

export const useVerifyOtp = () =>
  useMutation({
    mutationFn: ({ email, otp }: { email: string; otp: string }) =>
      api.post("/auth/verify-otp", { email, otp }).then(r => r.data),
  });

export function useRegister() {
  return useMutation({
    mutationFn: (data: {
      email: string;
      password: string;
      full_name: string;
    }) =>
      apiFetch("/auth/register", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch("/auth/logout", { method: "POST" }),
    onSuccess: () => {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      qc.clear();
    },
  });
}
export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: () => apiFetch("/auth/profile"),
    staleTime: 60_000,
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { full_name?: string; email?: string }) =>
      apiFetch("/auth/profile", { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });
}

export function useBookmarkLesson() {
  return useMutation({
    mutationFn: (lessonId: string) =>
      apiFetch(`/learning/lessons/${lessonId}/bookmark`, { method: "POST" }),
  });
}
export function useLiveMacro() {
  return useQuery({
    queryKey: ["macro", "live"],
    queryFn: () => apiFetch("/macro/live"),
    refetchInterval: 60_000, // refresh every 60 seconds
    staleTime: 30_000,
  });
}
