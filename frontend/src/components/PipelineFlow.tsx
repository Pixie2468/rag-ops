import React from "react";
import { Badge } from "@/components/ui/badge";
import { STAGES } from "@/lib/pipeline-stages";
import type { StageKey, StageState, EvalResponse } from "@/types/eval";
import {
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  ShieldAlert,
  Loader2,
  FastForward,
  Check,
} from "lucide-react";

interface PipelineFlowProps {
  stageStates: Record<StageKey, StageState>;
  response: EvalResponse | null;
  isLoading: boolean;
  activeStageIdx: number;
}

export function PipelineFlow({
  stageStates,
  response,
  isLoading,
  activeStageIdx,
}: PipelineFlowProps) {
  const getVerdictBadge = () => {
    if (isLoading) {
      return (
        <Badge variant="outline" className="text-xs px-2.5 py-1 gap-1.5 animate-pulse">
          <Loader2 className="size-3 animate-spin" />
          Running Pipeline...
        </Badge>
      );
    }

    if (!response) {
      return (
        <Badge variant="outline" className="text-xs px-2.5 py-1 text-muted-foreground">
          Ready for Evaluation
        </Badge>
      );
    }

    const isPass = response.verdict.toLowerCase() === "pass";

    if (isPass) {
      return (
        <Badge variant="success" className="text-xs px-3 py-1 gap-1.5 font-mono">
          <CheckCircle2 className="size-3.5" />
          VERDICT: PASS
        </Badge>
      );
    }

    return (
      <Badge variant="destructive" className="text-xs px-3 py-1 gap-1.5 font-mono">
        <ShieldAlert className="size-3.5" />
        VERDICT: {response.verdict.toUpperCase()}
      </Badge>
    );
  };

  const getStageBadge = (state: StageState) => {
    switch (state) {
      case "passed":
        return (
          <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            <Check className="size-3" />
            Passed
          </span>
        );
      case "failed":
        return (
          <span className="flex items-center gap-1 text-[11px] font-medium text-destructive">
            <XCircle className="size-3" />
            Failed
          </span>
        );
      case "running":
        return (
          <span className="flex items-center gap-1 text-[11px] font-medium text-primary animate-pulse">
            <Loader2 className="size-3 animate-spin" />
            Evaluating
          </span>
        );
      case "skipped":
        return (
          <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground/70">
            <FastForward className="size-3" />
            Skipped
          </span>
        );
      default:
        return (
          <span className="text-[11px] text-muted-foreground">
            Standby
          </span>
        );
    }
  };

  const getStageContainerClass = (state: StageState) => {
    switch (state) {
      case "passed":
        return "border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/15";
      case "failed":
        return "border-destructive/40 bg-destructive/5 dark:bg-destructive/10 ring-1 ring-destructive/20";
      case "running":
        return "border-primary/60 bg-primary/5 ring-2 ring-primary/20";
      case "skipped":
        return "border-border/40 bg-muted/20 opacity-60";
      default:
        return "border-border/60 bg-card";
    }
  };

  return (
    <div className="rounded-xl border bg-card p-4 sm:p-5 shadow-xs">
      {/* Top Bar: Title & Final Verdict */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              Fail-Fast Evaluation Flow
            </h2>
            <span className="text-xs text-muted-foreground">
              (5 Sequential Stage Gates)
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Lightweight deterministic checks short-circuit early before invoking semantic models or LLMs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {getVerdictBadge()}
          {response?.stage_failed && (
            <Badge variant="outline" className="text-xs font-mono text-muted-foreground">
              Gate: {response.stage_failed}
            </Badge>
          )}
        </div>
      </div>

      {/* Stage Flow Grid / Stepper */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 pt-4">
        {STAGES.map((stage, idx) => {
          const state = stageStates[stage.id];

          return (
            <div
              key={stage.id}
              className={`relative flex flex-col justify-between rounded-lg border p-3.5 transition-all ${getStageContainerClass(
                state
              )}`}
            >
              {/* Card Header: Step & Speed */}
              <div className="flex items-center justify-between gap-1 mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="flex size-5 items-center justify-center rounded-full bg-muted font-mono text-[10px] font-bold text-muted-foreground">
                    {stage.stepNumber}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {stage.speed}
                  </span>
                </div>
                {getStageBadge(state)}
              </div>

              {/* Title & Algorithm */}
              <div className="mb-2">
                <div className="text-xs font-semibold text-foreground line-clamp-1">
                  {stage.shortName}
                </div>
                <div className="text-[11px] font-mono text-muted-foreground line-clamp-1">
                  {stage.algorithm}
                </div>
              </div>

              {/* Description */}
              <p className="text-[11px] text-muted-foreground/80 line-clamp-2 leading-relaxed">
                {stage.description}
              </p>
            </div>
          );
        })}
      </div>

      {/* Short-circuit Note when failed */}
      {response?.stage_failed && (
        <div className="mt-3.5 flex items-center gap-2 rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          <FastForward className="size-3.5 text-muted-foreground shrink-0" />
          <span>
            <strong className="text-foreground font-medium">Fail-Fast Gate Triggered:</strong> Pipeline short-circuited at{" "}
            <code className="rounded bg-background px-1 py-0.5 font-mono text-[11px] text-foreground">
              {response.stage_failed}
            </code>
            . Downstream stages were bypassed to eliminate unnecessary model inference latency and cost.
          </span>
        </div>
      )}
    </div>
  );
}

