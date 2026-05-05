"use client";

import { useAgentStatus } from "@/hooks/useAgentStatus";

export default function AgentTrigger() {
  const { state, startAgent, cancelAgent } = useAgentStatus();

  const isRunning = state.status === "running";
  const isMock = state.isMock === true;
  const isDisabled = isMock;

  const toggleRun = () => {
    if (isRunning) {
      cancelAgent();
    } else {
      startAgent();
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* Spinner — only mounts when running so it doesn't push the button when idle */}
      {isRunning && (
        <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
          <svg
            className="animate-spin text-slate-500"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle
              cx="8" cy="8" r="6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeDasharray="28"
              strokeDashoffset="10"
              opacity="0.3"
            />
            <path
              d="M8 2a6 6 0 0 1 6 6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
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

        {/* Pulsing indicator when idle */}
        {!isRunning && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-positive rounded-full animate-pulse blur-[1px] opacity-50" />
        )}
      </button>
    </div>
  );
}