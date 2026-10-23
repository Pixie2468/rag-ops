import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { configureDbApi, configureApiKeyApi } from "@/lib/api";
import type { DbStatusResponse } from "@/types/eval";
import {
  Database,
  CheckCircle2,
  AlertTriangle,
  X,
  Copy,
  Check,
  RefreshCw,
  Server,
  Key,
  Sliders,
  Sparkles,
} from "lucide-react";

interface DatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  dbStatus: DbStatusResponse | null;
  onStatusChange: (status: DbStatusResponse) => void;
  backendUrl: string;
  onBackendUrlChange?: (newUrl: string) => void;
  isBackendOnline?: boolean;
  llmKey?: string;
  onLlmKeyChange?: (key: string) => void;
  llmModel?: string;
  onLlmModelChange?: (model: string) => void;
}

export function DatabaseModal({
  isOpen,
  onClose,
  dbStatus,
  onStatusChange,
  backendUrl,
  onBackendUrlChange,
  isBackendOnline,
  llmKey = "",
  onLlmKeyChange,
  llmModel = "gemini-3.5-flash",
  onLlmModelChange,
}: DatabaseModalProps) {
  const [activeTab, setActiveTab] = useState<"database" | "llm" | "backend">("database");
  const [dbUrl, setDbUrl] = useState("");
  const [apiUrlInput, setApiUrlInput] = useState(backendUrl);
  const [apiKeyInput, setApiKeyInput] = useState(llmKey);
  const [modelInput, setModelInput] = useState(llmModel);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [hasCopiedLocal, setHasCopiedLocal] = useState(false);
  const [hasCopiedRemote, setHasCopiedRemote] = useState(false);

  useEffect(() => {
    setApiUrlInput(backendUrl);
  }, [backendUrl]);

  useEffect(() => {
    setApiKeyInput(llmKey);
  }, [llmKey]);

  useEffect(() => {
    setModelInput(llmModel);
  }, [llmModel]);

  if (!isOpen) return null;

  const handleConnectDb = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dbUrl.trim()) {
      setErrorMsg("Please enter a PostgreSQL database connection string.");
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await configureDbApi(dbUrl.trim(), backendUrl);
      onStatusChange(res);
      setSuccessMsg("Connected successfully to PostgreSQL database! Tables verified.");
      setTimeout(() => {
        setSuccessMsg(null);
      }, 3000);
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || "Failed to connect to database.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveLlmKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingKey(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanKey = apiKeyInput.trim();
    if (onLlmKeyChange) {
      onLlmKeyChange(cleanKey);
    }
    if (onLlmModelChange && modelInput.trim()) {
      onLlmModelChange(modelInput.trim());
    }

    if (typeof window !== "undefined") {
      localStorage.setItem("ragops-llm-key", cleanKey);
      localStorage.setItem("ragops-gemini-key", cleanKey);
      localStorage.setItem("ragops-llm-model", modelInput.trim());
    }

    // Attempt to sync to backend if key is provided and backend is online
    if (cleanKey && isBackendOnline) {
      try {
        await configureApiKeyApi(cleanKey, false, backendUrl);
      } catch (err) {
        console.warn("Could not sync key to server runtime, saved to browser localStorage only.", err);
      }
    }

    setIsSavingKey(false);
    setSuccessMsg("LLM Judge configuration saved for this session!");
    setTimeout(() => {
      setSuccessMsg(null);
    }, 3000);
  };

  const setLocalDockerPreset = () => {
    const localUri = "postgresql://ragops:ragops@localhost:5432/eval_results";
    setDbUrl(localUri);
    navigator.clipboard.writeText(localUri);
    setHasCopiedLocal(true);
    setTimeout(() => setHasCopiedLocal(false), 2000);
  };

  const setRemotePreset = () => {
    const remoteUri = "postgresql://postgres:[PASSWORD]@[HOST]:5432/[DBNAME]";
    setDbUrl(remoteUri);
    navigator.clipboard.writeText(remoteUri);
    setHasCopiedRemote(true);
    setTimeout(() => setHasCopiedRemote(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="relative w-full max-w-xl rounded-xl border bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sliders className="size-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">
                Connection & Environment Settings
              </h3>
              <p className="text-xs text-muted-foreground">
                Configure PostgreSQL storage, LLM Judge API key, and Backend endpoint
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            className="size-7 rounded-sm p-0 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 border-b border-border/60 py-2 my-2">
          <Button
            type="button"
            variant={activeTab === "database" ? "default" : "ghost"}
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={() => { setActiveTab("database"); setErrorMsg(null); setSuccessMsg(null); }}
          >
            <Database className="size-3.5" />
            PostgreSQL Database
          </Button>
          <Button
            type="button"
            variant={activeTab === "llm" ? "default" : "ghost"}
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={() => { setActiveTab("llm"); setErrorMsg(null); setSuccessMsg(null); }}
          >
            <Key className="size-3.5" />
            LLM Judge Key & Model
          </Button>
          <Button
            type="button"
            variant={activeTab === "backend" ? "default" : "ghost"}
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={() => { setActiveTab("backend"); setErrorMsg(null); setSuccessMsg(null); }}
          >
            <Server className="size-3.5" />
            Backend URL
          </Button>
        </div>

        {/* Tab 1: Database Setup */}
        {activeTab === "database" && (
          <div className="space-y-4 pt-1">
            {/* Status pill */}
            <div className="rounded-lg border bg-muted/20 p-3 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">Current Status:</span>
                {dbStatus?.connected ? (
                  <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 bg-emerald-500/10 gap-1 font-mono text-[11px]">
                    <CheckCircle2 className="size-3" />
                    Connected ({dbStatus.provider})
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-amber-500 border-amber-500/30 bg-amber-500/10 gap-1 font-mono text-[11px]">
                    <AlertTriangle className="size-3" />
                    In-Memory Buffer (Offline)
                  </Badge>
                )}
              </div>
              <span className="text-[11px] text-muted-foreground truncate max-w-[220px]">
                {dbStatus?.message || "Using fast in-memory fallback"}
              </span>
            </div>

            {/* Presets and Guidance */}
            <div className="rounded-lg border border-border/80 bg-muted/10 p-3 text-xs space-y-2">
              <div className="font-semibold text-foreground flex items-center justify-between">
                <span>Quick Connection Presets:</span>
                <span className="text-[10px] text-muted-foreground font-normal">Works with any Postgres</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={setLocalDockerPreset}
                  className="flex items-start justify-between rounded-md border p-2 text-left hover:bg-muted/40 transition-colors cursor-pointer"
                >
                  <div>
                    <div className="font-medium text-foreground text-xs flex items-center gap-1">
                      Local Docker Postgres
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground truncate max-w-[200px]">
                      localhost:5432/eval_results
                    </div>
                  </div>
                  {hasCopiedLocal ? <Check className="size-3.5 text-emerald-500 shrink-0 mt-0.5" /> : <Copy className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />}
                </button>

                <button
                  type="button"
                  onClick={setRemotePreset}
                  className="flex items-start justify-between rounded-md border p-2 text-left hover:bg-muted/40 transition-colors cursor-pointer"
                >
                  <div>
                    <div className="font-medium text-foreground text-xs flex items-center gap-1">
                      Remote PostgreSQL
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground truncate max-w-[200px]">
                      Supabase, Neon, AWS, etc.
                    </div>
                  </div>
                  {hasCopiedRemote ? <Check className="size-3.5 text-emerald-500 shrink-0 mt-0.5" /> : <Copy className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />}
                </button>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleConnectDb} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="db-url" className="text-xs font-medium">
                  PostgreSQL Connection URI
                </Label>
                <Input
                  id="db-url"
                  type="text"
                  placeholder="postgresql://user:password@host:5432/dbname"
                  value={dbUrl}
                  onChange={(e) => setDbUrl(e.target.value)}
                  className="font-mono text-xs"
                />
                <p className="text-[11px] text-muted-foreground">
                  Reads from server <code className="font-mono text-foreground">DB_URL</code> by default. Enter a URI to connect dynamically.
                </p>
              </div>

              {errorMsg && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
                  {errorMsg}
                </div>
              )}

              {successMsg && (
                <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5" />
                  {successMsg}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSaving}>
                  Close
                </Button>
                <Button type="submit" size="sm" disabled={isSaving} className="gap-1.5">
                  {isSaving && <RefreshCw className="size-3 animate-spin" />}
                  {isSaving ? "Connecting..." : "Connect Database"}
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Tab 2: LLM Judge Configuration */}
        {activeTab === "llm" && (
          <form onSubmit={handleSaveLlmKey} className="space-y-4 pt-1">
            <div className="rounded-lg border bg-muted/10 p-3 text-xs space-y-1.5">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-primary" />
                Stage 5: LLM-as-a-Judge Configuration
              </span>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Stage 5 evaluates subtle multi-hop hallucinations and tone. The pipeline automatically uses the server's <code className="font-mono text-foreground">LLM_API_KEY</code> or <code className="font-mono text-foreground">GEMINI_API_KEY</code> from your <code className="font-mono text-foreground">.env</code>. You can also provide any custom API key here for your browser session.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="modal-llm-key" className="text-xs font-medium">
                LLM API Key
              </Label>
              <Input
                id="modal-llm-key"
                type="password"
                placeholder="Enter API Key (leave empty to use server .env)"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="modal-llm-model" className="text-xs font-medium">
                Judge Model
              </Label>
              <Input
                id="modal-llm-model"
                type="text"
                placeholder="gemini-3.5-flash"
                value={modelInput}
                onChange={(e) => setModelInput(e.target.value)}
                className="font-mono text-xs"
              />
              <div className="flex gap-1.5 pt-1 flex-wrap">
                {["gemini-3.5-flash", "gemini-3.8-flash", "gemini-3.5-flash-lite", "gpt-4o-mini"].map((presetModel) => (
                  <button
                    key={presetModel}
                    type="button"
                    onClick={() => setModelInput(presetModel)}
                    className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                      modelInput === presetModel
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/40 text-muted-foreground hover:bg-muted border-border"
                    }`}
                  >
                    {presetModel}
                  </button>
                ))}
              </div>
            </div>

            {successMsg && (
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5" />
                {successMsg}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSavingKey}>
                Close
              </Button>
              <Button type="submit" size="sm" disabled={isSavingKey} className="gap-1.5">
                {isSavingKey && <RefreshCw className="size-3 animate-spin" />}
                Save LLM Settings
              </Button>
            </div>
          </form>
        )}

        {/* Tab 3: Backend URL Configuration */}
        {activeTab === "backend" && (
          <div className="space-y-4 pt-1">
            <div className="rounded-lg border bg-muted/20 p-3 text-xs flex items-center justify-between">
              <span className="font-semibold text-foreground">Backend Status:</span>
              <Badge
                variant="outline"
                className={
                  isBackendOnline
                    ? "text-emerald-500 border-emerald-500/30 bg-emerald-500/10 text-[10px]"
                    : "text-amber-500 border-amber-500/30 bg-amber-500/10 text-[10px]"
                }
              >
                {isBackendOnline ? "Online" : "Offline / Unreachable"}
              </Badge>
            </div>

            <div className="space-y-2">
              <Label htmlFor="backend-url-input" className="text-xs font-medium">
                Backend API Endpoint
              </Label>
              <div className="flex gap-2">
                <Input
                  id="backend-url-input"
                  value={apiUrlInput}
                  onChange={(e) => setApiUrlInput(e.target.value)}
                  placeholder="http://localhost:8000"
                  className="text-xs font-mono h-8 bg-background"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-8 text-xs shrink-0"
                  onClick={() => {
                    if (apiUrlInput.trim()) {
                      const clean = apiUrlInput.trim().replace(/\/+$/, "");
                      onBackendUrlChange?.(clean);
                      if (typeof window !== "undefined") {
                        localStorage.setItem("ragops-backend-url", clean);
                      }
                      setSuccessMsg(`Backend URL set to ${clean}`);
                      setTimeout(() => setSuccessMsg(null), 3000);
                    }
                  }}
                >
                  Apply URL
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Default: <code className="font-mono text-foreground">http://localhost:8000</code>. Point to any local host or remote deployment.
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => {
                  const defaultLocal = "http://localhost:8000";
                  setApiUrlInput(defaultLocal);
                  onBackendUrlChange?.(defaultLocal);
                  if (typeof window !== "undefined") {
                    localStorage.setItem("ragops-backend-url", defaultLocal);
                  }
                  setSuccessMsg("Reset to http://localhost:8000");
                  setTimeout(() => setSuccessMsg(null), 2000);
                }}
              >
                Reset to http://localhost:8000
              </Button>
            </div>

            {successMsg && (
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5" />
                {successMsg}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
