import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Activity,
  CheckCircle2,
  AlertCircle,
  Moon,
  Sun,
  FileCode2,
  RefreshCw,
  Sparkles,
  Database,
} from "lucide-react";

interface HeaderProps {
  isBackendOnline: boolean;
  isDemoMode: boolean;
  setIsDemoMode: (val: boolean) => void;
  isCheckingHealth: boolean;
  onRefreshHealth: () => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  backendUrl: string;
  isDbConnected?: boolean;
  onOpenDbModal?: () => void;
}

export function Header({
  isBackendOnline,
  isDemoMode,
  setIsDemoMode,
  isCheckingHealth,
  onRefreshHealth,
  theme,
  onToggleTheme,
  backendUrl,
  isDbConnected,
  onOpenDbModal,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur-sm">
      <div className="container mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Left: Brand & Tagline */}
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-mono font-bold text-base shadow-xs">
            ⎈
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-semibold tracking-tight text-foreground text-base">
              RAGOps
            </span>
            <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-mono text-muted-foreground">
              v0.1.0
            </Badge>
          </div>
          <span className="hidden md:inline-block text-xs text-muted-foreground border-l pl-3 ml-1 font-normal">
            Fail-Fast RAG Evaluation & Observability
          </span>
        </div>

        {/* Right: Status, Controls, Theme */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Backend Connection Pill */}
          <div className="flex items-center gap-2 rounded-lg border bg-card/60 px-2.5 py-1 text-xs">
            {isBackendOnline ? (
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                Backend Online
              </span>
            ) : isDemoMode ? (
              <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium">
                <Sparkles className="size-3" />
                Demo Simulator
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="size-2 rounded-full bg-destructive/80" />
                Backend Offline
              </span>
            )}

            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onRefreshHealth}
              disabled={isCheckingHealth}
              className="size-6 rounded-sm p-0 text-muted-foreground hover:text-foreground"
              aria-label="Refresh backend connection"
              title={`Check ${backendUrl}`}
            >
              <RefreshCw className={`size-3 ${isCheckingHealth ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {/* Supabase / DB Connection Pill */}
          {onOpenDbModal && (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenDbModal}
              className="h-8 text-xs font-medium gap-1.5 hidden sm:inline-flex"
              title="Configure Supabase / PostgreSQL Trace Storage"
            >
              <Database className="size-3.5 text-primary" />
              <span>{isDbConnected ? "Supabase Connected" : "Connect Supabase"}</span>
              <span
                className={`size-1.5 rounded-full ${
                  isDbConnected ? "bg-emerald-500" : "bg-amber-500"
                }`}
              />
            </Button>
          )}

          {/* Demo Mode Toggle */}
          <Button
            variant={isDemoMode ? "outline" : "default"}
            size="sm"
            onClick={() => setIsDemoMode(!isDemoMode)}
            className="h-8 text-xs font-medium gap-1.5"
            title="Toggle between real backend API and offline simulator"
          >
            {isDemoMode ? (
              <>
                <Sparkles className="size-3 text-amber-500" />
                <span>Demo Simulator</span>
              </>
            ) : (
              <>
                <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Live API Mode</span>
              </>
            )}
          </Button>

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleTheme}
            className="size-8"
            aria-label="Toggle color theme"
          >
            {theme === "dark" ? (
              <Sun className="size-4 text-amber-400" />
            ) : (
              <Moon className="size-4 text-muted-foreground" />
            )}
          </Button>

          {/* External Links */}
          <a
            href="https://github.com/Pixie2468/rag-ops"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center justify-center size-8 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground"
            aria-label="View on GitHub"
            title="GitHub Repository"
          >
            <svg
              className="size-4 fill-current"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
              />
            </svg>
          </a>
        </div>
      </div>
    </header>
  );
}
