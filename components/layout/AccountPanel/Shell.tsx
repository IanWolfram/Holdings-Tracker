"use client";

import { motion } from "framer-motion";
import { EASE } from "./primitives";

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16 }}
      transition={{ duration: 0.2, ease: EASE }}
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        zIndex: 60,
        width: 380,
        maxWidth: "calc(100vw - 48px)",
        height: "100vh",
        background: "rgba(18, 18, 20, 0.98)",
        backdropFilter: "blur(24px) saturate(170%)",
        WebkitBackdropFilter: "blur(24px) saturate(170%)",
        borderLeft: "1px solid rgba(255,255,255,0.07)",
        boxShadow: "-12px 0 48px rgba(0,0,0,0.6)",
        display: "flex",
        flexDirection: "column",
        pointerEvents: "auto",
      }}
    >
      {/* Scanline overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "repeating-linear-gradient(to bottom, transparent 0px, transparent 2px, rgba(255,255,255,0.012) 2px, rgba(255,255,255,0.012) 3px)",
          pointerEvents: "none",
          zIndex: 1,
          borderRadius: "inherit",
        }}
      />
      {children}
    </motion.div>
  );
}