"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Lock,
  Mail,
  User as UserIcon,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  AlertCircle,
} from "lucide-react";
import { api, User, getAuthConfig, AuthConfig } from "@/lib/api";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: User) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onAuthSuccess }) => {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authConfig, setAuthConfig] = useState<AuthConfig | null>(null);

  useEffect(() => {
    if (isOpen) {
      getAuthConfig().then(setAuthConfig).catch(() => {});
      setMode("login");
      setError(null);
      setName("");
      setEmail("");
      setPassword("");
      setShowPassword(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validation
    if (mode === "register") {
      if (!name.trim()) {
        setError("Please enter your full name.");
        setLoading(false);
        return;
      }
      if (password.length < 8) {
        setError("Password must be at least 8 characters long.");
        setLoading(false);
        return;
      }
    }

    try {
      const endpoint = mode === "register" ? "/auth/register" : "/auth/login";
      // Registration is strictly locked down to 'user' role — no privilege escalation
      const payload = mode === "register"
        ? { name: name.trim(), email: email.trim().toLowerCase(), password, role: "user" }
        : { email: email.trim().toLowerCase(), password };

      const res = await api<any>(endpoint, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const loggedInUser: User = {
        id: res.user_id,
        name: res.name,
        email: res.email,
        role: res.role,
      };
      onAuthSuccess(loggedInUser);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Authentication failed. Please verify your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (userEmail: string, userPass: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<any>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: userEmail, password: userPass }),
      });
      onAuthSuccess({
        id: res.user_id,
        name: res.name,
        email: res.email,
        role: res.role,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || "Quick sign in failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="modal-dialog bg-white rounded-3xl max-w-md w-full shadow-2xl border border-gray-100 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-[#143e2b] text-white">
          <div>
            <h2 className="text-base font-bold">
              {mode === "login" ? "Sign In to Nutriverse" : "Create Member Account"}
            </h2>
            <p className="text-xs text-emerald-300">
              {mode === "login"
                ? "Access your saved nutrition plan, orders & bag"
                : "Personalized nutrition, whole foods & Calin Packs"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-emerald-300 hover:text-white rounded-full transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Quick 1-Click Role Switcher for Testing (GATED to development env) */}
          {authConfig?.demo_shortcuts_enabled && (
            <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-900 block flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-700" /> Dev Shortcuts (Local Testing Only)
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleQuickLogin("alex@nutriverse.local", "Customer123!")}
                  className="p-2 bg-white hover:bg-emerald-100/70 border border-emerald-200 rounded-xl text-center transition group"
                >
                  <span className="text-[11px] font-bold text-gray-900 block group-hover:text-emerald-900">Alex</span>
                  <span className="text-[10px] text-gray-600 block">Customer</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin("dr.priya@nutriverse.local", "Nutritionist123!")}
                  className="p-2 bg-white hover:bg-teal-100/70 border border-teal-200 rounded-xl text-center transition group"
                >
                  <span className="text-[11px] font-bold text-gray-900 block group-hover:text-teal-900">Dr. Priya</span>
                  <span className="text-[10px] text-gray-600 block">Nutritionist</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin("admin@nutriverse.local", "AdminPass123!")}
                  className="p-2 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl text-center transition group"
                >
                  <span className="text-[11px] font-bold text-gray-900 block group-hover:text-slate-900">Admin</span>
                  <span className="text-[10px] text-gray-600 block">Operations</span>
                </button>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "register" && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Full Name</label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-gray-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Maya Sharma"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {mode === "register" && (
                <span className="text-[10px] text-gray-600 block mt-1">
                  Must be at least 8 characters. Accounts register as Customer.
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-[#236b48] hover:bg-[#1a5338] disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow transition flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                "Authenticating..."
              ) : mode === "login" ? (
                <>Sign In <ArrowRight className="w-3.5 h-3.5" /></>
              ) : (
                <>Create Account <CheckCircle2 className="w-3.5 h-3.5" /></>
              )}
            </button>
          </form>

          {/* Toggle Login / Register */}
          <div className="text-center pt-2 border-t border-gray-100">
            {mode === "login" ? (
              <p className="text-xs text-gray-600">
                New to Nutriverse?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("register");
                    setError(null);
                  }}
                  className="text-emerald-700 font-bold hover:underline"
                >
                  Create an account
                </button>
              </p>
            ) : (
              <p className="text-xs text-gray-600">
                Already registered?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setError(null);
                  }}
                  className="text-emerald-700 font-bold hover:underline"
                >
                  Sign in
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
