'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { DayLoadLabel } from '@/lib/types';

interface DayLoadScoreProps {
  percent: number;
  label: DayLoadLabel;
  loading?: boolean;
}

function getLoadColor(label: DayLoadLabel): string {
  if (label === 'CLEAR') return '#30D158';
  if (label === 'TIGHT') return '#FFD60A';
  return '#FF453A';
}

export default function DayLoadScore({ percent, label, loading }: DayLoadScoreProps) {
  const [displayPercent, setDisplayPercent] = useState(0);
  const color = getLoadColor(label);
  const size = 220;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const arcFraction = 0.75;
  const arcLength = circumference * arcFraction;
  const filledLength = arcLength * Math.min(percent, 150) / 150;
  const rotation = 135;

  useEffect(() => {
    if (loading) return;
    let frame: number;
    const duration = 1200;
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayPercent(Math.round(eased * percent));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [percent, loading]);

  if (loading) {
    return (
      <div className="flex flex-col items-center">
        <div className="relative" style={{ width: size, height: size }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="#2C2C2E"
              strokeWidth={strokeWidth}
              strokeDasharray={`${arcLength} ${circumference - arcLength}`}
              strokeLinecap="round"
              transform={`rotate(${rotation} ${size / 2} ${size / 2})`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="w-16 h-10 rounded-btn animate-shimmer" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#2C2C2E"
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLength} ${circumference - arcLength}`}
            strokeLinecap="round"
            transform={`rotate(${rotation} ${size / 2} ${size / 2})`}
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLength} ${circumference - arcLength}`}
            strokeLinecap="round"
            transform={`rotate(${rotation} ${size / 2} ${size / 2})`}
            initial={{ strokeDashoffset: arcLength }}
            animate={{ strokeDashoffset: arcLength - filledLength }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-display text-[64px] font-extrabold leading-none tracking-tight"
            style={{ color }}
          >
            {displayPercent}%
          </span>
          <span
            className="text-[13px] font-semibold tracking-[0.15em] uppercase mt-1"
            style={{ color }}
          >
            {label}
          </span>
        </div>
      </div>
    </div>
  );
}
