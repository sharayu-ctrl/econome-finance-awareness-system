import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRegister, useLogin } from "../lib/api";
import { useAuthStore } from "../store";

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const register = useRegister();
  const [form, setForm] = useState({ full_name: "", email: "", password: "", role: "" });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    register.mutate(
      { full_name: form.full_name, email: form.email, password: form.password },
      {
        onSuccess: () => navigate("/login"),
        onError: (err: any) => setError(err.message || "Registration failed"),
      }
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center mb-3">
            <span className="text-white font-bold">E</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
          <p className="text-gray-500 text-sm mt-1">Start your financial journey with EconoMe</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-700 mb-1 font-medium">Full Name</label>
            <input
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="Your full name"
              value={form.full_name}
              onChange={e => setForm({ ...form, full_name: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1 font-medium">Email</label>
            <input
              type="email"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="you@example.com"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1 font-medium">Password</label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 pr-10"
                placeholder="Create a strong password"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                required
              />
              <button type="button" onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-2.5 text-gray-400 text-sm">
                {showPass ? "🙈" : "👁️"}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1 font-medium">Your Role</label>
            <select
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
              value={form.role}
              onChange={e => setForm({ ...form, role: e.target.value })}
            >
              <option value="">Select your role</option>
              <option value="student">Student</option>
              <option value="salaried">Salaried Professional</option>
              <option value="business">Business Owner</option>
              <option value="homemaker">Homemaker</option>
              <option value="retired">Retired</option>
            </select>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={register.isPending}
            className="w-full bg-gray-900 text-white rounded-xl py-3 font-medium hover:bg-gray-700 disabled:opacity-50"
          >
            {register.isPending ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          Already have an account?{" "}
          <button onClick={() => navigate("/login")} className="text-indigo-600 hover:underline font-medium">
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
};

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const login = useLogin();
  const setUser = useAuthStore(s => s.setUser);
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    login.mutate(
      {
        email: form.email,
        password: form.password,
        device_info: {
          os_name: navigator.platform,
          os_version: "",
          browser_name: navigator.userAgent.split(" ")[0],
          browser_version: "",
          screen_resolution: `${screen.width}x${screen.height}`,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          font_hash: "default",
        },
      },
      {
        onSuccess: () => {
  setUser({ user_id: "", full_name: "", email: form.email });
  localStorage.setItem("econome_pending_email", form.email);
  navigate("/otp");
},
        onError: (err: any) => setError(err.message || "Login failed"),
      }
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center mb-3">
            <span className="text-white text-xl">🛡️</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
          <p className="text-gray-500 text-sm mt-1">Sign in to your EconoMe account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-700 mb-1 font-medium">Email</label>
            <input
              type="email"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="you@example.com"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1 font-medium">Password</label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 pr-10"
                placeholder="Your password"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                required
              />
              <button type="button" onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-2.5 text-gray-400 text-sm">
                {showPass ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={login.isPending}
            className="w-full bg-gray-900 text-white rounded-xl py-3 font-medium hover:bg-gray-700 disabled:opacity-50"
          >
            {login.isPending ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          Don't have an account?{" "}
          <button onClick={() => navigate("/register")} className="text-indigo-600 hover:underline font-medium">
            Sign up
          </button>
        </p>
      </div>
    </div>
  );
};
