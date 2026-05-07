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
    </button>
  );
}