import React, { useState, useEffect, useCallback } from "react";
import "./index.css";
import { Header } from "@/components/Header";
import { PipelineFlow } from "@/components/PipelineFlow";
import { EvaluationForm } from "@/components/EvaluationForm";
import { MetricsInspector } from "@/components/MetricsInspector";
import { PipelineSpec } from "@/components/PipelineSpec";
import { ObservabilityView } from "@/components/ObservabilityView";
import { BatchEvaluationView } from "@/components/BatchEvaluationView";
import { ModelCompareView } from "@/components/ModelCompareView";
import { DatabaseModal } from "@/components/DatabaseModal";
import { PRESETS, type PresetItem } from "@/lib/presets";
import { getStageStates } from "@/lib/pipeline-stages";
import {
  checkBackendHealth,
  fetchDbStatusApi,
  runEvaluationApi,
  simulateEvaluation,
  DEFAULT_BACKEND_URL,
} from "@/lib/api";
import type { DbStatusResponse, EvalRequest, EvalResponse } from "@/types/eval";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertCircle,
  Sparkles,
  Layers,
  ShieldCheck,
  Activity,
  Scale,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export function App() {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("ragops-theme");
      if (saved === "light" || saved === "dark") return saved;
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "dark";
  });

  const [backendUrl, setBackendUrl] = useState(DEFAULT_BACKEND_URL);
  const [isBackendOnline, setIsBackendOnline] = useState(false);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Database / Supabase state
  const [isDbModalOpen, setIsDbModalOpen] = useState(false);
  const [dbStatus, setDbStatus] = useState<DbStatusResponse | null>(null);

  const [activePresetId, setActivePresetId] = useState<string | null>("clean-pass");
  const [request, setRequest] = useState<EvalRequest>(() => {
    const defaultData = PRESETS[0]!.data;
    if (typeof window !== "undefined") {
      const savedKey = localStorage.getItem("ragops-gemini-key");
      if (savedKey) {
        return { ...defaultData, api_key: savedKey };
      }
    }
    return defaultData;
  });
  const [response, setResponse] = useState<EvalResponse | null>(PRESETS[0]!.mockResponse);
  const [isLoading, setIsLoading] = useState(false);
  const [activeStageIdx, setActiveStageIdx] = useState(4);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Apply theme class to document
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("ragops-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  // Check backend health & database status
  const handleCheckHealth = useCallback(async () => {
    setIsCheckingHealth(true);
    const online = await checkBackendHealth(backendUrl);
    setIsBackendOnline(online);

    if (online) {
      try {
        const dbRes = await fetchDbStatusApi(backendUrl);
        setDbStatus(dbRes);
      } catch {
        setDbStatus({
          connected: false,
          provider: "in-memory-fallback",
          message: "Could not fetch DB status.",
        });
      }
    }

    setIsCheckingHealth(false);
    if (!online && !isDemoMode) {
      setIsDemoMode(true);
    }
  }, [backendUrl, isDemoMode]);

  useEffect(() => {
    handleCheckHealth();
  }, [handleCheckHealth]);

  // Handle Preset selection
  const handleSelectPreset = (preset: PresetItem) => {
    setActivePresetId(preset.id);
    const savedKey = typeof window !== "undefined" ? localStorage.getItem("ragops-gemini-key") || undefined : undefined;
    setRequest({
      ...preset.data,
      api_key: savedKey,
    });
    setResponse(preset.mockResponse);
    setErrorMessage(null);
  };

  // Run pipeline evaluation
  const handleRunEvaluation = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setActiveStageIdx(0);

    try {
      if (isDemoMode) {
        const result = await simulateEvaluation(request, (stageIdx) => {
          setActiveStageIdx(stageIdx);
        });
        setResponse(result);
      } else {
        const result = await runEvaluationApi(request, backendUrl);
        setResponse(result);
      }
    } catch (err: unknown) {
      const msg = (err as Error).message || "An unexpected error occurred.";
      setErrorMessage(msg);
      if (msg.includes("Failed to fetch") || msg.includes("NetworkError") || msg.includes("500")) {
        setIsBackendOnline(false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const stageStates = getStageStates(response, isLoading, activeStageIdx);

  return (
    <div className="min-h-screen flex flex-col bg-background font-sans text-foreground selection:bg-primary/20 selection:text-primary">
      {/* Navbar Header */}
      <Header
        isBackendOnline={isBackendOnline}
        isDemoMode={isDemoMode}
        setIsDemoMode={setIsDemoMode}
        isCheckingHealth={isCheckingHealth}
        onRefreshHealth={handleCheckHealth}
        theme={theme}
        onToggleTheme={toggleTheme}
        backendUrl={backendUrl}
        isDbConnected={Boolean(dbStatus?.connected)}
        onOpenDbModal={() => setIsDbModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 container mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-6">
        {/* Offline / Demo Notification Banner */}
        {!isBackendOnline && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-800 dark:text-amber-300">
            <div className="flex items-center gap-2.5">
              <Sparkles className="size-4 shrink-0 text-amber-500" />
              <span>
                <strong>Demo Mode Active:</strong> Backend API at <code className="font-mono bg-amber-500/20 px-1 py-0.5 rounded text-[11px]">{backendUrl}</code> is currently offline. You can test all 5 pipeline stages and evaluate presets right here in simulated demo mode.
              </span>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCheckHealth}
                disabled={isCheckingHealth}
                className="h-7 text-xs border-amber-500/40 hover:bg-amber-500/20"
              >
                Retry Backend
              </Button>
            </div>
          </div>
        )}

        {/* Evaluation Error Banner */}
        {errorMessage && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive">
            <div className="flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            {!isDemoMode && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsDemoMode(true);
                  setErrorMessage(null);
                }}
                className="h-7 text-xs"
              >
                Switch to Demo Mode
              </Button>
            )}
          </div>
        )}

        {/* 5-Stage Fail-Fast Visualizer Bar */}
        <PipelineFlow
          stageStates={stageStates}
          response={response}
          isLoading={isLoading}
          activeStageIdx={activeStageIdx}
        />

        {/* Navigation Tabs */}
        <Tabs defaultValue="playground" className="space-y-6">
          <div className="flex items-center justify-between border-b pb-3 overflow-x-auto">
            <TabsList>
              <TabsTrigger value="playground" className="gap-2 text-xs">
                <Layers className="size-3.5" />
                Single Run
              </TabsTrigger>
              <TabsTrigger value="observability" className="gap-2 text-xs">
                <Activity className="size-3.5" />
                Observability & Traces
              </TabsTrigger>
              <TabsTrigger value="batch" className="gap-2 text-xs">
                <Sparkles className="size-3.5" />
                Batch Benchmark
              </TabsTrigger>
              <TabsTrigger value="compare" className="gap-2 text-xs">
                <Scale className="size-3.5" />
                Model A/B Compare
              </TabsTrigger>
              <TabsTrigger value="architecture" className="gap-2 text-xs">
                <ShieldCheck className="size-3.5" />
                Pipeline Spec
              </TabsTrigger>
            </TabsList>
          </div>

          {/* 1. Playground Tab */}
          <TabsContent value="playground" className="space-y-6 mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Form / Triad inputs */}
              <div className="lg:col-span-5 w-full">
                <EvaluationForm
                  request={request}
                  onChangeRequest={(newReq) => {
                    setRequest(newReq);
                    setActivePresetId(null);
                  }}
                  onSubmit={handleRunEvaluation}
                  isLoading={isLoading}
                  onSelectPreset={handleSelectPreset}
                  activePresetId={activePresetId}
                />
              </div>

              {/* Right Column: Stage Diagnostics & Metrics Inspector */}
              <div className="lg:col-span-7 w-full">
                <MetricsInspector
                  response={response}
                  request={request}
                  isLoading={isLoading}
                  backendUrl={backendUrl}
                />
              </div>
            </div>
          </TabsContent>

          {/* 2. Observability & Traces Tab */}
          <TabsContent value="observability" className="mt-0">
            <ObservabilityView
              backendUrl={backendUrl}
              onOpenDbModal={() => setIsDbModalOpen(true)}
              isDbConnected={Boolean(dbStatus?.connected)}
            />
          </TabsContent>

          {/* 3. Batch Evaluation Tab */}
          <TabsContent value="batch" className="mt-0">
            <BatchEvaluationView
              backendUrl={backendUrl}
              apiKey={request.api_key}
            />
          </TabsContent>

          {/* 4. Model A/B Compare Tab */}
          <TabsContent value="compare" className="mt-0">
            <ModelCompareView
              backendUrl={backendUrl}
              apiKey={request.api_key}
            />
          </TabsContent>

          {/* 5. Architecture Spec Tab */}
          <TabsContent value="architecture" className="mt-0">
            <PipelineSpec />
          </TabsContent>
        </Tabs>
      </main>

      {/* Supabase Database Setup Modal */}
      <DatabaseModal
        isOpen={isDbModalOpen}
        onClose={() => setIsDbModalOpen(false)}
        dbStatus={dbStatus}
        onStatusChange={(newStatus) => setDbStatus(newStatus)}
        backendUrl={backendUrl}
      />

      {/* Footer */}
      <footer className="border-t py-6 bg-card/40 mt-auto">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">RAGOps</span>
            <span>•</span>
            <span>Observability & Evaluation Platform for RAG Applications</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="http://localhost:8000/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              API Swagger Docs
            </a>
            <a
              href="https://github.com/Pixie2468/rag-ops"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              GitHub
            </a>
            <span>MIT License</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
