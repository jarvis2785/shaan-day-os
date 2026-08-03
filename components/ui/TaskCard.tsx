'use client';

import { Task, CATEGORY_LABELS, CATEGORY_EMOJIS, DEADLINE_LABELS, PRIORITY_LABELS } from '@/lib/types';

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
}

export default function TaskCard({ task, onEdit, onDelete }: TaskCardProps) {
  const priorityColor =
    task.priority === 'high'
      ? 'text-danger'
      : task.priority === 'medium'
        ? 'text-amber'
        : 'text-text-muted';

  return (
    <div
      className="bg-surface rounded-card p-4 border border-border active:scale-[0.98] transition-transform cursor-pointer"
      onClick={() => onEdit(task)}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base">{CATEGORY_EMOJIS[task.category]}</span>
            <span className="text-text-primary font-medium text-sm truncate">
              {task.name}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-text-muted">{CATEGORY_LABELS[task.category]}</span>
            <span className="text-text-muted">{DEADLINE_LABELS[task.deadline]}</span>
            <span className={`font-semibold ${priorityColor}`}>
              {PRIORITY_LABELS[task.priority]}
            </span>
          </div>
          {task.estimatedMinutes && (
            <div className="text-xs text-text-muted mt-1 font-mono">
              ~{task.estimatedMinutes}min
            </div>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(task.id);
          }}
          className="text-text-muted hover:text-danger transition-colors p-1 -mr-1 -mt-1"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
