"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import GlassView from "@/components/ui/LiquidGlass/GlassView";
import { TICKER_COORDS } from "@/lib/ticker-coords";

// Sorted list of known tickers from the existing coordinate data
const KNOWN_TICKERS = Object.keys(TICKER_COORDS).sort();

interface AddProposedCardProps {
  onAdd: (ticker: string, targetShares?: number, targetPrice?: number) => boolean;
  existingTickers: string[];
}

export default function AddProposedCard({
  onAdd,
  existingTickers,
}: AddProposedCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [ticker, setTicker] = useState("");
  const [targetShares, setTargetShares] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [error, setError] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(() => {
    const query = ticker.toUpperCase().trim();
    if (!query) return [];
    return KNOWN_TICKERS.filter(
      (t) => t.startsWith(query) && !existingTickers.includes(t)
    ).slice(0, 8);
  }, [ticker, existingTickers]);

  // Reset selection when suggestions change
  useEffect(() => {
    setSelectedIdx(0);
  }, [suggestions]);

  const handleSubmit = (value?: string) => {
    const upper = (value ?? ticker).toUpperCase().trim();
    if (!upper) {
      setError("Enter a ticker symbol");
      return;
    }
    if (existingTickers.includes(upper)) {
      setError("Already tracked");
      return;
    }
    const shares = targetShares ? parseInt(targetShares, 10) : undefined;
    const price = targetPrice ? parseFloat(targetPrice) : undefined;

    const success = onAdd(upper, shares, price);
    if (!success) {
      setError("Could not add position");
      return;
    }

    setTicker("");
    setTargetShares("");
    setTargetPrice("");
    setError("");
    setShowSuggestions(false);
    setExpanded(false);
  };

  const handleCancel = () => {
    setTicker("");
    setTargetShares("");
    setTargetPrice("");
    setError("");
    setShowSuggestions(false);
    setExpanded(false);
  };

  const handleInputChange = (value: string) => {
    setTicker(value.toUpperCase());
    setError("");
    setShowSuggestions(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" && showSuggestions && suggestions.length > 0) {
      e.preventDefault();
      setSelectedIdx((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp" && showSuggestions && suggestions.length > 0) {
      e.preventDefault();
      setSelectedIdx((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (showSuggestions && suggestions.length > 0) {
        handleSubmit(suggestions[selectedIdx]);
      } else {
        handleSubmit();
      }
    } else if (e.key === "Escape") {
      if (showSuggestions) {
        setShowSuggestions(false);
      } else {
        handleCancel();
      }
    } else if (e.key === "Tab" && showSuggestions && suggestions.length > 0) {
      e.preventDefault();
      setTicker(suggestions[selectedIdx]);
      setShowSuggestions(false);
    }
  };

  return (
    <GlassView
      cornerRadius={12}
      className="glass-edge-proposed relative flex flex-col group shadow-2xl transition-all duration-300"
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.4)",
        overflow: "hidden",
      }}
    >
      <AnimatePresence mode="wait">
        {!expanded ? (
          <motion.button
            key="collapsed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setExpanded(true)}
            className="flex flex-col items-center justify-center gap-2 py-12 px-4 w-full cursor-pointer hover:bg-amber-500/5 transition-colors"
          >
            <span className="material-symbols-outlined text-3xl text-amber-400/60 group-hover:text-amber-400 transition-colors">
              add_circle
            </span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-amber-400/50 group-hover:text-amber-400/80 transition-colors">
              Add Position
            </span>
          </motion.button>
        ) : (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="p-3 space-y-2.5"
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className="material-symbols-outlined text-amber-400 text-sm">
                monitoring
              </span>
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-amber-400">
                Watch Stock
              </span>
            </div>

            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={ticker}
                onChange={(e) => handleInputChange(e.target.value)}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => {
                  // Delay to allow click on suggestion
                  setTimeout(() => setShowSuggestions(false), 150);
                }}
                onKeyDown={handleKeyDown}
                placeholder="TICKER"
                autoFocus
                maxLength={10}
                className="w-full bg-black/40 border border-amber-500/20 rounded px-2.5 py-1.5 font-mono text-[11px] text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 transition-colors"
              />

              <AnimatePresence>
                {showSuggestions && suggestions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="absolute top-full left-0 right-0 z-40 mt-1 bg-black/90 border border-amber-500/20 rounded-md overflow-hidden shadow-xl backdrop-blur-sm"
                  >
                    {suggestions.map((s, i) => (
                      <button
                        key={s}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setTicker(s);
                          setShowSuggestions(false);
                          inputRef.current?.focus();
                        }}
                        onMouseEnter={() => setSelectedIdx(i)}
                        className={`w-full text-left px-2.5 py-1.5 font-mono text-[11px] tracking-wider transition-colors ${
                          i === selectedIdx
                            ? "bg-amber-500/15 text-amber-300"
                            : "text-slate-400 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                value={targetShares}
                onChange={(e) => setTargetShares(e.target.value)}
                placeholder="Shares"
                min="0"
                className="bg-black/40 border border-white/10 rounded px-2.5 py-1.5 font-mono text-[11px] text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/30 transition-colors"
              />
              <input
                type="number"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                placeholder="Target price"
                min="0"
                step="0.01"
                className="bg-black/40 border border-white/10 rounded px-2.5 py-1.5 font-mono text-[11px] text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/30 transition-colors"
              />
            </div>

            {error && (
              <p className="text-[9px] font-mono text-red-400">{error}</p>
            )}

            <div className="flex gap-2 pt-0.5">
              <button
                onClick={() => handleSubmit()}
                className="flex-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 rounded px-2 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider transition-colors"
              >
                Add
              </button>
              <button
                onClick={handleCancel}
                className="flex-1 text-slate-500 hover:text-slate-300 border border-white/5 hover:border-white/10 rounded px-2 py-1.5 font-mono text-[10px] uppercase tracking-wider transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassView>
  );
}