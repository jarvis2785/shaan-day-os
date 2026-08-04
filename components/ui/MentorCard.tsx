'use client';

import { motion } from 'framer-motion';
import { DayLoadLabel } from '@/lib/types';

interface MentorCardProps {
  assessment: string;
  loadLabel?: DayLoadLabel;
}

function getLoadColor(label?: DayLoadLabel): string {
  if (label === 'CLEAR') return '#30D158';
  if (label === 'TIGHT') return '#FFD60A';
  return '#FF453A';
}

export default function MentorCard({ assessment, loadLabel }: MentorCardProps) {
  const color = getLoadColor(loadLabel);

  return (
    <motion.div
      className="rounded-card p-4 relative overflow-hidden"
      style={{
        backgroundColor: '#1C1C1E',
        borderLeft: `3px solid ${color}`,
      }}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <div
        className="absolute left-0 top-0 bottom-0 w-16 opacity-[0.06] pointer-events-none"
        style={{
          background: `linear-gradient(to right, ${color}, transparent)`,
        }}
      />
      <div className="relative">
        <span className="text-[11px] font-semibold tracking-[0.15em] uppercase" style={{ color: '#48484A' }}>
          MENTOR&apos;S TAKE
        </span>
        <p className="text-[15px] leading-[1.6] mt-3" style={{ color: '#8E8E93' }}>
          {assessment}
        </p>
      </div>
    </motion.div>
  );
}
