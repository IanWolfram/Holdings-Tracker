"use client";

import React, { useRef, useState, useEffect, useId } from "react";
import { createPortal } from "react-dom";
import { motion, useMotionValue } from "framer-motion";
import { clsx } from "clsx";
import { useLiquidGlass } from "./LiquidGlassContext";

interface GlassViewProps {
  children: React.ReactNode;
  className?: string;
  variant?: "regular" | "prominent";
  tint?: string;
  interactive?: boolean;
  cornerRadius?: number;
  onClick?: () => void;
  layoutId?: string;
  layout?: boolean | "position" | "size" | "preserve-aspect";
  style?: React.CSSProperties;
}

export default function GlassView({
  children,
  className,
  variant = "regular",
  tint,
  interactive = false,
  cornerRadius = 16,
  onClick,
  layoutId,
  layout,
  style,
}: GlassViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const internalId = useId();
  const context = useLiquidGlass();
  const [mounted, setMounted] = useState(false);

  // High-performance mask coordinates (avoiding state re-renders)
  const maskX = useMotionValue(0);
  const maskY = useMotionValue(0);
  const maskW = useMotionValue(0);
  const maskH = useMotionValue(0);

  useEffect(() => {
    setMounted(true);
    if (!containerRef.current) return;

    const measure = () => {
      const el = containerRef.current;
      if (!el) return;
      
      const parent = el.closest(".relative");
      if (!parent) return;

      const rect = el.getBoundingClientRect();
      const parentRect = parent.getBoundingClientRect();

      maskX.set(rect.left - parentRect.left);
      maskY.set(rect.top - parentRect.top);
      maskW.set(rect.width);
      maskH.set(rect.height);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(containerRef.current);
    
    // Also re-measure on window scroll/resize to be safe
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, { capture: true });

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, { capture: true });
    };
  }, []);

  const hasContext = !!context;

  return (
    <>
      <motion.div
        ref={containerRef}
        onClick={onClick}
        layout={layout}
        layoutId={layoutId}
        className={clsx(
          "relative overflow-visible",
          !hasContext && (variant === "regular" ? "glass-material" : "glass-prominent"),
          className
        )}
        style={{
          ...style,
          borderRadius: `${cornerRadius}px`,
          WebkitBorderRadius: `${cornerRadius}px`,
          backgroundColor: !hasContext && tint ? `${tint}0D` : undefined,
          borderColor: !hasContext && tint ? `${tint}33` : undefined,
        } as React.CSSProperties}
        whileHover={interactive ? { backgroundColor: hasContext ? undefined : (tint ? `${tint}1A` : "rgba(255,255,255,0.08)") } : {}}
        whileTap={interactive ? { scale: 0.99 } : {}}
      >
        <div className="relative z-20">{children}</div>
      </motion.div>

      {/* The Silhouette Portal into Parent's SVG Mask */}
      {hasContext && mounted && context.maskRef.current && createPortal(
        <motion.rect
          initial={false}
          style={{
            x: maskX,
            y: maskY,
            width: maskW,
            height: maskH,
          }}
          rx={cornerRadius}
          ry={cornerRadius}
          fill="white"
          className="pointer-events-none"
        />,
        context.maskRef.current
      )}
    </>
  );
}
