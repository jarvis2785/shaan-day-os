'use client';

import { motion } from 'framer-motion';
import { OverflowTask } from '@/lib/types';

interface OverflowCardProps {
  task: OverflowTask;
  index?: number;
  onDefer: (id: string) => void;
}

export default function OverflowCard({ task, index = 0, onDefer }: OverflowCardProps) {
  return (
    <motion.div
      className="rounded-btn p-3.5"
      style={{
        backgroundColor: 'rgba(255, 69, 58, 0.08)',
        border: '1px solid rgba(255, 69, 58, 0.2)',
      }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.06 }}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-semibold truncate" style={{ color: '#FFFFFF' }}>
            {task.name}
          </div>
          <div className="text-[13px] mt-0.5" style={{ color: '#48484A' }}>
            {task.reason}
          </div>
        </div>
        <motion.button
          onClick={() => onDefer(task.id)}
          className="text-[13px] font-semibold rounded-btn px-3 py-1.5 shrink-0 ml-3"
          style={{ color: '#FF453A', border: '1px solid rgba(255, 69, 58, 0.3)' }}
          whileTap={{ scale: 0.96 }}
        >
          → Tomorrow
        </motion.button>
      </div>
    </motion.div>
  );
}
