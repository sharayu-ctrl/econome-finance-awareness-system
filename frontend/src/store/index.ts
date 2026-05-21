/**
 * EconoMe — Enhanced Zustand Global State (Phase 2 Update)
 * Manages: auth state, UI preferences (theme, language), API initialization
 * Server state is handled by React Query.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import i18n from "../i18n";

interface User {
  user_id: string;
  full_name: string;
  email: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User) => void;
  clearAuth: () => void;
}

interface UIState {
  theme: "light" | "dark";
  language: "en" | "hi" | "mr";
  amountsRevealed: boolean;
  toggleTheme: () => void;
  toggleAmounts: () => void;
  setLanguage: (lang: "en" | "hi" | "mr") => void;
}

// Auth store — uses cookies for tokens (not localStorage)
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  setUser: (user) => set({ user, isAuthenticated: true }),
  clearAuth: () => set({ user: null, isAuthenticated: false }),
}));

// UI preferences — persisted across sessions
export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: "light",
      language: "en",
      amountsRevealed: false,
      toggleTheme: () =>
        set((s) => ({ theme: s.theme === "light" ? "dark" : "light" })),
      toggleAmounts: () =>
        set((s) => ({ amountsRevealed: !s.amountsRevealed })),
      setLanguage: (language: "en" | "hi" | "mr") => {
        set({ language });
        // Sync with i18n
        i18n
          .changeLanguage(language)
          .catch((err) => console.error("Failed to change language:", err));
      },
    }),
    {
      name: "econome-ui-prefs",
      // Only persist language and theme for security
      partialize: (state) => ({
        language: state.language,
        theme: state.theme,
      }),
    },
  ),
);

// Initialize i18n from stored preference on app load
useUIStore.subscribe((state) => {
  if (state.language) {
    i18n
      .changeLanguage(state.language)
      .catch((err) => console.error("Failed to sync language:", err));
  }
});
