import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { configureDbApi } from "@/lib/api";
import type { DbStatusResponse } from "@/types/eval";
import {
  Database,
  CheckCircle2,
  AlertTriangle,
  X,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
} from "lucide-react";

interface DatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  dbStatus: DbStatusResponse | null;
  onStatusChange: (status: DbStatusResponse) => void;
  backendUrl: string;
}

export function DatabaseModal({
  isOpen,
  onClose,
  dbStatus,
  onStatusChange,
  backendUrl,
}: DatabaseModalProps) {
  const [dbUrl, setDbUrl] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [hasCopied, setHasCopied] = useState(false);

  if (!isOpen) return null;

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dbUrl.trim()) {
      setErrorMsg("Please enter a database connection string.");
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await configureDbApi(dbUrl.trim(), backendUrl);
      onStatusChange(res);
      setSuccessMsg("Connected successfully to database! Tables verified.");
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || "Failed to connect to database.");
    } finally {
      setIsSaving(false);
    }
  };

  const copyTemplate = () => {
    navigator.clipboard.writeText(
      "postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"
    );
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="relative w-full max-w-lg rounded-xl border bg-card p-6 shadow-xl animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between pb-3 border-b">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
              <Database className="size-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">
                Supabase / PostgreSQL Setup
              </h3>
              <p className="text-xs text-muted-foreground">
                Configure persistent trace storage & observability
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

        {/* Current status pill */}
        <div className="my-4 rounded-lg border bg-muted/20 p-3 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">Status:</span>
            {dbStatus?.connected ? (
              <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 bg-emerald-500/10 gap-1">
                <CheckCircle2 className="size-3" />
                Connected ({dbStatus.provider})
              </Badge>
            ) : (
              <Badge variant="outline" className="text-amber-500 border-amber-500/30 bg-amber-500/10 gap-1">
                <AlertTriangle className="size-3" />
                In-Memory Buffer (Offline)
              </Badge>
            )}
          </div>
          <span className="text-[11px] text-muted-foreground truncate max-w-[220px]">
            {dbStatus?.message}
          </span>
        </div>

        {/* Supabase Instructions */}
        <div className="mb-4 rounded-lg border border-primary/20 bg-primary/5 p-3.5 text-xs text-foreground space-y-2">
          <div className="flex items-center justify-between font-semibold text-primary">
            <span>How to connect your Supabase project:</span>
            <a
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 hover:underline text-[11px]"
            >
              Supabase Dashboard <ExternalLink className="size-3" />
            </a>
          </div>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-[11px] leading-relaxed">
            <li>Open your Supabase project & go to <strong>Project Settings &gt; Database</strong>.</li>
            <li>Under <strong>Connection string</strong>, copy the <strong>URI</strong> (Node.js/Session or Direct).</li>
            <li>Replace <code>[YOUR-PASSWORD]</code> with your database password and paste below.</li>
          </ol>
          <div className="flex items-center justify-between rounded bg-background/80 px-2 py-1 text-[11px] font-mono border">
            <span className="truncate pr-2 text-muted-foreground">
              postgresql://postgres:[PASS]@db.[REF].supabase.co:5432/postgres
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={copyTemplate}
              className="size-5 p-0"
              title="Copy format"
            >
              {hasCopied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
            </Button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleConnect} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="supabase-url" className="text-xs font-medium">
              Database Connection URL
            </Label>
            <Input
              id="supabase-url"
              type="text"
              placeholder="postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres"
              value={dbUrl}
              onChange={(e) => setDbUrl(e.target.value)}
              className="font-mono text-xs"
            />
            <p className="text-[10px] text-muted-foreground">
              RAGOps automatically verifies connection and provisions <code>projects</code>, <code>traces</code>, and <code>evaluation_scores</code> tables.
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
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSaving} className="gap-1.5">
              {isSaving && <RefreshCw className="size-3 animate-spin" />}
              {isSaving ? "Connecting..." : "Connect Supabase"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

