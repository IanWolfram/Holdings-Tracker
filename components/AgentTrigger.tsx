"use client";

import { useState, useEffect } from "react";
import type { AgentProgress } from "@/lib/agent/service";

export default function AgentTrigger() {
  const [progress, setProgress] = useState<AgentProgress>({ status: "idle" });
  const [polling, setPolling] = useState(false);

  const fetchProgress = async () => {
    try {
      const res = await fetch("/api/agent/run");
      if (res.ok) {
        const data = await res.json();
        setProgress(data);
        if (data.status === "running") {
          setPolling(true);
        } else {
          setPolling(false);
        }
      }
    } catch (err) {
      console.error("Failed to fetch agent progress:", err);
    }
  };

  useEffect(() => {
    fetchProgress();
  }, []);

  useEffect(() => {
    if (polling) {
      const id = setInterval(fetchProgress, 2000);
      return () => clearInterval(id);
    }
  }, [polling]);

  const toggleRun = async () => {
    if (progress.status === "running") {
      try {
        await fetch("/api/agent/run", { method: "DELETE" });
        setPolling(true); // force one more poll to get idle state
      } catch (err) {
        console.error("Failed to cancel agent:", err);
      }
      return;
    }
    try {
      const res = await fetch("/api/agent/run", { method: "POST" });
      if (res.ok) {
        setPolling(true);
      }
    } catch (err) {
      console.error("Failed to start agent:", err);
    }
  };

  const isRunning = progress.status === "running";
  const isMock = progress.isMock === true;
  const isDisabled = isMock;

  return (
    <div className="flex items-center gap-3">
      {isRunning && (
        <div className="flex flex-col items-end gap-1 mr-2 animate-in fade-in slide-in-from-right-2 duration-300">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
              {progress.ticker ? `Analysing ${progress.ticker}` : "Preparing Hunt..."}
            </span>
            {progress.articleIndex && (
              <span className="font-mono text-[9px] text-slate-500 bg-white/5 px-1 rounded">
                {progress.articleIndex}/{progress.totalArticles}
              </span>
            )}
          </div>
          <p className="text-[8px] text-slate-600 truncate max-w-[150px] italic">
            {progress.message}
          </p>
        </div>
      )}

      <button
        onClick={toggleRun}
        disabled={isDisabled}
        className={`group relative flex items-center justify-center p-2 rounded-md transition-all duration-300 ${
          isDisabled 
            ? "bg-white/5 border border-white/10 cursor-not-allowed opacity-50" 
            : isRunning
            ? "bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/40 text-red-500"
            : "bg-positive/10 border border-positive/20 hover:bg-positive/20 hover:border-positive/40 text-positive"
        }`}
        title={
          isMock 
            ? "Stock Agent disabled in Mock Mode" 
            : isRunning 
              ? "Cancel Agent Run" 
              : "Start Stock Agent Deep Intelligence Sweep"
        }
      >
        <span className={`material-symbols-outlined text-[18px] ${isRunning ? "animate-pulse" : "group-hover:scale-110"}`}>
          {isRunning ? "stop_circle" : "neurology"}
        </span>
        
        {/* Pulsing indicator when idle to suggest it's a high-conviction tool */}
        {!isRunning && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-positive rounded-full animate-pulse blur-[1px] opacity-50" />
        )}
      </button>
    </div>
  );
}
