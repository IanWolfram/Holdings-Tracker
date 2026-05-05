"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { AgentProgress } from "@/lib/agent/service";

type Listener = (state: AgentProgress) => void;

// Singleton shared state — one poll cycle for the entire app
let cachedState: AgentProgress = { status: "idle" };
const listeners = new Set<Listener>();
let intervalId: ReturnType<typeof setInterval> | null = null;
let fetchPromise: Promise<void> | null = null;

async function fetchState() {
  if (fetchPromise) return; // dedupe concurrent calls
  fetchPromise = fetch("/api/agent/run")
    .then(async (res) => {
      if (res.ok) {
        cachedState = await res.json();
        listeners.forEach((fn) => fn(cachedState));
      }
    })
    .catch(() => {})
    .finally(() => {
      fetchPromise = null;
    });
}

function startPolling(ms: number) {
  stopPolling();
  fetchState(); // immediate first fetch
  intervalId = setInterval(fetchState, ms);
}

function stopPolling() {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

function schedule() {
  if (cachedState.status === "running") {
    startPolling(2500);
  } else {
    stopPolling();
  }
}

export function useAgentStatus() {
  const [state, setState] = useState<AgentProgress>(cachedState);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    listeners.add(setState);
    // First listener: hydrate from server so UI reflects current status, then
    // schedule() will pick up polling if the run is already in progress.
    if (listeners.size === 1) {
      fetchState();
    }
    return () => {
      listeners.delete(setState);
      // If no listeners left, stop polling
      if (listeners.size === 0) stopPolling();
    };
  }, []);

  // React to state changes — start/stop polling
  useEffect(() => {
    schedule();
  }, [state.status]);

  const startAgent = useCallback(async () => {
    try {
      // POST returns { message } (202) — not an AgentProgress object — so we
      // optimistically flip to "running" to start the polling loop, then let
      // fetchState() refresh with the real server snapshot.
      const res = await fetch("/api/agent/run", { method: "POST" });
      if (res.ok) {
        cachedState = { status: "running", message: "Agent run started." };
        listeners.forEach((fn) => fn(cachedState));
        await fetchState();
      }
    } catch {}
  }, []);

  const cancelAgent = useCallback(async () => {
    try {
      await fetch("/api/agent/run", { method: "DELETE" });
      await fetchState(); // refresh to get idle state
    } catch {}
  }, []);

  return { state, startAgent, cancelAgent };
}