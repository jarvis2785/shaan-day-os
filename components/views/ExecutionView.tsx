'use client';

import { motion } from 'framer-motion';
import { AnalysisResult, ScheduleBlock } from '@/lib/types';
import { timeToMinutes, formatTimeDisplay, getISTMinutes } from '@/lib/schedule';
import TimelineBlock from '@/components/ui/TimelineBlock';

interface ExecutionViewProps {
  analysis: AnalysisResult;
  completedIds: string[];
  onMarkDone: (id: string) => void;
  onUnlock: () => void;
}

function getLoadColor(label: string): string {
  if (label === 'CLEAR') return '#30D158';
  if (label === 'TIGHT') return '#FFD60A';
  return '#FF453A';
}

function getCurrentBlock(schedule: ScheduleBlock[]): ScheduleBlock | null {
  const currentMin = getISTMinutes();
  for (const block of schedule) {
    const start = timeToMinutes(block.start);
    const end = timeToMinutes(block.end);
    if (currentMin >= start && currentMin < end) return block;
  }
  return null;
}

function getUpcomingBlocks(schedule: ScheduleBlock[], completedIds: string[]): ScheduleBlock[] {
  const currentMin = getISTMinutes();
  return schedule.filter((b) => {
    const start = timeToMinutes(b.start);
    return start > currentMin && !completedIds.includes(b.id) && b.type !== 'wake' && b.type !== 'sleep';
  });
}

export default function ExecutionView({ analysis, completedIds, onMarkDone, onUnlock }: ExecutionViewProps) {
  const currentBlock = getCurrentBlock(analysis.schedule);
  const upcoming = getUpcomingBlocks(analysis.schedule, completedIds);
  const currentMin = getISTMinutes();
  const completed = analysis.schedule.filter(
    (b) => completedIds.includes(b.id) || (b.type !== 'wake' && b.type !== 'sleep' && b.type !== 'buffer' && timeToMinutes(b.end) <= currentMin && !upcoming.includes(b) && b !== currentBlock)
  );

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
  const loadColor = getLoadColor(analysis.dayLoadLabel);

  return (
    <div className="space-y-8">
      <motion.div
        className="text-center"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="text-[11px] font-semibold tracking-[0.15em] uppercase" style={{ color: '#48484A' }}>
          NOW
        </div>
        <div className="text-[48px] font-extrabold leading-none mt-1" style={{ color: '#FFFFFF' }}>
          {timeStr}
        </div>
      </motion.div>

      {currentBlock && (
        <motion.div
          className="rounded-card p-5 relative overflow-hidden"
          style={{
            backgroundColor: '#242424',
            borderLeft: `3px solid ${loadColor}`,
          }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <div
            className="absolute left-0 top-0 bottom-0 w-20 opacity-[0.06] pointer-events-none"
            style={{ background: `linear-gradient(to right, ${loadColor}, transparent)` }}
          />
          <div className="relative">
            <div className="text-[15px] font-semibold mb-1" style={{ color: '#FFFFFF' }}>
              {currentBlock.name}
            </div>
            <div className="font-mono text-[13px] mb-3" style={{ color: '#48484A' }}>
              ends at {formatTimeDisplay(currentBlock.end)}
            </div>
            {(currentBlock.type === 'task' || currentBlock.type === 'gym') && !completedIds.includes(currentBlock.id) && (
              <motion.button
                onClick={() => onMarkDone(currentBlock.id)}
                className="w-full py-3 rounded-btn text-[15px] font-bold"
                style={{ backgroundColor: loadColor, color: '#000000' }}
                whileTap={{ scale: 0.96 }}
              >
                Mark as Done
              </motion.button>
            )}
          </div>
        </motion.div>
      )}

      {upcoming.length > 0 && (
        <div>
          <div className="text-[11px] font-semibold tracking-[0.15em] uppercase mb-3" style={{ color: '#48484A' }}>
            NEXT UP
          </div>
          <div className="space-y-0.5">
            {upcoming.slice(0, 6).map((block, i) => (
              <TimelineBlock
                key={block.id}
                block={block}
                index={i}
                loadLabel={analysis.dayLoadLabel}
                onMarkDone={onMarkDone}
              />
            ))}
          </div>
        </div>
      )}

      {completed.length > 0 && (
        <div>
          <div className="text-[11px] font-semibold tracking-[0.15em] uppercase mb-3" style={{ color: '#48484A' }}>
            COMPLETED
          </div>
          <div className="flex flex-wrap gap-2">
            {completed.map((block) => (
              <motion.div
                key={block.id}
                className="text-[13px] rounded-pill px-3 py-1.5"
                style={{
                  backgroundColor: 'rgba(48, 209, 88, 0.06)',
                  border: '1px solid rgba(48, 209, 88, 0.15)',
                  color: '#30D158',
                }}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                &#10003; {block.name}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      <motion.button
        onClick={onUnlock}
        className="w-full py-3.5 rounded-btn text-[15px] font-medium"
        style={{ color: '#FF453A', border: '1px solid rgba(255, 69, 58, 0.3)' }}
        whileTap={{ scale: 0.96 }}
      >
        Unlock &amp; Re-plan
      </motion.button>
    </div>
  );
}
