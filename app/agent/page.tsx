"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import TopBar from "@/components/layout/TopBar";
import { useAgentStatus } from "@/hooks/useAgentStatus";
import { authedFetch } from "@/lib/api/client-fetch";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
}

const STORAGE_KEY = "pulse_chat_conversations";
const ACTIVE_KEY = "pulse_chat_active_id";

function loadLocalConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const convs: Conversation[] = raw ? JSON.parse(raw) : [];
    for (const conv of convs) {
      for (const msg of conv.messages) {
        if (!msg.id) msg.id = crypto.randomUUID();
      }
    }
    return convs;
  } catch { return []; }
}

function saveLocalConversations(convs: Conversation[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(convs)); } catch {}
}

function newConversation(): Conversation {
  return { id: crypto.randomUUID(), title: "New chat", messages: [], updatedAt: Date.now() };
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

/** Fire-and-forget sync a single conversation's messages to server. */
async function syncConversationToServer(conv: Conversation) {
  try {
    // Ensure conversation exists on server
    await authedFetch("/api/account/conversations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: conv.id,
        title: conv.title,
        messages: conv.messages,
      }),
    });
  } catch { /* best effort */ }
}

async function fetchServerConversations(): Promise<Conversation[]> {
  try {
    const res = await authedFetch("/api/account/conversations");
    if (!res.ok) return [];
    const data = await res.json();
    return (data.conversations ?? []) as Conversation[];
  } catch { return []; }
}

async function fetchServerConversation(id: string): Promise<Conversation | null> {
  try {
    const res = await authedFetch(`/api/account/conversations?id=${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

/** Merge server list + local list: server is authoritative, local-only entries are kept. */
function mergeConversations(
  server: Conversation[],
  local: Conversation[],
): Conversation[] {
  const serverIds = new Set(server.map((c) => c.id));
  const merged = [...server];
  for (const l of local) {
    if (!serverIds.has(l.id)) merged.push(l);
  }
  return merged;
}

export default function AgentDashboard() {
  const { state: agentState } = useAgentStatus();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [popupOpen, setPopupOpen] = useState(false);
  const [agentExpanded, setAgentExpanded] = useState(false);
  const [pendingMessage, setPendingMessage] = useState(false);
  const [synced, setSynced] = useState(false);
  const [loadedConvIds, setLoadedConvIds] = useState<Set<string>>(new Set());
  const streamRef = useRef<HTMLPreElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // On mount: load list from server + merge localStorage, then fetch messages for active conv
  useEffect(() => {
    if (synced) return;
    (async () => {
      const [serverList, localList] = await Promise.all([
        fetchServerConversations(),
        Promise.resolve(loadLocalConversations()),
      ]);
      const merged = mergeConversations(serverList, localList);
      saveLocalConversations(merged);
      setConversations(merged);

      const lastActiveId = localStorage.getItem(ACTIVE_KEY) ?? "";
      const match = merged.find((c) => c.id === lastActiveId);
      const initialId = match ? match.id : merged[0]?.id ?? "";
      setActiveId(initialId);
      setSynced(true);
    })();
  }, [synced]);

  // When switching conversations, lazy-load messages from server on first visit
  useEffect(() => {
    if (!activeId || !synced) return;
    if (loadedConvIds.has(activeId)) return;

    const conv = conversations.find((c) => c.id === activeId);
    if (!conv) return;

    // Only fetch from server if this conv has no messages locally (likely not loaded yet)
    if (conv.messages.length > 0) {
      setLoadedConvIds((prev) => new Set(prev).add(activeId));
      return;
    }

    fetchServerConversation(activeId).then((serverConv) => {
      if (serverConv && serverConv.messages.length > 0) {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeId ? { ...c, messages: serverConv.messages } : c,
          ),
        );
        saveLocalConversations(
          conversations.map((c) =>
            c.id === activeId ? { ...c, messages: serverConv.messages } : c,
          ),
        );
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

  // Close popup on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setPopupOpen(false);
      }
    };
    if (popupOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [popupOpen]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversations, activeId, pendingMessage]);

  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight;
    }
  }, [agentState.streamText]);

  const activeConv = conversations.find((c) => c.id === activeId);
  const messages = activeConv?.messages ?? [];
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const updateActiveConv = useCallback(
    (updater: (c: Conversation) => Conversation) => {
      setConversations((prev) =>
        prev.map((c) => (c.id === activeId ? updater(c) : c)),
      );
    },
    [activeId],
  );

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading || !activeId) return;

    const history = messagesRef.current
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }));
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };

    const updatedConv: Conversation | null = null;
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeId
          ? {
              ...c,
              messages: [...c.messages, userMsg],
              title: c.messages.length === 0 ? text.slice(0, 50) : c.title,
              updatedAt: Date.now(),
            }
          : c,
      ),
    );
    setInput("");
    setLoading(true);
    setPendingMessage(true);

    try {
      const res = await authedFetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });
      const data = await res.json();
      const reply: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: res.ok ? data.reply : (data.error ?? "Error getting response."),
      };
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeId
            ? { ...c, messages: [...c.messages, reply], updatedAt: Date.now() }
            : c,
        ),
      );
    } catch {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeId
            ? {
                ...c,
                messages: [
                  ...c.messages,
                  {
                    id: crypto.randomUUID(),
                    role: "assistant" as const,
                    content: "Failed to reach the AI engine.",
                  },
                ],
                updatedAt: Date.now(),
              }
            : c,
        ),
      );
    } finally {
      setLoading(false);
      setPendingMessage(false);
      inputRef.current?.focus();
    }
  }, [input, loading, activeId]);

  // Sync to server whenever conversations change (after initial load)
  useEffect(() => {
    if (!synced) return;
    const active = conversations.find((c) => c.id === activeId);
    if (active) syncConversationToServer(active);
  }, [conversations, synced, activeId]);

  const startNewChat = async () => {
    // Create on server first
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
    } catch { /* use local fallback */ }

    setConversations((prev) => [conv, ...prev]);
    setActiveId(conv.id);
    setLoadedConvIds((prev) => new Set(prev).add(conv.id));
    setInput("");
    setPopupOpen(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const switchConversation = (id: string) => {
    setActiveId(id);
    setPopupOpen(false);
  };

  const deleteConversation = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    // Delete from server (fire-and-forget)
    authedFetch(`/api/account/conversations?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    }).catch(() => {});

    setConversations((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (next.length === 0) {
        const fresh = newConversation();
        setTimeout(() => setActiveId(fresh.id), 0);
        return [fresh];
      }
      if (id === activeId) setTimeout(() => setActiveId(next[0].id), 0);
      return next;
    });
    setLoadedConvIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const sortedConvs = [...conversations].sort(
    (a, b) => b.updatedAt - a.updatedAt,
  );

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <TopBar lastUpdated={new Date()} refreshing={false} onRefresh={() => {}} />

      {/* Full-width agent status bar */}
      <div className="w-full border-b border-white/[0.07] bg-[#0e0f11]">
        {/* Clickable row */}
        <div
          className="flex items-center justify-between px-6 py-2 cursor-pointer hover:bg-white/[0.02] transition-colors select-none"
          onClick={() => setAgentExpanded((o) => !o)}
        >
          <div className="flex items-center gap-3 min-w-0">
            {/* Hamburger + popup */}
            <div className="relative" ref={popupRef}>
              <button
                onClick={() => setPopupOpen((o) => !o)}
                className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 transition-colors flex-shrink-0"
              >
                <span className="material-symbols-outlined text-[18px] text-slate-400">
                  menu
                </span>
              </button>

              {popupOpen && (
                <div className="absolute top-full left-0 mt-2 w-72 bg-[#131417] border border-white/[0.1] rounded-xl shadow-2xl z-50 overflow-hidden">
                  <button
                    onClick={startNewChat}
                    className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-white/[0.06] transition-colors border-b border-white/[0.07]"
                  >
                    <span className="material-symbols-outlined text-[15px] text-slate-400">
                      add
                    </span>
                    <span className="font-mono text-[12px] text-slate-300">
                      New conversation
                    </span>
                  </button>
                  <div
                    className="max-h-72 overflow-y-auto"
                    style={{
                      scrollbarWidth: "thin",
                      scrollbarColor: "rgba(255,255,255,0.08) transparent",
                    }}
                  >
                    {sortedConvs.map((conv) => (
                      <div
                        key={conv.id}
                        onClick={() => switchConversation(conv.id)}
                        className={`group flex items-center gap-2 px-4 py-2.5 cursor-pointer hover:bg-white/[0.05] transition-colors ${conv.id === activeId ? "bg-white/[0.07]" : ""}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p
                            className={`font-mono text-[12px] truncate ${conv.id === activeId ? "text-white" : "text-slate-400"}`}
                          >
                            {conv.title}
                          </p>
                          <p className="font-mono text-[10px] text-slate-600">
                            {formatRelativeTime(conv.updatedAt)}
                          </p>
                        </div>
                        <button
                          onClick={(e) => deleteConversation(e, conv.id)}
                          className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 transition-all flex-shrink-0"
                        >
                          <span className="material-symbols-outlined text-[12px] text-slate-500">
                            close
                          </span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <span
              className={`material-symbols-outlined text-[15px] flex-shrink-0 ${agentState.status === "running" ? "text-positive animate-pulse" : "text-slate-600"}`}
            >
              neurology
            </span>
            <span className="font-mono text-[11px] text-slate-500 uppercase tracking-widest">
              Background agent
            </span>
            {agentState.status === "running" && agentState.ticker && (
              <>
                <span className="text-slate-600 text-[11px]">·</span>
                <span className="font-mono text-[11px] text-slate-400 truncate">
                  {agentState.ticker} —{" "}
                  {agentState.currentHeadline?.slice(0, 80) ??
                    agentState.message}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <span
              className={`font-mono text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                agentState.status === "running"
                  ? "bg-positive/20 text-positive border border-positive/30"
                  : agentState.status === "complete"
                    ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                    : "bg-white/5 text-slate-600 border border-white/5"
              }`}
            >
              {agentState.status}
            </span>
            {/* Chevron */}
            <span
              className={`material-symbols-outlined text-[15px] text-slate-600 transition-transform duration-200 ${agentExpanded ? "rotate-180" : ""}`}
            >
              expand_more
            </span>
          </div>
        </div>
        {/* end clickable row */}

        {/* Expandable stream panel */}
        <div
          className={`overflow-hidden transition-all duration-200 ${agentExpanded ? "max-h-40" : "max-h-0"}`}
        >
          <pre
            ref={streamRef}
            className="px-6 py-3 font-mono text-[11px] leading-relaxed text-slate-400 whitespace-pre-wrap break-words overflow-y-auto border-t border-white/[0.05] bg-black/20"
            style={{
              maxHeight: "10rem",
              scrollbarWidth: "thin",
              scrollbarColor: "rgba(255,255,255,0.08) transparent",
            }}
          >
            {agentState.streamText
              ? agentState.streamText
              : agentState.status === "idle"
                ? "Agent is idle — no active analysis."
                : agentState.message ?? "Waiting..."}
            {agentState.status === "running" && (
              <span className="inline-block w-2 h-3 bg-white/50 ml-1 animate-pulse align-middle" />
            )}
          </pre>
        </div>
      </div>

      {/* Chat area */}
      <main
        className="flex-1 flex flex-col items-center overflow-hidden px-6 pt-5 pb-5"
        style={{ height: "calc(100vh - 112px)" }}
      >
        <div className="w-full max-w-4xl flex flex-col h-full">
          {/* Messages */}
          <div
            className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1"
            style={{
              scrollbarWidth: "thin",
              scrollbarColor: "rgba(255,255,255,0.08) transparent",
            }}
          >
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-3 opacity-30 select-none">
                <span className="material-symbols-outlined text-[40px] text-slate-500">
                  chat
                </span>
                <p className="font-mono text-sm text-slate-400 text-center max-w-xs">
                  Ask anything about your holdings, market conditions, or specific
                  stocks.
                </p>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="w-6 h-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 mr-2 mt-0.5">
                    <span className="material-symbols-outlined text-[13px] text-slate-400">
                      neurology
                    </span>
                  </div>
                )}
                <div
                  className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed font-mono ${
                    msg.role === "user"
                      ? "bg-white/[0.08] text-white rounded-tr-sm"
                      : "bg-[#131417] border border-white/[0.08] text-slate-200 rounded-tl-sm"
                  }`}
                >
                  <span className="whitespace-pre-wrap">{msg.content}</span>
                </div>
              </div>
            ))}

            {pendingMessage && (
              <div className="flex justify-start">
                <div className="w-6 h-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 mr-2 mt-0.5">
                  <span className="material-symbols-outlined text-[13px] text-slate-400">
                    neurology
                  </span>
                </div>
                <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-[#131417] border border-white/[0.08]">
                  <span className="flex items-center gap-1.5">
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce"
                      style={{ animationDelay: "0ms" }}
                    />
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce"
                      style={{ animationDelay: "150ms" }}
                    />
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce"
                      style={{ animationDelay: "300ms" }}
                    />
                  </span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="mt-4 flex items-end gap-2 bg-[#131417] border border-white/10 rounded-xl px-4 py-3 focus-within:border-white/20 transition-colors flex-shrink-0">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about a stock, sector, or your portfolio…"
              rows={1}
              disabled={loading}
              className="flex-1 bg-transparent resize-none outline-none font-mono text-sm text-white placeholder-slate-600 leading-relaxed max-h-32 overflow-y-auto"
              style={{ scrollbarWidth: "none" }}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-20 bg-white/10 hover:bg-white/20 active:scale-95"
            >
              <span className="material-symbols-outlined text-[18px] text-white">
                arrow_upward
              </span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}