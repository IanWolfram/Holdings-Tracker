"use client";

import { motion } from "framer-motion";
import { useState } from "react";

const ORBIT_RADIUS = 22;
const ICON_SIZE = 17;
const IDLE_TUNE_ANGLE = -150;
const IDLE_GEAR_ANGLE = -30;
const IDLE_PERSON_ANGLE = 90;
const ORBIT_DURATION = 3;

interface AccountIconDivProps {
  onClick: () => void;
  isOpen: boolean;
}

function OrbitIcon({
  idleAngle,
  icon,
  hovered,
}: {
  idleAngle: number;
  icon: string;
  hovered: boolean;
}) {
  return (
    <motion.div
      className="absolute"
      style={{ left: "50%", top: "50%", width: 0, height: 0 }}
      animate={{ rotate: hovered ? [idleAngle, idleAngle + 360] : idleAngle }}
      transition={
        hovered
          ? { duration: ORBIT_DURATION, repeat: Infinity, ease: "linear" }
          : { duration: 0.4, ease: [0.22, 1, 0.36, 1] }
      }
    >
      <div className="absolute" style={{ left: ORBIT_RADIUS, top: 0 }}>
        <motion.div
          style={{ marginLeft: -ICON_SIZE / 2, marginTop: -ICON_SIZE / 2 }}
          animate={{ rotate: hovered ? [-idleAngle, -idleAngle - 360] : -idleAngle }}
          transition={
            hovered
              ? { duration: ORBIT_DURATION, repeat: Infinity, ease: "linear" }
              : { duration: 0.4, ease: [0.22, 1, 0.36, 1] }
          }
        >
          <motion.span
            className="material-symbols-outlined"
            style={{ fontSize: ICON_SIZE, display: "block" }}
            animate={{ color: hovered ? "#f1f5f9" : "#cbd5e1" }}
            transition={{ duration: 0.2 }}
          >
            {icon}
          </motion.span>
        </motion.div>
      </div>
    </motion.div>
  );
}

export default function AccountIconDiv({ onClick, isOpen }: AccountIconDivProps) {
  const [hovered, setHovered] = useState(false);

  const handleMouseEnter = () => setHovered(true);
  const handleMouseLeave = () => setHovered(false);

  return (
    <div
      className={`group relative flex items-center justify-center self-stretch w-[76px] cursor-pointer transition-colors ${
        isOpen ? "bg-white/[0.06]" : "hover:bg-white/[0.04]"
      }`}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Touch ID-style recessed well: polished metal ring + sunken dark center */}
      <div
        className="absolute w-[44px] h-[44px] rounded-full p-[1.5px]"
        style={{
          background:
            "conic-gradient(from 90deg, rgba(255,255,255,0.04) 0deg, rgba(255,255,255,0.45) 60deg, rgba(255,255,255,0.05) 140deg, rgba(255,255,255,0.04) 220deg, rgba(255,255,255,0.45) 300deg, rgba(255,255,255,0.04) 360deg)",
          boxShadow: "0 1px 2px rgba(0,0,0,0.5)",
        }}
      >
        <div
          className="h-full w-full rounded-full"
          style={{
            background:
              "radial-gradient(circle at 50% 35%, #2c2c32 0%, #18181b 62%, #0e0e10 100%)",
            boxShadow:
              "inset 0 2px 3px rgba(0,0,0,0.85), inset 0 -1px 1.5px rgba(255,255,255,0.06)",
          }}
        />
      </div>

      <OrbitIcon idleAngle={IDLE_TUNE_ANGLE} icon="tune" hovered={hovered} />
      <OrbitIcon idleAngle={IDLE_GEAR_ANGLE} icon="settings" hovered={hovered} />
      <OrbitIcon idleAngle={IDLE_PERSON_ANGLE} icon="person" hovered={hovered} />
    </div>
  );
}