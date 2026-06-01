"use client";

import { useState, useRef, type KeyboardEvent } from "react";
import { Icon } from "./icons";
import { ACCENT } from "./types";

export default function Composer({
  onSubmit,
  disabled,
}: {
  onSubmit: (text: string) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");
  const [focus, setFocus] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    const text = value.trim();
    if (!text || disabled) return;
    onSubmit(text);
    setValue("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const canSend = value.trim().length > 0 && !disabled;

  return (
    <div style={{ maxWidth: 920, margin: "0 auto", padding: "0 40px" }}>
      <div
        style={{
          position: "relative",
          background: "rgba(20,22,26,0.95)",
          border: `1px solid ${focus ? `${ACCENT}66` : "rgba(255,255,255,0.1)"}`,
          boxShadow: focus ? `0 0 0 3px ${ACCENT}14, 0 18px 40px -16px rgba(0,0,0,0.7)` : "0 12px 32px -16px rgba(0,0,0,0.6)",
          borderRadius: 12,
          padding: "12px 12px 10px 16px",
          transition: "all .15s",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <textarea
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => setFocus(true)}
            onBlur={() => setFocus(false)}
            onKeyDown={onKeyDown}
            placeholder="Ask about a stock, sector, or your portfolio…"
            rows={1}
            disabled={disabled}
            style={{
              flex: 1,
              minHeight: 28,
              maxHeight: 200,
              background: "transparent",
              border: 0,
              outline: 0,
              resize: "none",
              color: "white",
              fontFamily: "var(--font-body)",
              fontSize: 14,
              lineHeight: 1.5,
              padding: "4px 0",
            }}
          />
          <button
            onClick={submit}
            disabled={!canSend}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: 0,
              background: canSend ? ACCENT : "rgba(255,255,255,0.06)",
              color: canSend ? "#0a0a0a" : "var(--ink-dimmer)",
              cursor: canSend ? "pointer" : "not-allowed",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all .15s",
              boxShadow: canSend ? `0 0 16px ${ACCENT}44` : "none",
              flexShrink: 0,
            }}
          >
            <Icon name="arrow_upward" style={{ fontSize: 18, fontWeight: 700 }} />
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", marginTop: 6, paddingTop: 8, borderTop: "1px solid var(--rule)" }}>
          <span style={{ flex: 1 }} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--ink-dimmer)", letterSpacing: "0.18em", textTransform: "uppercase", marginRight: 6 }}>
            <kbd style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--ink-dim)", padding: "2px 5px", borderRadius: 3, border: "1px solid var(--rule)", background: "rgba(255,255,255,0.02)", marginRight: 4 }}>⏎</kbd>
            send
            <span style={{ margin: "0 8px", color: "var(--ink-dimmer)" }}>·</span>
            <kbd style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--ink-dim)", padding: "2px 5px", borderRadius: 3, border: "1px solid var(--rule)", background: "rgba(255,255,255,0.02)", marginRight: 4 }}>⇧⏎</kbd>
            newline
          </span>
        </div>
      </div>
    </div>
  );
}
