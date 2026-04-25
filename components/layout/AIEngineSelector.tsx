"use client";

import { useEffect, useRef, useState } from "react";

interface ModelEntry {
  id: string;
  name: string;
  provider: "local" | "deepseek";
  model: string;
  hasKey: boolean;
}

interface ConfigResponse {
  activeModelId: string;
  models: ModelEntry[];
  supportsLocalMlx?: boolean;
}

const PROVIDERS = [
  { value: "deepseek", label: "DeepSeek", keyPrefix: "sk-", baseUrl: "api.deepseek.com" },
  { value: "openai",   label: "OpenAI",   keyPrefix: "sk-", baseUrl: "api.openai.com" },
] as const;

type ExternalProvider = typeof PROVIDERS[number]["value"];

const PROVIDER_MODELS: Record<ExternalProvider, { value: string; label: string }[]> = {
  deepseek: [
    { value: "deepseek-chat",     label: "deepseek-chat (V3 · cheapest)" },
    { value: "deepseek-reasoner", label: "deepseek-reasoner (R1 · smarter)" },
  ],
  openai: [
    { value: "gpt-4o-mini", label: "gpt-4o-mini (cheapest)" },
    { value: "gpt-4o",      label: "gpt-4o" },
    { value: "o1-mini",     label: "o1-mini" },
  ],
};

export default function AIEngineSelector() {
  const [data, setData] = useState<ConfigResponse | null>(null);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<{ name: string; provider: ExternalProvider; model: string; apiKey: string }>(
    { name: "", provider: "deepseek", model: "deepseek-chat", apiKey: "" }
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const load = () =>
    fetch("/api/ai-config")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
        setAdding(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const visibleModels = (data?.models ?? []).filter((m) => data?.supportsLocalMlx !== false || m.provider !== "local");
  const activeModel = visibleModels.find((m) => m.id === data?.activeModelId) ?? visibleModels[0];

  const handleSelect = async (id: string) => {
    await fetch("/api/ai-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "select", id }),
    });
    setData((d) => d ? { ...d, activeModelId: id } : d);
  };

  const handleRemove = async (id: string) => {
    await fetch("/api/ai-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove", id }),
    });
    load();
  };

  const handleAdd = async () => {
    if (!form.name || !form.apiKey) return;
    setSaving(true);
    try {
      await fetch("/api/ai-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", ...form }),
      });
      setForm({ name: "", provider: "deepseek", model: "deepseek-chat", apiKey: "" });
      setAdding(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      await load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => { setOpen((o) => !o); setAdding(false); }}
        className="flex items-center gap-1.5 px-2 py-1 hover:bg-white/[0.04] transition-colors rounded"
        title="AI Model"
      >
        <span className="material-symbols-outlined text-[13px] text-slate-400">psychology</span>
        <span className="font-mono text-[10px] font-bold text-slate-300 max-w-[80px] truncate">
          {activeModel?.name ?? "MLX"}
        </span>
        <span className="material-symbols-outlined text-[10px] text-slate-500">expand_more</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-72 bg-[#1a1c1f] border border-white/10 rounded-lg shadow-2xl z-50 overflow-hidden">
          <div className="px-3 pt-3 pb-2 border-b border-white/[0.06]">
            <p className="font-mono text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              AI Model
            </p>
          </div>

          {/* Model list */}
          <div className="py-1">
            {visibleModels.map((m) => {
              const isActive = m.id === data?.activeModelId;
              return (
                <div
                  key={m.id}
                  className={`flex items-center justify-between px-3 py-2 group cursor-pointer transition-colors ${
                    isActive ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
                  }`}
                  onClick={() => handleSelect(m.id)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      isActive ? "bg-emerald-400" : "bg-white/10"
                    }`} />
                    <div className="min-w-0">
                      <p className="font-mono text-[11px] font-bold text-white truncate">{m.name}</p>
                      <p className="font-mono text-[9px] text-slate-500 truncate">{m.model}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {m.provider !== "local" && !m.hasKey && (
                      <span className="font-mono text-[9px] text-yellow-500/70">no key</span>
                    )}
                    {m.id !== "local" && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRemove(m.id); }}
                        className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all"
                      >
                        <span className="material-symbols-outlined text-[13px]">close</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add form */}
          {adding ? (
            <div className="px-3 py-3 border-t border-white/[0.06] space-y-2.5">
              {/* Provider */}
              <div className="flex gap-1.5">
                {PROVIDERS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setForm((f) => ({
                      ...f,
                      provider: p.value,
                      model: PROVIDER_MODELS[p.value][0].value,
                    }))}
                    className={`flex-1 py-1 rounded text-[10px] font-mono font-bold border transition-all ${
                      form.provider === p.value
                        ? "bg-white/10 border-white/20 text-white"
                        : "border-white/5 text-slate-500 hover:text-slate-300 hover:border-white/10"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Display name */}
              <input
                autoFocus
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Display name"
                className="w-full bg-black/40 border border-white/10 rounded px-2.5 py-1.5 font-mono text-[11px] text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/40"
              />

              {/* Model */}
              <select
                value={form.model}
                onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                className="w-full bg-black/40 border border-white/10 rounded px-2.5 py-1.5 font-mono text-[11px] text-white focus:outline-none focus:border-blue-500/40"
              >
                {PROVIDER_MODELS[form.provider].map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>

              {/* API key */}
              <input
                type="password"
                value={form.apiKey}
                onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                placeholder={`${PROVIDERS.find(p => p.value === form.provider)?.label} API key`}
                className="w-full bg-black/40 border border-white/10 rounded px-2.5 py-1.5 font-mono text-[11px] text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/40"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAdd}
                  disabled={saving || !form.name || !form.apiKey}
                  className="flex-1 py-1.5 rounded font-mono text-[11px] font-bold bg-blue-600/30 hover:bg-blue-600/40 text-blue-300 border border-blue-500/30 disabled:opacity-40 transition-colors"
                >
                  {saving ? "Saving…" : saved ? "Saved ✓" : "Save"}
                </button>
                <button
                  onClick={() => setAdding(false)}
                  className="px-3 py-1.5 rounded font-mono text-[11px] text-slate-500 hover:text-slate-300 border border-white/5 hover:border-white/10 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="w-full flex items-center gap-2 px-3 py-2.5 border-t border-white/[0.06] font-mono text-[11px] text-slate-500 hover:text-slate-200 hover:bg-white/[0.03] transition-colors"
            >
              <span className="material-symbols-outlined text-[13px]">add</span>
              Add model
            </button>
          )}
        </div>
      )}
    </div>
  );
}
