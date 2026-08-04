'use client';

import { motion } from 'framer-motion';
import { ScheduleBlock, DayLoadLabel, CATEGORY_EMOJIS, TaskCategory } from '@/lib/types';
import { formatTimeDisplay } from '@/lib/schedule';

interface TimelineBlockProps {
  block: ScheduleBlock;
  index?: number;
  isNow?: boolean;
  isCompleted?: boolean;
  isPast?: boolean;
  loadLabel?: DayLoadLabel;
  onMarkDone?: (id: string) => void;
}

function getLoadColor(label?: DayLoadLabel): string {
  if (label === 'CLEAR') return '#30D158';
  if (label === 'TIGHT') return '#FFD60A';
  return '#FF453A';
}

export default function TimelineBlock({ block, index = 0, isNow, isCompleted, isPast, loadLabel, onMarkDone }: TimelineBlockProps) {
  const delay = index * 0.05;
  const taskColor = getLoadColor(loadLabel);

  if (block.type === 'wake' || block.type === 'sleep') {
    return (
      <motion.div
        className="flex items-center gap-3 py-2"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 0.5, y: 0 }}
        transition={{ duration: 0.25, delay }}
      >
        <span className="font-mono text-[13px] w-16 shrink-0" style={{ color: '#48484A' }}>
          {formatTimeDisplay(block.start)}
        </span>
        <span className="text-[13px]" style={{ color: '#48484A' }}>
          {block.name}
        </span>
      </motion.div>
    );
  }

  if (block.type === 'buffer') {
    return (
      <motion.div
        className={`flex items-center gap-3 py-1.5 ${isPast ? 'opacity-30' : ''}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: isPast ? 0.3 : 1 }}
        transition={{ duration: 0.25, delay }}
      >
        <span className="font-mono text-[13px] w-16 shrink-0" style={{ color: '#48484A' }}>
          {formatTimeDisplay(block.start)}
        </span>
        <div className="flex-1 flex items-center gap-2">
          <div className="flex-1 h-px" style={{ backgroundColor: '#2C2C2E' }} />
          <span className="text-[11px] shrink-0" style={{ color: '#48484A' }}>
            {block.estimatedMinutes}min
          </span>
          <div className="flex-1 h-px" style={{ backgroundColor: '#2C2C2E' }} />
        </div>
      </motion.div>
    );
  }

  if (block.type === 'dead_zone') {
    return (
      <motion.div
        className={`flex items-center gap-3 py-1.5 ${isPast ? 'opacity-30' : ''}`}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: isPast ? 0.3 : 1, y: 0 }}
        transition={{ duration: 0.25, delay }}
      >
        <span className="font-mono text-[13px] w-16 shrink-0" style={{ color: '#48484A' }}>
          {formatTimeDisplay(block.start)}
        </span>
        <div className="flex-1 pl-3 py-1" style={{ borderLeft: '2px dashed #3A3A3C' }}>
          <span className="text-[13px] italic" style={{ color: '#48484A' }}>
            {block.name} · {block.estimatedMinutes}min
          </span>
        </div>
      </motion.div>
    );
  }

  if (block.type === 'meal') {
    return (
      <motion.div
        className={`flex items-center gap-3 py-1.5 ${isPast ? 'opacity-30' : ''}`}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: isPast ? 0.3 : 1, y: 0 }}
        transition={{ duration: 0.25, delay }}
      >
        <span className="font-mono text-[13px] w-16 shrink-0" style={{ color: '#48484A' }}>
          {formatTimeDisplay(block.start)}
        </span>
        <div className="flex-1 pl-3 py-1" style={{ borderLeft: '2px solid #3A3A3C' }}>
          <span className="text-[13px]" style={{ color: '#48484A' }}>
            🍽 {block.name} · {block.estimatedMinutes}min
          </span>
        </div>
      </motion.div>
    );
  }

  const isFixed = block.type === 'fixed';
  const isTask = block.type === 'task' || block.type === 'gym';
  const emoji = block.category ? CATEGORY_EMOJIS[block.category as TaskCategory] : null;

  return (
    <motion.div
      className={`flex items-start gap-3 py-1 ${isPast ? 'opacity-[0.35]' : ''} ${isCompleted ? 'opacity-40' : ''}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: isPast ? 0.35 : isCompleted ? 0.4 : 1, y: 0 }}
      transition={{ duration: 0.25, delay }}
    >
      <span className="font-mono text-[13px] w-16 shrink-0 pt-3" style={{ color: '#48484A' }}>
        {formatTimeDisplay(block.start)}
      </span>
      <div
        className={`flex-1 rounded-card p-3.5 relative ${isNow ? 'ring-1' : ''}`}
        style={{
          backgroundColor: isFixed ? '#1C1C1E' : '#242424',
          borderLeft: `3px solid ${isFixed ? '#3A3A3C' : taskColor}`,
          ...(isNow ? { ringColor: `${taskColor}33` } : {}),
        }}
      >
        {isPast && (
          <span
            className="absolute top-3 right-3 text-[10px] font-mono font-semibold tracking-wider rounded px-1.5 py-0.5"
            style={{ backgroundColor: '#2C2C2E', color: '#48484A' }}
          >
            PASSED
          </span>
        )}
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {emoji && <span className="text-sm">{emoji}</span>}
              <span
                className={`text-[15px] truncate ${isFixed ? 'font-medium' : 'font-semibold'}`}
                style={{ color: isFixed ? '#8E8E93' : '#FFFFFF' }}
              >
                {block.name}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="font-mono text-[13px]" style={{ color: '#48484A' }}>
                {formatTimeDisplay(block.start)} – {formatTimeDisplay(block.end)}
              </span>
              <span
                className="text-[11px] rounded-pill px-2 py-0.5"
                style={{ backgroundColor: '#2C2C2E', color: '#48484A' }}
              >
                {block.estimatedMinutes}min
              </span>
            </div>
          </div>
          {isTask && onMarkDone && !isCompleted && !isPast && (
            <motion.button
              onClick={() => onMarkDone(block.id)}
              className="text-[13px] font-semibold rounded-btn px-3 py-1.5 shrink-0 ml-2"
              style={{ color: taskColor, border: `1px solid ${taskColor}33` }}
              whileTap={{ scale: 0.96 }}
            >
              Done
            </motion.button>
          )}
          {isCompleted && (
            <span style={{ color: '#30D158' }} className="text-sm">&#10003;</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
