"use client";

import React, { useRef, useState, useEffect, useId } from "react";
import { createPortal } from "react-dom";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { clsx } from "clsx";
import { useLiquidGlass } from "./LiquidGlassContext";
import { GLASS_SPRING_CONFIG } from "@/lib/constants";

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

  // Mouse position for reflection effect
  const mouseX = useMotionValue(50);
  const mouseY = useMotionValue(50);
  const springX = useSpring(mouseX, GLASS_SPRING_CONFIG);
  const springY = useSpring(mouseY, GLASS_SPRING_CONFIG);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    mouseX.set(x);
    mouseY.set(y);
  };

  const handleMouseLeave = () => {
    mouseX.set(50);
    mouseY.set(50);
  };

  const hasContext = !!context;

  return (
    <>
      <motion.div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={onClick}
        layout={layout}
        layoutId={layoutId} // Use same layoutId as mask silhouette
        className={clsx(
          "relative overflow-visible",
          !hasContext && (variant === "regular" ? "glass-material" : "glass-prominent"),
          className
        )}
        style={
          {
            ...style,
            borderRadius: `${cornerRadius}px`,
            WebkitBorderRadius: `${cornerRadius}px`,
            "--mouse-x": springX.get() + "%",
            "--mouse-y": springY.get() + "%",
            backgroundColor: !hasContext && tint ? `${tint}0D` : undefined,
            borderColor: !hasContext && tint ? `${tint}33` : undefined,
          } as React.CSSProperties
        }
        whileHover={interactive ? { backgroundColor: hasContext ? undefined : (tint ? `${tint}1A` : "rgba(255,255,255,0.08)") } : {}}
        whileTap={interactive ? { scale: 0.99 } : {}}
      >
        <div className="glass-reflection pointer-events-none" />
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
