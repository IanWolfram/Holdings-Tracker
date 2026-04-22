"use client";

import { useEffect, useRef, useState } from "react";
import TopBar from "@/components/TopBar";
import type { AgentProgress } from "@/lib/agent/service";

const AGENT_POLL_MS = 1000; // Fast polling for the agent streaming screen

export default function AgentDashboard() {
  const [agentState, setAgentState] = useState<AgentProgress>({ status: "idle" });
  const [refreshing, setRefreshing] = useState(false);
  const scrollRef = useRef<HTMLPreElement>(null);
  const scrollAtBottomRef = useRef(true);

  const fetchAgentState = async () => {
    try {
      const res = await fetch("/api/agent/run");
      if (res.ok) {
        const data = await res.json();
        setAgentState(data);
      }
    } catch {}
  };

  useEffect(() => {
    fetchAgentState();
    const interval = setInterval(fetchAgentState, AGENT_POLL_MS);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll logic to stay tied to bottom unless the user scrolled up
  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      scrollAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 50;
    }
  };

  useEffect(() => {
    if (scrollRef.current && scrollAtBottomRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [agentState.streamText]);

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <TopBar 
        lastUpdated={new Date()} 
        refreshing={refreshing} 
        onRefresh={() => {
          setRefreshing(true);
          setTimeout(() => setRefreshing(false), 500);
        }} 
      />
      <main className="flex-1 p-6 flex flex-col items-center">
        <div className="w-full max-w-5xl bg-[#131417] border border-white/10 rounded-xl overflow-hidden shadow-2xl flex flex-col" style={{ height: "calc(100vh - 120px)" }}>
          
          {/* Header Bar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <span className={`material-symbols-outlined text-[18px] ${agentState.status === "running" ? "text-positive animate-pulse" : "text-slate-500"}`}>neurology</span>
              <h2 className="font-mono text-sm font-bold text-white tracking-widest uppercase">
                Pulse Intelligence Core
              </h2>
            </div>
            
            <div className="flex items-center gap-4">
              <span className={`font-mono text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                agentState.status === "running" ? "bg-positive/20 text-positive border border-positive/30" : 
                agentState.status === "complete" ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" : 
                "bg-white/10 text-slate-400 border border-white/10"
              }`}>
                {agentState.status}
              </span>
            </div>
          </div>

          {/* Context Strip */}
          {agentState.status === "running" && agentState.ticker && (
            <div className="px-5 py-3 border-b border-white/5 bg-slate-900/50 flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-slate-400 uppercase tracking-wider">Target:</span>
                <span className="font-mono text-sm font-black text-white">{agentState.ticker}</span>
                <span className="font-mono text-xs text-slate-500 mx-2">•</span>
                <span className="font-mono text-xs text-slate-400 uppercase tracking-wider">Headline:</span>
                <span className="font-mono text-xs text-slate-300 truncate max-w-[400px]" title={agentState.currentHeadline}>
                  {agentState.currentHeadline}
                </span>
                <span className="font-mono text-xs text-slate-500 mx-2">•</span>
                <span className="font-mono text-xs text-slate-400">
                  [{agentState.articleIndex} / {agentState.totalArticles}]
                </span>
              </div>
              <div className="font-mono text-[11px] text-positive/80 mt-1">
                &gt; {agentState.message}
              </div>
            </div>
          )}

          {/* Streaming Canvas */}
          <div className="flex-1 min-h-0 bg-[#0c0d0e] relative">
            {agentState.status === "idle" && !agentState.streamText ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center opacity-30">
                <span className="material-symbols-outlined text-[48px] text-slate-500 mb-4">memory</span>
                <p className="font-mono text-sm text-center max-w-sm text-slate-400">
                  Agent is idle pending intelligence queue. Open the terminal and trigger the Agent block to observe cognition streams.
                </p>
              </div>
            ) : (
              <pre
                ref={scrollRef}
                onScroll={handleScroll}
                className="w-full h-full p-6 overflow-y-auto font-mono text-[13px] leading-relaxed text-slate-300 break-words whitespace-pre-wrap select-text scroll-smooth"
                style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.1) transparent" }}
              >
                {agentState.streamText || "< Waiting for neural sync... >"}
                {agentState.status === "running" && <span className="inline-block w-2.5 h-3.5 bg-white/70 ml-1 animate-pulse align-middle" />}
              </pre>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
