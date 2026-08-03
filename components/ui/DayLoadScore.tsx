'use client';

import { DayLoadLabel } from '@/lib/types';

interface DayLoadScoreProps {
  percent: number;
  label: DayLoadLabel;
}

export default function DayLoadScore({ percent, label }: DayLoadScoreProps) {
  const color =
    label === 'CLEAR'
      ? '#E8FF47'
      : label === 'TIGHT'
        ? '#FFB347'
        : '#FF4040';

  return (
    <div className="text-center py-4">
      <div
        className="font-display text-6xl font-extrabold tracking-tight"
        style={{ color }}
      >
        {percent}%
      </div>
      <div
        className="font-display text-sm font-bold tracking-[0.2em] mt-1"
        style={{ color }}
      >
        {label}
      </div>
    </div>
  );
}
