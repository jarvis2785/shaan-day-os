'use client';

import { motion } from 'framer-motion';
import { ScheduleBlock, DayLoadLabel } from '@/lib/types';
import { timeToMinutes } from '@/lib/schedule';

interface CapacityBarProps {
  wakeTime: string;
  sleepTime: string;
  schedule?: ScheduleBlock[];
  loading?: boolean;
  loadLabel?: DayLoadLabel;
}

function getLoadColor(label?: DayLoadLabel): string {
  if (label === 'CLEAR') return '#30D158';
  if (label === 'TIGHT') return '#FFD60A';
  if (label === 'LOADED' || label === 'OVERLOADED') return '#FF453A';
  return '#30D158';
}

export default function CapacityBar({ wakeTime, sleepTime, schedule, loading, loadLabel }: CapacityBarProps) {
  const wakeMin = timeToMinutes(wakeTime);
  const sleepMin = timeToMinutes(sleepTime);
  const totalMinutes = sleepMin - wakeMin;
  const segmentCount = Math.floor(totalMinutes / 30);
  const taskColor = getLoadColor(loadLabel);

  function getSegmentColor(index: number): string {
    if (loading) return '#1C1C1E';
    if (!schedule || schedule.length === 0) return '#1C1C1E';

    const segStart = wakeMin + index * 30;
    const segEnd = segStart + 30;

    for (const block of schedule) {
      const blockStart = timeToMinutes(block.start);
      const blockEnd = timeToMinutes(block.end);

      if (segStart < blockEnd && segEnd > blockStart) {
        if (block.type === 'fixed') return '#3A3A3C';
        if (block.type === 'task' || block.type === 'gym') return taskColor;
        if (block.type === 'buffer' || block.type === 'dead_zone' || block.type === 'meal') return '#242424';
      }
    }

    return '#1C1C1E';
  }

  return (
    <div className="w-full">
      <div className="flex gap-[3px]">
        {Array.from({ length: segmentCount }).map((_, i) => (
          <motion.div
            key={i}
            className="h-[6px] flex-1 rounded-sm"
            style={{ backgroundColor: getSegmentColor(i) }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.4, delay: i * 0.025, ease: [0.16, 1, 0.3, 1] }}
          />
        ))}
      </div>
    </div>
  );
}
