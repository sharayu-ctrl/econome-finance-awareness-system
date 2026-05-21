import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, NavLink, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Dashboard from "./pages/Dashboard";
import TutorChat from "./pages/TutorChat";
import LearningHub from "./pages/LearningHub";
import { RegisterPage, LoginPage } from "./pages/AuthPages";
import LandingPage from "./pages/LandingPage";
import OTPPage from "./pages/OTPPage";
import DeviceVerifyPage from "./pages/DeviceVerifyPage";
import ProfilePage from "./pages/ProfilePage";
import { useAuthStore, useUIStore } from "./store";
import EconomyPage from "./pages/EconomyPage";
import MoneyPage from "./pages/MoneyPage";
import InsightsPage from "./pages/InsightsPage";
import LanguageSelector from "./LanguageSelector";
import { initializeSecureApi } from "./lib/secureApi";

const Sidebar = () => {
  const { t } = useTranslation();

  const NAV = [
    { to: "/dashboard", label: t("navigation.dashboard"), icon: "📊" },
    { to: "/economy", label: t("navigation.economy"), icon: "📈" },
    { to: "/money", label: t("navigation.money"), icon: "💰" },
    { to: "/learn", label: t("navigation.learn"), icon: "🎓" },
    { to: "/chat", label: t("navigation.chat"), icon: "🤖" },
    { to: "/insights", label: t("navigation.insights"), icon: "📊" },
    { to: "/profile", label: t("navigation.profile"), icon: "👤" },
  ];

  return (
    <div className="w-56 min-h-screen bg-white border-r border-gray-100 flex flex-col py-6 px-3 fixed left-0 top-0">
      <div className="flex items-center gap-2 px-3 mb-8">
        <div className="w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center">
          <span className="text-white text-xs font-bold">E</span>
        </div>
        <span className="font-bold text-gray-900">{t("common.appName")}</span>
      </div>
      <nav className="space-y-1 flex-1">
        {NAV.map(link => (
          <NavLink key={link.to} to={link.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                isActive ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
              }`
            }>
            <span>{link.icon}</span>
            {link.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-gray-200 pt-4">
        <LanguageSelector />
      </div>
    </div>
  );
};

const AppShell = ({ children }: { children: React.ReactNode }) => (
  <div className="flex">
    <Sidebar />
    <div className="ml-56 flex-1 min-h-screen bg-gray-50">
      <div className="px-8 py-6">{children}</div>
    </div>
  </div>
);

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <AppShell>{children}</AppShell>;
};

function AppCore() {
  const { i18n } = useTranslation();
  const theme = useUIStore(s => s.theme);

  // Initialize secure API client on app startup
  useEffect(() => {
    initializeSecureApi().catch(err =>
      console.error("Failed to initialize secure API:", err)
    );
  }, []);

  // Apply theme
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/otp" element={<OTPPage />} />
      <Route path="/device-verify" element={<DeviceVerifyPage />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/money" element={<ProtectedRoute><MoneyPage /></ProtectedRoute>} />
      <Route path="/learn" element={<ProtectedRoute><LearningHub /></ProtectedRoute>} />
      <Route path="/chat" element={<ProtectedRoute><TutorChat /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
      <Route path="/economy" element={<ProtectedRoute><EconomyPage /></ProtectedRoute>} />
      <Route path="/insights" element={<ProtectedRoute><InsightsPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppCore />
    </BrowserRouter>
  );
}
