"use client";

import React, { useId } from "react";
import { motion, LayoutGroup } from "framer-motion";
import { clsx } from "clsx";
import { LiquidGlassProvider } from "./LiquidGlassContext";

interface GlassContainerProps {
  children: React.ReactNode;
  className?: string;
  liquid?: boolean;
}

export default function GlassContainer({
  children,
  className,
  liquid = true,
}: GlassContainerProps) {
  const maskId = `mask-${useId().replace(/:/g, "")}`;

  return (
    <LayoutGroup id={maskId}>
      <LiquidGlassProvider maskId={maskId}>
        <div className={clsx("relative", className)}>
          {/* The Shared Glass Sheet - only visible where masked */}
          {liquid && (
            <motion.div 
              className="absolute inset-0 pointer-events-none glass-material z-0"
              style={{ 
                WebkitMaskImage: `url(#${maskId})`, 
                maskImage: `url(#${maskId})`,
                maskType: "alpha"
              }}
            />
          )}

          <div className="relative z-10 h-full w-full">
            {children}
          </div>
        </div>
      </LiquidGlassProvider>
    </LayoutGroup>
  );
}
