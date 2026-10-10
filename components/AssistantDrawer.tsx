"use client";

import React, { useState } from "react";
import { X, Sparkles, Send, Bot, User as UserIcon, RefreshCw, ShieldAlert, CheckCircle2 } from "lucide-react";
import { api, User } from "@/lib/api";

interface Message {
  sender: "user" | "ai";
  text: string;
  sources?: string[];
  engine?: string;
}

interface AssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
}

export const AssistantDrawer: React.FC<AssistantDrawerProps> = ({ isOpen, onClose, user }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: "ai",
      text: "Hello! I am Nourish AI, your nutrition intelligence assistant. My responses are strictly grounded in the verified Nutriverse whole-food database and recipe guidelines. How can I help you choose or prepare your food today?",
      engine: "Nutriverse Grounded Assistant v2",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const quickPrompts = [
    "Which foods in store have the highest iron?",
    "What whole foods provide clean protein?",
    "Explain the difference between Calin Pack tiers",
    "How to prepare broccoli to retain sulforaphane?",
  ];

  const handleSend = async (queryText?: string) => {
    const textToSend = queryText || input;
    if (!textToSend.trim() || loading) return;

    const userMsg: Message = { sender: "user", text: textToSend };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await api<any>(`/ai/chat?question=${encodeURIComponent(textToSend)}`, {
        method: "POST",
      });

      const aiMsg: Message = {
        sender: "ai",
        text: res.answer,
        sources: res.grounded_sources,
        engine: res.ai_engine,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text: `Unable to complete AI query: ${err?.message || "Please sign in or check connectivity."}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="drawer-overlay fixed inset-0 z-50 overflow-hidden bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-content w-screen max-w-md bg-white shadow-2xl flex flex-col border-l border-gray-100">
          {/* Header */}
          <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-emerald-900 to-teal-900 text-white">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-emerald-300">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold flex items-center gap-1.5">
                  Nourish AI Assistant
                  <span className="text-[10px] bg-emerald-400/20 text-emerald-300 px-2 py-0.5 rounded-full font-mono font-normal">
                    Database Grounded
                  </span>
                </h2>
                <p className="text-[11px] text-emerald-200/80">Fact-Checked Biological Nutrition Guidance</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-white/70 hover:text-white rounded-full hover:bg-white/10 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Prompts Bar */}
          <div className="p-3 bg-gray-50 border-b border-gray-100 overflow-x-auto whitespace-nowrap space-x-2">
            {quickPrompts.map((q, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSend(q)}
                className="inline-block px-2.5 py-1 text-[11px] bg-white border border-gray-200 hover:border-emerald-500 hover:text-emerald-800 rounded-lg text-gray-700 transition"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/30">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex gap-2.5 ${m.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                {m.sender === "ai" && (
                  <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-1">
                    <Bot className="w-4 h-4" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] p-3.5 rounded-2xl text-xs space-y-2 leading-relaxed ${
                    m.sender === "user"
                      ? "bg-emerald-600 text-white rounded-tr-none"
                      : "bg-white text-gray-800 border border-gray-100 shadow-sm rounded-tl-none"
                  }`}
                >
                  <p>{m.text}</p>
                  {m.sources && m.sources.length > 0 && (
                    <div className="pt-2 border-t border-gray-100 text-[10px] text-gray-600 space-y-1">
                      <span className="font-semibold text-emerald-800 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Grounded Database Sources:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {m.sources.map((s, si) => (
                          <span key={si} className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {m.sender === "user" && (
                  <div className="w-7 h-7 rounded-lg bg-gray-200 text-gray-700 flex items-center justify-center shrink-0 mt-1">
                    <UserIcon className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-xs text-gray-600 pl-9">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                Querying Nutriverse food composition index...
              </div>
            )}
          </div>

          {/* Medical Disclaimer */}
          <div className="px-4 py-2 bg-amber-50/70 border-t border-amber-100 text-[10px] text-amber-800 flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-amber-600" />
            <span>Educational guidance only. Not medical diagnosis or healthcare prescription.</span>
          </div>

          {/* Chat Input */}
          <div className="p-4 border-t border-gray-100 bg-white">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                placeholder="Ask about nutrients, recipes, or Calin Packs..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="flex-1 px-3.5 py-2.5 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="p-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl transition"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
