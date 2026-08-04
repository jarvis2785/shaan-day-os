'use client';

import { motion } from 'framer-motion';
import { Task, CATEGORY_LABELS, CATEGORY_EMOJIS, DEADLINE_LABELS, PRIORITY_LABELS } from '@/lib/types';

interface TaskCardProps {
  task: Task;
  index?: number;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
}

export default function TaskCard({ task, index = 0, onEdit, onDelete }: TaskCardProps) {
  const priorityColor =
    task.priority === 'high'
      ? '#FF453A'
      : task.priority === 'medium'
        ? '#FFD60A'
        : '#30D158';

  return (
    <motion.div
      className="rounded-card p-4 cursor-pointer"
      style={{ backgroundColor: '#1C1C1E' }}
      onClick={() => onEdit(task)}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 mb-1.5">
            <span className="text-base">{CATEGORY_EMOJIS[task.category]}</span>
            <span className="text-[15px] font-semibold truncate" style={{ color: '#FFFFFF' }}>
              {task.name}
            </span>
          </div>
          <div className="flex items-center gap-3 text-[13px]">
            <span style={{ color: '#8E8E93' }}>{CATEGORY_LABELS[task.category]}</span>
            <span style={{ color: '#48484A' }}>·</span>
            <span style={{ color: '#8E8E93' }}>{DEADLINE_LABELS[task.deadline]}</span>
            <span style={{ color: '#48484A' }}>·</span>
            <span className="font-semibold" style={{ color: priorityColor }}>
              {PRIORITY_LABELS[task.priority]}
            </span>
          </div>
          {task.estimatedMinutes && (
            <div className="font-mono text-[13px] mt-1.5" style={{ color: '#48484A' }}>
              ~{task.estimatedMinutes}min
            </div>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(task.id);
          }}
          className="p-1.5 -mr-1 -mt-1 transition-colors"
          style={{ color: '#48484A' }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </motion.div>
  );
}
