"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import GlassView from "./GlassView";
import GlassContainer from "./GlassContainer";

export default function DeepGlassShowcase() {
  const [clickCount, setClickCount] = useState(0);
  const [isMerged, setIsMerged] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="flex flex-col gap-12 p-10 bg-[#0a0c10] min-h-[800px] rounded-3xl overflow-hidden relative border border-white/5">
      {/* Dynamic Background Lights */}
      <motion.div 
        animate={{ 
          scale: [1, 1.2, 1],
          x: [0, 50, 0],
          y: [0, -30, 0],
          rotate: [0, 90, 0]
        }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-10 left-10 w-80 h-80 bg-purple-500/60 rounded-full blur-[100px] pointer-events-none mix-blend-screen" 
      />
      <motion.div 
        animate={{ 
          scale: [1, 1.3, 1],
          x: [0, -40, 0],
          y: [0, 60, 0],
          rotate: [0, -90, 0]
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="absolute bottom-10 right-10 w-96 h-96 bg-blue-500/50 rounded-full blur-[120px] pointer-events-none mix-blend-screen" 
      />

      <div className="relative z-10 space-y-12">
        {/* Section 1: Basic Materials */}
        <section className="space-y-6">
          <h2 className="text-xl font-bold tracking-tight text-white/40 uppercase text-[10px] tracking-widest">01 — Basic Materials</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <GlassView interactive className="p-6 h-40">
              <h3 className="text-sm font-semibold text-white/90">Regular Glass</h3>
              <p className="text-xs text-white/60 mt-2 leading-relaxed">Standard material with 24px blur and internal reflections.</p>
            </GlassView>
            <GlassView variant="prominent" interactive className="p-6 h-40">
              <h3 className="text-sm font-semibold text-white">Prominent Material</h3>
              <p className="text-xs text-white/70 mt-2 leading-relaxed">Deeper blur and higher opacity for focus.</p>
            </GlassView>
            <GlassView tint="#3b82f6" interactive className="p-6 h-40">
              <h3 className="text-sm font-semibold text-blue-100">Blue Accent</h3>
              <p className="text-xs text-blue-100/60 mt-2 leading-relaxed">Vibrant light-reactive tinting.</p>
            </GlassView>
          </div>
        </section>

        {/* Section 2: Liquid Merging */}
        <section className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold tracking-tight text-white/40 uppercase text-[10px] tracking-widest">02 — Liquid Merging</h2>
            <button 
              onClick={() => setIsMerged(!isMerged)}
              className="px-4 py-1.5 rounded-full border border-white/10 text-[10px] uppercase tracking-widest hover:bg-white/5 transition-colors"
            >
              {isMerged ? "Separate Elements" : "Merge Elements"}
            </button>
          </div>
          
          <GlassContainer className="h-64 flex items-center justify-center bg-white/5 rounded-2xl overflow-hidden">
            <div className="relative w-full max-w-md flex justify-around">
              <GlassView 
                layout 
                interactive
                cornerRadius={50}
                className="w-24 h-24 flex items-center justify-center p-0"
                style={{ x: isMerged ? 40 : 0 }}
              >
                <span className="material-symbols-outlined text-purple-400">polymer</span>
              </GlassView>
              
              <GlassView 
                layout 
                interactive
                cornerRadius={50}
                className="w-24 h-24 flex items-center justify-center p-0"
                style={{ x: isMerged ? -40 : 0 }}
              >
                <span className="material-symbols-outlined text-blue-400">blur_on</span>
              </GlassView>
            </div>
          </GlassContainer>
        </section>

        {/* Section 3: Smooth Morphing */}
        <section className="space-y-6">
          <h2 className="text-xl font-bold tracking-tight text-white/40 uppercase text-[10px] tracking-widest">03 — Morphing Transitions</h2>
          <div className="flex gap-12 items-center min-h-[200px]">
            <AnimatePresence mode="wait">
              {!isExpanded ? (
                <GlassView 
                  key="small"
                  layoutId="morph-demo"
                  interactive
                  cornerRadius={100}
                  className="w-16 h-16 flex items-center justify-center cursor-pointer bg-white/10"
                  onClick={() => setIsExpanded(true)}
                >
                  <span className="material-symbols-outlined text-sm">add</span>
                </GlassView>
              ) : (
                <GlassView 
                  key="large"
                  layoutId="morph-demo"
                  interactive
                  className="w-full max-w-sm p-6 cursor-pointer"
                  onClick={() => setIsExpanded(false)}
                >
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-bold">Expanded State</h3>
                    <span className="material-symbols-outlined text-xs opacity-40">close</span>
                  </div>
                  <p className="text-xs text-white/60 leading-relaxed italic">
                    This element used to be a small circle. Framer Motion layoutId handles the smooth transformation of the glass material.
                  </p>
                </GlassView>
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* Action Button Demo */}
        <div className="flex gap-4 items-center pt-8 border-t border-white/5">
          <GlassView 
            variant="prominent" 
            interactive 
            cornerRadius={30} 
            className="px-8 py-3 cursor-pointer flex items-center gap-3 select-none"
            onClick={() => setClickCount(c => c + 1)}
          >
            <motion.span 
              animate={clickCount > 0 ? { rotate: [0, -20, 20, 0] } : {}}
              key={clickCount}
              className="material-symbols-outlined text-sm text-blue-400"
            >
              rocket_launch
            </motion.span>
            <span className="text-sm font-semibold text-white">Launch {clickCount > 0 ? `(${clickCount})` : ""}</span>
          </GlassView>
        </div>
      </div>
    </div>
  );
}
