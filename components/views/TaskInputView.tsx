'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Task, FixedBlock } from '@/lib/types';
import { formatTimeDisplay, minutesToHoursDisplay, getCurrentTimeStr } from '@/lib/schedule';
import TaskCard from '@/components/ui/TaskCard';

interface TaskInputViewProps {
  fixedBlocks: FixedBlock[];
  freeMinutes: number;
  tasks: Task[];
  onAddTask: () => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: string) => void;
  onAnalyze: () => void;
  loading: boolean;
  isBeforeWake: boolean;
}

function getFreeTimeColor(minutes: number): string {
  if (minutes > 300) return '#30D158';
  if (minutes > 120) return '#FFD60A';
  return '#FF453A';
}

export default function TaskInputView({
  fixedBlocks,
  freeMinutes,
  tasks,
  onAddTask,
  onEditTask,
  onDeleteTask,
  onAnalyze,
  loading,
  isBeforeWake,
}: TaskInputViewProps) {
  const [now, setNow] = useState(getCurrentTimeStr());

  useEffect(() => {
    const interval = setInterval(() => setNow(getCurrentTimeStr()), 60000);
    return () => clearInterval(interval);
  }, []);

  const freeColor = getFreeTimeColor(freeMinutes);

  const highTodayCount = tasks.filter(
    (t) => t.priority === 'high' && t.deadline === 'today'
  ).length;

  return (
    <div className="space-y-8">
      <motion.div
        className="text-center py-2"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="text-[11px] font-semibold tracking-[0.15em] uppercase" style={{ color: '#48484A' }}>
          {isBeforeWake ? 'FREE TIME TODAY' : 'FREE TIME REMAINING'}
        </div>
        <motion.div
          className="text-[56px] font-extrabold leading-none mt-2"
          style={{ color: freeColor }}
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        >
          ~{minutesToHoursDisplay(freeMinutes)}
        </motion.div>
      </motion.div>

      {fixedBlocks.length > 0 && (
        <div>
          <div className="text-[11px] font-semibold tracking-[0.15em] uppercase mb-3" style={{ color: '#48484A' }}>
            TODAY&apos;S FIXED BLOCKS
          </div>
          <div className="space-y-1.5">
            {fixedBlocks.map((block, i) => (
              <motion.div
                key={block.id}
                className="rounded-btn px-4 py-3 flex items-center justify-between"
                style={{ backgroundColor: '#1C1C1E' }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.05 }}
              >
                <span className="text-[15px] truncate flex-1 mr-3" style={{ color: '#8E8E93' }}>
                  {block.name}
                </span>
                <span className="font-mono text-[13px] shrink-0" style={{ color: '#48484A' }}>
                  {formatTimeDisplay(block.start)}–{formatTimeDisplay(block.end)}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="text-[11px] font-semibold tracking-[0.15em] uppercase mb-4" style={{ color: '#48484A' }}>
          WHAT DO YOU WANT TO DO TODAY?
        </div>

        <motion.button
          onClick={onAddTask}
          className="w-full rounded-card p-4 text-[15px] text-left"
          style={{
            backgroundColor: '#1C1C1E',
            color: '#48484A',
            border: '1px dashed #2C2C2E',
          }}
          whileTap={{ scale: 0.98 }}
        >
          + Add a task...
        </motion.button>

        {tasks.length > 0 && (
          <div className="space-y-2.5 mt-4">
            {tasks.map((task, i) => (
              <TaskCard
                key={task.id}
                task={task}
                index={i}
                onEdit={onEditTask}
                onDelete={onDeleteTask}
              />
            ))}
          </div>
        )}

        {highTodayCount >= 3 && (
          <motion.div
            className="mt-4 rounded-btn px-4 py-3"
            style={{
              backgroundColor: 'rgba(255, 214, 10, 0.06)',
              border: '1px solid rgba(255, 214, 10, 0.15)',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <p className="text-[13px] leading-relaxed" style={{ color: '#FFD60A' }}>
              Everything can&apos;t be high priority. The AI will decide what actually gets scheduled first.
            </p>
          </motion.div>
        )}
      </div>

      {tasks.length > 0 && (
        <motion.button
          onClick={onAnalyze}
          disabled={loading}
          className="w-full py-4 rounded-card text-[15px] font-bold uppercase tracking-wider disabled:opacity-50"
          style={{
            backgroundColor: '#30D158',
            color: '#000000',
          }}
          animate={loading ? {} : { scale: [1, 1.01, 1] }}
          transition={loading ? {} : { duration: 2, repeat: Infinity }}
          whileTap={{ scale: 0.98 }}
        >
          {loading ? (
            <span className="animate-pulse">Reading your day...</span>
          ) : (
            'Analyze My Day →'
          )}
        </motion.button>
      )}
    </div>
  );
}
