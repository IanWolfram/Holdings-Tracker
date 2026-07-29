"use client";

import { useEffect, useState, useCallback } from "react";
import { authedFetch } from "@/lib/api/client-fetch";
import { ACCENT } from "./types";
import type { WatchRule, WatchRuleType } from "@/lib/agent/scheduler";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.24em",
        textTransform: "uppercase",
        color: "var(--ink-dim)",
        marginBottom: 16,
      }}
    >
      <span style={{ display: "flex", alignItems: "center" }}>{children}</span>
      <span style={{ flex: 1, height: 1, background: "var(--rule)" }} />
    </div>
  );
}

interface Watch {
  id: string;
  symbol: string;
  rule: WatchRule;
  enabled: boolean;
  cooldown_minutes: number;
  last_triggered_at: string | null;
  created_at: string;
}

function describeRule(rule: WatchRule): string {
  if (rule.type === "price_above") return `Price ≥ $${rule.value}`;
  if (rule.type === "price_below") return `Price ≤ $${rule.value}`;
  return "Sentiment flips";
}

const inputStyle: React.CSSProperties = {
  background: "rgba(0,0,0,0.3)",
  border: "1px solid var(--rule)",
  borderRadius: 6,
  padding: "7px 9px",
  color: "white",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  outline: "none",
};

export default function WatchesManager() {
  const [watches, setWatches] = useState<Watch[]>([]);
  const [loading, setLoading] = useState(true);
  const [symbol, setSymbol] = useState("");
  const [ruleType, setRuleType] = useState<WatchRuleType>("price_above");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await authedFetch("/api/agent/watches");
      const data = await res.json();
      if (res.ok) setWatches(data.watches ?? []);
    } catch {
      // best-effort; the list just stays as-is
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addWatch() {
    setError(null);
    const sym = symbol.trim().toUpperCase();
    if (!sym) return setError("Enter a ticker.");
    const rule: WatchRule =
      ruleType === "verdict_flip"
        ? { type: "verdict_flip" }
        : { type: ruleType, value: Number(value) };
    if (ruleType !== "verdict_flip" && (!value || Number(value) <= 0)) {
      return setError("Enter a positive price.");
    }

    setSaving(true);
    try {
      const res = await authedFetch("/api/agent/watches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: sym, rule }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to add alert.");
      setWatches((w) => [data.watch, ...w]);
      setSymbol("");
      setValue("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function removeWatch(id: string) {
    setWatches((w) => w.filter((x) => x.id !== id));
    try {
      await authedFetch(`/api/agent/watches?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    } catch {
      load(); // resync on failure
    }
  }

  return (
    <section style={{ paddingTop: 44 }}>
      <SectionLabel>
        Price alerts
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            color: "var(--ink-dimmer)",
            fontWeight: 500,
            letterSpacing: "0.18em",
            marginLeft: 12,
          }}
        >
          {watches.length} ACTIVE · NOTIFIES ON TRIGGER
        </span>
      </SectionLabel>

      {/* Create form */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 14 }}>
        <input
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          placeholder="TICKER"
          maxLength={10}
          style={{ ...inputStyle, width: 100, textTransform: "uppercase" }}
        />
        <select
          value={ruleType}
          onChange={(e) => setRuleType(e.target.value as WatchRuleType)}
          style={{ ...inputStyle, cursor: "pointer" }}
        >
          <option value="price_above">Price rises above</option>
          <option value="price_below">Price falls below</option>
          <option value="verdict_flip">Sentiment flips</option>
        </select>
        {ruleType !== "verdict_flip" && (
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="$ price"
            inputMode="decimal"
            style={{ ...inputStyle, width: 90 }}
          />
        )}
        <button
          onClick={addWatch}
          disabled={saving}
          style={{
            background: `${ACCENT}22`,
            border: `1px solid ${ACCENT}88`,
            borderRadius: 6,
            padding: "7px 14px",
            color: ACCENT,
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.1em",
            cursor: saving ? "default" : "pointer",
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? "ADDING…" : "+ ADD"}
        </button>
        {error && <span style={{ color: "var(--negative)", fontSize: 11 }}>{error}</span>}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ color: "var(--ink-dim)", fontSize: 12 }}>Loading…</div>
      ) : watches.length === 0 ? (
        <div style={{ color: "var(--ink-dimmer)", fontSize: 12 }}>
          No alerts yet. Add one above — you&apos;ll get a notification when it triggers.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {watches.map((w) => (
            <div
              key={w.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "rgba(255,255,255,0.015)",
                border: "1px solid var(--rule)",
                borderRadius: 8,
                padding: "10px 12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "white", fontSize: 13 }}>
                  {w.symbol}
                </span>
                <span style={{ color: "var(--ink-dim)", fontSize: 12 }}>{describeRule(w.rule)}</span>
                {w.last_triggered_at && (
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--ink-dimmer)", letterSpacing: "0.1em" }}>
                    LAST FIRED {new Date(w.last_triggered_at).toLocaleDateString()}
                  </span>
                )}
              </div>
              <button
                onClick={() => removeWatch(w.id)}
                aria-label={`Delete ${w.symbol} alert`}
                style={{ background: "transparent", border: "none", color: "var(--ink-dimmer)", cursor: "pointer", fontSize: 16 }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  close
                </span>
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
