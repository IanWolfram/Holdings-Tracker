"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useAgentStatus } from "@/hooks/useAgentStatus";
import { authedFetch } from "@/lib/api/client-fetch";
import TopBar from "@/components/layout/TopBar";
import AgentTopBar from "@/components/agent/AgentTopBar";
import EmptyState from "@/components/agent/EmptyState";
import ChatThread from "@/components/agent/ChatThread";
import SignalsList from "@/components/agent/SignalsList";
import Composer from "@/components/agent/Composer";
import HistoryDrawer from "@/components/agent/HistoryDrawer";
import { SCAN_DEFINITIONS, type QuickAction } from "@/components/agent/constants";
import type { ChatMessage, Conversation, OverviewStats, ScanCard, ScanStatus } from "@/components/agent/types";

const STORAGE_KEY = "pulse_chat_conversations";
const ACTIVE_KEY = "pulse_chat_active_id";

function loadLocalConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const convs: Conversation[] = raw ? JSON.parse(raw) : [];
    for (const conv of convs) {
      conv.messages = conv.messages ?? [];
      for (const msg of conv.messages) if (!msg.id) msg.id = crypto.randomUUID();
    }
    return convs;
  } catch {
    return [];
  }
}
function saveLocalConversations(convs: Conversation[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(convs));
  } catch {}
}
function newConversation(): Conversation {
  return { id: crypto.randomUUID(), title: "New chat", messages: [], updatedAt: Date.now() };
}

async function syncConversationToServer(conv: Conversation) {
  try {
    await authedFetch("/api/account/conversations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: conv.id, title: conv.title, messages: conv.messages }),
    });
  } catch {}
}
async function fetchServerConversations(): Promise<Conversation[]> {
  try {
    const res = await authedFetch("/api/account/conversations");
    if (!res.ok) return [];
    const data = await res.json();
    return ((data.conversations ?? []) as Conversation[]).map((c) => ({ ...c, messages: c.messages ?? [] }));
  } catch {
    return [];
  }
}
async function fetchServerConversation(id: string): Promise<Conversation | null> {
  try {
    const res = await authedFetch(`/api/account/conversations?id=${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    const conv = (await res.json()) as Conversation;
    return { ...conv, messages: conv.messages ?? [] };
  } catch {
    return null;
  }
}
function mergeConversations(server: Conversation[], local: Conversation[]): Conversation[] {
  const serverIds = new Set(server.map((c) => c.id));
  const merged = [...server];
  for (const l of local) if (!serverIds.has(l.id)) merged.push(l);
  return merged;
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

interface AgentJobRow {
  kind: string;
  cron_expr: string;
  enabled: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  last_status: string | null;
  last_summary: string | null;
}

function mapJobsToScans(jobs: AgentJobRow[]): ScanCard[] {
  const byKind = new Map(jobs.map((j) => [j.kind, j]));
  return SCAN_DEFINITIONS.map((def) => {
    const row = byKind.get(def.kind);
    const enabled = row?.enabled ?? false;
    const raw = row?.last_status;
    const status: ScanStatus = raw === "ok" || raw === "warn" || raw === "err" ? raw : "queued";
    return {
      kind: def.kind,
      name: def.name,
      cadence: def.cadence,
      coverage: def.coverage,
      enabled,
      next: enabled ? fmtDateTime(row?.next_run_at ?? null) : "—",
      last: {
        at: row?.last_run_at ? fmtDateTime(row.last_run_at) : "never",
        status,
        note: row?.last_summary ?? def.defaultNote,
      },
    };
  });
}

export default function AgentDashboard() {
  const { state: agentState, startAgent, cancelAgent } = useAgentStatus();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [synced, setSynced] = useState(false);
  const [loadedConvIds, setLoadedConvIds] = useState<Set<string>>(new Set());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [scans, setScans] = useState<ScanCard[]>(() => mapJobsToScans([]));
  const [userEmail, setUserEmail] = useState<string | undefined>(undefined);

  // ---- Initial conversation sync (server + localStorage) ----
  useEffect(() => {
    if (synced) return;
    (async () => {
      const [serverList, localList] = await Promise.all([fetchServerConversations(), Promise.resolve(loadLocalConversations())]);
      const merged = mergeConversations(serverList, localList);
      saveLocalConversations(merged);
      setConversations(merged);
      // A `?conv=<id>` param (e.g. from clicking the TopBar signal bubble) takes
      // precedence over the last-active conversation.
      const convParam = new URLSearchParams(window.location.search).get("conv");
      const lastActiveId = localStorage.getItem(ACTIVE_KEY) ?? "";
      const target =
        (convParam && merged.find((c) => c.id === convParam)) ||
        merged.find((c) => c.id === lastActiveId) ||
        merged[0];
      setActiveId(target?.id ?? "");
      setSynced(true);
    })();
  }, [synced]);

  // ---- Lazy-load messages when switching conversations ----
  useEffect(() => {
    if (!activeId || !synced || loadedConvIds.has(activeId)) return;
    const conv = conversations.find((c) => c.id === activeId);
    if (!conv) return;
    if (conv.messages.length > 0) {
      setLoadedConvIds((prev) => new Set(prev).add(activeId));
      return;
    }
    fetchServerConversation(activeId).then((serverConv) => {
      if (serverConv && serverConv.messages.length > 0) {
        setConversations((prev) => prev.map((c) => (c.id === activeId ? { ...c, messages: serverConv.messages } : c)));
      }
      setLoadedConvIds((prev) => new Set(prev).add(activeId));
    });
  }, [activeId, synced, conversations, loadedConvIds]);

  useEffect(() => {
    if (activeId) localStorage.setItem(ACTIVE_KEY, activeId);
  }, [activeId]);
  useEffect(() => {
    if (conversations.length > 0) saveLocalConversations(conversations);
  }, [conversations]);

  // ---- Sync active conversation to server on change ----
  useEffect(() => {
    if (!synced) return;
    const active = conversations.find((c) => c.id === activeId);
    // The signals conversation is system-managed + read-only; syncing it back
    // would bump updated_at on every open and reset its pinned timestamp.
    if (active && active.kind !== "signals") syncConversationToServer(active);
  }, [conversations, synced, activeId]);

  // ---- Load overview stats + scheduled jobs (refreshable) ----
  const refreshOverview = useCallback(() => {
    authedFetch("/api/agent/overview")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setStats(d))
      .catch(() => {});
    authedFetch("/api/agent/jobs")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setScans(mapJobsToScans(d.jobs ?? [])))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshOverview();
    authedFetch("/api/account/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.account?.email && setUserEmail(d.account.email))
      .catch(() => {});
  }, [refreshOverview]);

  const activeConv = conversations.find((c) => c.id === activeId);
  const messages = activeConv?.messages ?? [];
  const hasMessages = messages.length > 0;
  const isSignals = activeConv?.kind === "signals";

  const ensureConversation = useCallback(async (): Promise<string> => {
    if (activeId && conversations.some((c) => c.id === activeId)) return activeId;
    let conv = newConversation();
    try {
      const res = await authedFetch("/api/account/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: conv.title }),
      });
      if (res.ok) {
        const data = await res.json();
        conv = { id: data.id, title: data.title, messages: [], updatedAt: data.updatedAt };
      }
    } catch {}
    setConversations((prev) => [conv, ...prev]);
    setActiveId(conv.id);
    setLoadedConvIds((prev) => new Set(prev).add(conv.id));
    return conv.id;
  }, [activeId, conversations]);

  const submitText = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;
      const convId = await ensureConversation();

      const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: trimmed };
      let history: { role: string; content: string }[] = [];
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== convId) return c;
          history = c.messages.slice(-10).map((m) => ({ role: m.role, content: m.content }));
          return {
            ...c,
            messages: [...c.messages, userMsg],
            title: c.messages.length === 0 ? trimmed.slice(0, 50) : c.title,
            updatedAt: Date.now(),
          };
        }),
      );
      setLoading(true);
      setPending(true);

      try {
        const res = await authedFetch("/api/agent/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: trimmed, history }),
        });
        const data = await res.json();
        const reply: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: res.ok ? data.reply : data.error ?? "Error getting response.",
        };
        setConversations((prev) => prev.map((c) => (c.id === convId ? { ...c, messages: [...c.messages, reply], updatedAt: Date.now() } : c)));
      } catch {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === convId
              ? { ...c, messages: [...c.messages, { id: crypto.randomUUID(), role: "assistant" as const, content: "Failed to reach the AI engine." }], updatedAt: Date.now() }
              : c,
          ),
        );
      } finally {
        setLoading(false);
        setPending(false);
      }
    },
    [loading, ensureConversation],
  );

  const startNewChat = useCallback(async () => {
    setActiveId("");
    setDrawerOpen(false);
  }, []);

  const switchConversation = useCallback((id: string) => {
    setActiveId(id);
    setDrawerOpen(false);
  }, []);

  const deleteConversation = useCallback(
    (id: string) => {
      authedFetch(`/api/account/conversations?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
      setConversations((prev) => {
        const next = prev.filter((c) => c.id !== id);
        if (id === activeId) setTimeout(() => setActiveId(next[0]?.id ?? ""), 0);
        return next;
      });
      setLoadedConvIds((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
    },
    [activeId],
  );

  const onPillClick = useCallback(() => {
    if (agentState.status === "running") cancelAgent();
    else startAgent();
  }, [agentState.status, startAgent, cancelAgent]);

  const handleScanToggle = useCallback(
    async (kind: string, enabled: boolean) => {
      // Optimistic flip; the PATCH endpoint computes next_run_at.
      setScans((prev) => prev.map((s) => (s.kind === kind ? { ...s, enabled } : s)));
      try {
        await authedFetch("/api/agent/jobs", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind, enabled }),
        });
      } catch {
        // ignore — refresh reconciles
      }
      refreshOverview();
    },
    [refreshOverview],
  );

  const onQuickAction = useCallback(
    (action: QuickAction) => {
      // "Run risk scan" kicks off the real portfolio analysis sweep (the pill
      // reflects progress); the others open a chat thread with a tailored prompt.
      if (action.id === "risk" && agentState.status !== "running") {
        startAgent();
        return;
      }
      submitText(action.prompt);
    },
    [submitText, startAgent, agentState.status],
  );

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", position: "relative", background: "var(--surface-body, #1a1b1d)" }}>
      <TopBar lastUpdated={null} refreshing={false} onRefresh={refreshOverview} />
      <AgentTopBar onHamburger={() => setDrawerOpen(true)} agentState={agentState} onPillClick={onPillClick} brandHref="/" />

      <main style={{ flex: 1, overflow: "auto", position: "relative" }}>
        {isSignals ? (
          <SignalsList messages={messages} />
        ) : hasMessages ? (
          <ChatThread messages={messages} pending={pending} />
        ) : (
          <EmptyState onPick={submitText} onQuickAction={onQuickAction} stats={stats} scans={scans} onScanToggle={handleScanToggle} />
        )}
      </main>

      {!isSignals && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            padding: "40px 0 28px",
            background: "linear-gradient(to top, rgba(26,27,29,0.97) 30%, rgba(26,27,29,0.7) 70%, transparent 100%)",
            pointerEvents: "none",
          }}
        >
          <div style={{ pointerEvents: "auto" }}>
            <Composer onSubmit={submitText} disabled={loading} />
          </div>
        </div>
      )}

      <HistoryDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        conversations={conversations}
        activeId={activeId}
        onPick={switchConversation}
        onNew={startNewChat}
        onDelete={deleteConversation}
        userEmail={userEmail}
      />
    </div>
  );
}
