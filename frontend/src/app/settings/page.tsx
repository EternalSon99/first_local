"use client";

import { motion } from "framer-motion";
import { Bot, Check, Key, Shield, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageWrapper } from "@/components/PageWrapper";

const PROVIDERS = [
  {
    id: "google",
    name: "Google Gemini",
    description: "Free tier available — great for testing",
    placeholder: "AIza...",
    gradient: "from-blue-500 to-cyan-500",
    bgGradient: "from-blue-50 to-cyan-50",
    getKeyUrl: "https://aistudio.google.com/apikey",
  },
  {
    id: "anthropic",
    name: "Anthropic Claude",
    description: "Best quality — requires paid API credits",
    placeholder: "sk-ant-api03-...",
    gradient: "from-orange-500 to-amber-500",
    bgGradient: "from-orange-50 to-amber-50",
    getKeyUrl: "https://console.anthropic.com",
  },
  {
    id: "openai",
    name: "OpenAI ChatGPT",
    description: "GPT-4o-mini — requires paid API credits",
    placeholder: "sk-proj-...",
    gradient: "from-emerald-500 to-teal-500",
    bgGradient: "from-emerald-50 to-teal-50",
    getKeyUrl: "https://platform.openai.com/api-keys",
  },
];

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState("");
  const [provider, setProvider] = useState("google");
  const [saved, setSaved] = useState(false);
  const [hasKey, setHasKey] = useState(false);

  useEffect(() => {
    const key = localStorage.getItem("studyengine_api_key") || "";
    const prov = localStorage.getItem("studyengine_ai_provider") || "google";
    setApiKey(key);
    setProvider(prov);
    setHasKey(!!key);
  }, []);

  const selectedProvider = PROVIDERS.find((p) => p.id === provider) || PROVIDERS[0];

  const handleSave = () => {
    if (apiKey.trim()) {
      localStorage.setItem("studyengine_api_key", apiKey.trim());
      setHasKey(true);
    } else {
      localStorage.removeItem("studyengine_api_key");
      setHasKey(false);
    }
    localStorage.setItem("studyengine_ai_provider", provider);
    setSaved(true);
    toast.success("Settings saved");
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClear = () => {
    setApiKey("");
    localStorage.removeItem("studyengine_api_key");
    setHasKey(false);
    toast.success("API key removed");
  };

  return (
    <PageWrapper>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-gray-500 mt-1">Configure your StudyEngine preferences</p>
      </motion.div>

      <div className="max-w-2xl space-y-6">
        {/* Provider Selection */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden"
        >
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-600 to-gray-800 flex items-center justify-center shadow-sm">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold">AI Provider</h2>
                <p className="text-xs text-gray-500">Choose which AI model powers your study sessions</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="grid gap-3">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setProvider(p.id)}
                  className={`w-full text-left rounded-xl border-2 p-4 transition-all ${
                    provider === p.id
                      ? "border-emerald-500 bg-emerald-50/30 shadow-sm"
                      : "border-gray-100 hover:border-gray-200 hover:bg-gray-50/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${p.gradient} flex items-center justify-center`}>
                        <Bot className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <div className="font-semibold text-sm">{p.name}</div>
                        <div className="text-xs text-gray-400">{p.description}</div>
                      </div>
                    </div>
                    {provider === p.id && (
                      <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* API Key Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden"
        >
          <div className={`bg-gradient-to-r ${selectedProvider.bgGradient} px-6 py-4 border-b border-gray-100`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${selectedProvider.gradient} flex items-center justify-center shadow-sm`}>
                  <Key className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="font-bold">{selectedProvider.name} API Key</h2>
                  <p className="text-xs text-gray-500">Required for AI features</p>
                </div>
              </div>
              {hasKey && (
                <Badge variant="success" className="flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Connected
                </Badge>
              )}
            </div>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">
                API Key
              </label>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={selectedProvider.placeholder}
                className="font-mono text-sm"
              />
              <a
                href={selectedProvider.getKeyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-emerald-600 hover:text-emerald-700 mt-1.5 inline-block"
              >
                Get a {selectedProvider.name} API key &rarr;
              </a>
            </div>

            <div className="flex items-start gap-2 text-xs text-gray-400 bg-gray-50 rounded-xl p-3">
              <Shield className="w-4 h-4 flex-shrink-0 mt-0.5 text-gray-400" />
              <span>
                Your API key is stored locally in your browser and sent to the
                provider API via the backend. It is never persisted on the server.
              </span>
            </div>

            <div className="flex gap-3">
              <Button
                variant="brilliant"
                onClick={handleSave}
                disabled={saved}
              >
                {saved ? (
                  <><Check className="w-4 h-4 mr-2" />Saved!</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-2" />Save Settings</>
                )}
              </Button>
              {hasKey && (
                <Button variant="outline" onClick={handleClear}>
                  Clear Key
                </Button>
              )}
            </div>
          </div>
        </motion.div>

        {/* About card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl bg-white border border-gray-100 shadow-sm p-6"
        >
          <h3 className="font-bold mb-2">About StudyEngine</h3>
          <p className="text-sm text-gray-500 leading-relaxed">
            StudyEngine is a curriculum-aware AI study system that generates
            questions from your course materials, grades answers using rubrics,
            and tracks mastery across topics. Upload your textbooks, transcripts,
            and notes — then test yourself with flashcards, timed exams, and
            progressive difficulty levels.
          </p>
          <div className="flex items-center gap-2 mt-4">
            <Badge variant="secondary">v1.0.0</Badge>
            <Badge variant="blue">Multi-AI Powered</Badge>
          </div>
        </motion.div>
      </div>
    </PageWrapper>
  );
}
