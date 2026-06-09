"use client";

import { useAgentStatus } from "@/hooks/useAgentStatus";

export default function AgentTrigger() {
  const { state, startAgent, cancelAgent } = useAgentStatus();

  const isRunning = state.status === "running";

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
      className={`group relative flex items-center justify-center pr-2 self-stretch w-13 bg-black transition-all duration-200 ${
        isRunning
          ? "text-red-500 hover:bg-red-950/40"
          : "text-positive hover:bg-[#050505] hover:shadow-[inset_0_0_16px_-6px_rgba(0,255,136,0.5)]"
      }`}
      title={
        isRunning
          ? "Cancel Agent Run"
          : "Start Stock Agent Deep Intelligence Sweep"
      }
      aria-label="Run agent sweep"
    >
      <span
        className={`material-symbols-outlined text-[18px] transition-transform ${
          isRunning ? "animate-pulse" : "group-hover:scale-110"
        }`}
      >
        {isRunning ? "stop_circle" : "neurology"}
      </span>
    </button>
  );
}