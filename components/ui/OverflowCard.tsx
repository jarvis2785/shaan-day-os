'use client';

import { OverflowTask } from '@/lib/types';

interface OverflowCardProps {
  task: OverflowTask;
  onDefer: (id: string) => void;
}

export default function OverflowCard({ task, onDefer }: OverflowCardProps) {
  return (
    <div className="bg-overflow-surface rounded-btn p-3 border border-danger/10">
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="text-sm text-text-primary font-medium truncate">{task.name}</div>
          <div className="text-xs text-text-muted mt-0.5">{task.reason}</div>
        </div>
        <button
          onClick={() => onDefer(task.id)}
          className="text-xs text-danger border border-danger/20 rounded-btn px-3 py-1.5 hover:bg-danger/10 transition-colors shrink-0 ml-3"
        >
          Tomorrow
        </button>
      </div>
    </div>
  );
}
