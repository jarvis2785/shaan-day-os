'use client';

import { ScheduleBlock } from '@/lib/types';
import { timeToMinutes } from '@/lib/schedule';

interface CapacityBarProps {
  wakeTime: string;
  sleepTime: string;
  schedule?: ScheduleBlock[];
  loading?: boolean;
}

export default function CapacityBar({ wakeTime, sleepTime, schedule, loading }: CapacityBarProps) {
  const wakeMin = timeToMinutes(wakeTime);
  const sleepMin = timeToMinutes(sleepTime);
  const totalMinutes = sleepMin - wakeMin;
  const segmentCount = Math.floor(totalMinutes / 30);

  function getSegmentColor(index: number): string {
    if (loading) return '#1E1E1E';
    if (!schedule || schedule.length === 0) return '#111111';

    const segStart = wakeMin + index * 30;
    const segEnd = segStart + 30;

    for (const block of schedule) {
      const blockStart = timeToMinutes(block.start);
      const blockEnd = timeToMinutes(block.end);

      if (segStart < blockEnd && segEnd > blockStart) {
        if (block.type === 'fixed') return '#2A2A2A';
        if (block.type === 'task') return '#E8FF47';
        if (block.type === 'gym') return '#E8FF47';
        if (block.type === 'buffer') return '#1E1E1E';
      }
    }

    return '#111111';
  }

  return (
    <div className="w-full">
      <div className="flex gap-[2px]">
        {Array.from({ length: segmentCount }).map((_, i) => (
          <div
            key={i}
            className={`h-3 flex-1 rounded-sm transition-all ${loading ? 'animate-pulse-segment' : ''}`}
            style={{
              backgroundColor: getSegmentColor(i),
              animationDelay: loading ? `${i * 50}ms` : undefined,
            }}
          />
        ))}
      </div>
    </div>
  );
}
