import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PRESETS, type PresetItem } from "@/lib/presets";
import type { EvalRequest } from "@/types/eval";
import {
  Play,
  RotateCcw,
  Plus,
  Trash2,
  FileJson,
  Upload,
  Sparkles,
  Layers,
  Code2,
  AlertCircle,
  Check,
  Key,
  Eye,
  EyeOff,
} from "lucide-react";

interface EvaluationFormProps {
  request: EvalRequest;
  onChangeRequest: (req: EvalRequest) => void;
  onSubmit: () => void;
  isLoading: boolean;
  onSelectPreset: (preset: PresetItem) => void;
  activePresetId: string | null;
}

export function EvaluationForm({
  request,
  onChangeRequest,
  onSubmit,
  isLoading,
  onSelectPreset,
  activePresetId,
}: EvaluationFormProps) {
  const [mode, setMode] = useState<"form" | "json">("form");
  const [showApiKey, setShowApiKey] = useState(false);
  const [rawJsonText, setRawJsonText] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync rawJsonText when request changes externally (e.g. preset selection)
  useEffect(() => {
    setRawJsonText(JSON.stringify(request, null, 2));
    setJsonError(null);
  }, [request]);

  // Keyboard shortcut: Ctrl/Cmd + Enter to run
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (!isLoading) {
          handleSubmit();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLoading, request, mode, rawJsonText]);

  const handleQueryChange = (val: string) => {
    onChangeRequest({ ...request, query: val });
  };

  const handleAnswerChange = (val: string) => {
    onChangeRequest({ ...request, answer: val });
  };

  const handleApiKeyChange = (val: string) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("ragops-gemini-key", val);
    }
    onChangeRequest({ ...request, api_key: val });
  };

  const handleChunkChange = (index: number, val: string) => {
    const newChunks = [...request.context_chunks];
    newChunks[index] = val;
    onChangeRequest({ ...request, context_chunks: newChunks });
  };

  const handleAddChunk = () => {
    onChangeRequest({
      ...request,
      context_chunks: [...request.context_chunks, ""],
    });
  };

  const handleRemoveChunk = (index: number) => {
    const newChunks = request.context_chunks.filter((_, i) => i !== index);
    onChangeRequest({
      ...request,
      context_chunks: newChunks.length > 0 ? newChunks : [""],
    });
  };

  const handleRawJsonChange = (val: string) => {
    setRawJsonText(val);
    try {
      const parsed = JSON.parse(val);
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        "query" in parsed &&
        "context_chunks" in parsed &&
        "answer" in parsed &&
        Array.isArray(parsed.context_chunks)
      ) {
        setJsonError(null);
        onChangeRequest(parsed as EvalRequest);
      } else {
        setJsonError("JSON must contain 'query' (string), 'context_chunks' (string[]), and 'answer' (string)");
      }
    } catch (err: unknown) {
      setJsonError((err as Error).message);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        if (
          parsed &&
          typeof parsed === "object" &&
          "query" in parsed &&
          "context_chunks" in parsed &&
          "answer" in parsed
        ) {
          onChangeRequest(parsed as EvalRequest);
          setRawJsonText(JSON.stringify(parsed, null, 2));
          setJsonError(null);
        } else {
          setJsonError("Uploaded file does not match EvalRequest schema.");
        }
      } catch (err) {
        setJsonError("Invalid JSON file.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleSubmit = () => {
    if (mode === "json" && jsonError) return;
    if (!request.query.trim()) {
      setJsonError("Query cannot be empty.");
      return;
    }
    if (request.context_chunks.length === 0 || !request.context_chunks.some((c) => c.trim())) {
      setJsonError("At least one context chunk is required.");
      return;
    }
    if (!request.answer.trim()) {
      setJsonError("Answer cannot be empty.");
      return;
    }
    setJsonError(null);
    onSubmit();
  };

  return (
    <div className="flex flex-col rounded-xl border bg-card p-4 sm:p-5 shadow-xs gap-4">
      {/* Card Header & Presets */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Layers className="size-4 text-primary" />
            <h3 className="text-base font-semibold text-foreground">
              Evaluation Input Triad (Q, C, A)
            </h3>
          </div>

          {/* Mode Switcher & Upload */}
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".json"
              className="hidden"
              aria-label="Upload JSON file"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="h-8 text-xs gap-1.5"
              title="Upload a .json evaluation file"
            >
              <Upload className="size-3.5" />
              Upload JSON
            </Button>

            <div className="flex items-center rounded-lg border bg-muted/50 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setMode("form")}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                  mode === "form"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Form
              </button>
              <button
                type="button"
                onClick={() => setMode("json")}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                  mode === "json"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Raw JSON
              </button>
            </div>
          </div>
        </div>

        {/* Preset Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 text-xs scrollbar-none">
          <span className="text-muted-foreground text-[11px] shrink-0 font-medium mr-1 flex items-center gap-1">
            <Sparkles className="size-3" />
            Presets:
          </span>
          {PRESETS.map((preset) => {
            const isSelected = activePresetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onSelectPreset(preset)}
                className={`shrink-0 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                  isSelected
                    ? "border-primary bg-primary/10 text-primary font-semibold"
                    : "border-border/70 bg-card hover:bg-accent text-muted-foreground hover:text-foreground"
                }`}
                title={preset.description}
              >
                {preset.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Form Error Banner */}
      {jsonError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          <span>{jsonError}</span>
        </div>
      )}

      {/* Inputs */}
      {mode === "form" ? (
        <div className="flex flex-col gap-4">
          {/* Query (Q) */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="eval-query" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                1. User Query (Q)
              </Label>
              <span className="text-[11px] text-muted-foreground font-mono">
                {request.query.length} chars
              </span>
            </div>
            <Input
              id="eval-query"
              value={request.query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="e.g. What is the capital of France?"
              className="text-sm font-sans"
            />
          </div>

          {/* Context Chunks (C) */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                2. Retrieved Context Chunks (C) — {request.context_chunks.length} Chunks
              </Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleAddChunk}
                className="h-7 text-xs text-primary hover:text-primary gap-1 px-2"
              >
                <Plus className="size-3" />
                Add Chunk
              </Button>
            </div>

            <div className="flex flex-col gap-2.5 max-h-[300px] overflow-y-auto pr-1">
              {request.context_chunks.map((chunk, idx) => (
                <div key={idx} className="relative group rounded-md border bg-muted/20 p-2.5 transition-colors focus-within:border-primary/50">
                  <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-border/40 text-[11px] text-muted-foreground">
                    <span className="font-mono font-medium">Chunk #{idx + 1}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono">{chunk.length} chars</span>
                      {request.context_chunks.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveChunk(idx)}
                          className="size-5 rounded p-0 text-muted-foreground hover:text-destructive flex items-center justify-center transition-colors"
                          aria-label={`Remove chunk ${idx + 1}`}
                          title="Remove this chunk"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <Textarea
                    value={chunk}
                    onChange={(e) => handleChunkChange(idx, e.target.value)}
                    placeholder={`Context chunk ${idx + 1} text...`}
                    rows={2}
                    className="border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0 resize-y"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Generated Answer (A) */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="eval-answer" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                3. Generated LLM Answer (A)
              </Label>
              <span className="text-[11px] text-muted-foreground font-mono">
                {request.answer.length} chars
              </span>
            </div>
            <Textarea
              id="eval-answer"
              value={request.answer}
              onChange={(e) => handleAnswerChange(e.target.value)}
              placeholder="e.g. The capital of France is Paris."
              rows={3}
              className="text-sm font-sans resize-y"
            />
          </div>

          {/* Optional Gemini API Key for Stage 5 LLM Judge */}
          <div className="flex flex-col gap-1.5 rounded-lg border border-dashed border-border/80 bg-muted/10 p-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="eval-api-key" className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Key className="size-3.5 text-primary" />
                Gemini API Key (Stage 5 LLM Judge)
              </Label>
              <span className="text-[10px] text-muted-foreground font-mono">
                Optional
              </span>
            </div>
            <div className="relative flex items-center">
              <Input
                id="eval-api-key"
                type={showApiKey ? "text" : "password"}
                value={request.api_key || ""}
                onChange={(e) => handleApiKeyChange(e.target.value)}
                placeholder="AIzaSy... (leave blank to use server GEMINI_API_KEY)"
                className="text-xs font-mono pr-9"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-1 size-7 text-muted-foreground hover:text-foreground"
                aria-label={showApiKey ? "Hide API key" : "Show API key"}
              >
                {showApiKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground leading-tight">
              Passed to the FastAPI backend to run Gemini as an evaluation judge for Stage 5.
            </p>
          </div>
        </div>
      ) : (
        /* Raw JSON Mode */
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="eval-raw-json" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Raw JSON (matching EvalRequest schema)
            </Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                try {
                  const obj = JSON.parse(rawJsonText);
                  setRawJsonText(JSON.stringify(obj, null, 2));
                  setJsonError(null);
                } catch {
                  setJsonError("Invalid JSON cannot be formatted.");
                }
              }}
              className="h-7 text-xs px-2"
            >
              Format JSON
            </Button>
          </div>
          <Textarea
            id="eval-raw-json"
            value={rawJsonText}
            onChange={(e) => handleRawJsonChange(e.target.value)}
            rows={14}
            className="font-mono text-xs leading-relaxed resize-y"
            placeholder='{ "query": "...", "context_chunks": ["..."], "answer": "..." }'
          />
        </div>
      )}

      {/* Submit / Trigger Footer */}
      <div className="flex items-center justify-between pt-2 border-t mt-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="hidden sm:inline">Press</span>
          <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground font-semibold">
            ⌘↵
          </kbd>
          <span className="hidden sm:inline">or</span>
          <kbd className="hidden sm:inline rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground font-semibold">
            Ctrl+↵
          </kbd>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const defaultPreset = PRESETS[0];
              if (defaultPreset) {
                onSelectPreset(defaultPreset);
              }
            }}
            disabled={isLoading}
            className="text-xs h-9"
          >
            <RotateCcw className="size-3.5 mr-1" />
            Reset
          </Button>

          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading || Boolean(jsonError)}
            className="h-9 px-5 text-xs font-semibold gap-2 shadow-xs"
          >
            <Play className={`size-3.5 fill-current ${isLoading ? "animate-spin" : ""}`} />
            {isLoading ? "Evaluating..." : "Run Evaluation Pipeline"}
          </Button>
        </div>
      </div>
    </div>
  );
}

