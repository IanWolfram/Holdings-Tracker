"use client";

import { motion } from "framer-motion";
import { useState } from "react";

const ORBIT_RADIUS = 20;
const ICON_SIZE = 14;
const IDLE_TUNE_ANGLE = -135;
const IDLE_GEAR_ANGLE = -20;
const IDLE_PERSON_ANGLE = 135;
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
            animate={{ color: hovered ? "#e2e8f0" : "#64748b" }}
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
      className={`group relative flex items-center justify-center self-stretch w-[60px] cursor-pointer transition-colors ${
        isOpen ? "bg-white/[0.06]" : "hover:bg-white/[0.04]"
      }`}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="absolute w-[40px] h-[40px] rounded-full border border-white/[0.14]" />

      <OrbitIcon idleAngle={IDLE_TUNE_ANGLE} icon="tune" hovered={hovered} />
      <OrbitIcon idleAngle={IDLE_GEAR_ANGLE} icon="settings" hovered={hovered} />
      <OrbitIcon idleAngle={IDLE_PERSON_ANGLE} icon="person" hovered={hovered} />
    </div>
  );
}