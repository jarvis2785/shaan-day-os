'use client';

import { ScheduleBlock } from '@/lib/types';
import { formatTimeDisplay } from '@/lib/schedule';

interface TimelineBlockProps {
  block: ScheduleBlock;
  isNow?: boolean;
  isCompleted?: boolean;
  onMarkDone?: (id: string) => void;
}

export default function TimelineBlock({ block, isNow, isCompleted, onMarkDone }: TimelineBlockProps) {
  if (block.type === 'wake' || block.type === 'sleep') {
    return (
      <div className="flex items-center gap-3 py-2 opacity-50">
        <span className="font-mono text-xs text-text-muted w-16 shrink-0">
          {formatTimeDisplay(block.start)}
        </span>
        <span className="text-xs text-text-muted">{block.name}</span>
      </div>
    );
  }

  if (block.type === 'buffer' || block.type === 'dead_zone' || block.type === 'meal') {
    const isDead = block.type === 'dead_zone';
    const isMeal = block.type === 'meal';
    return (
      <div className="flex items-center gap-3 py-1">
        <span className="font-mono text-xs text-text-muted w-16 shrink-0">
          {formatTimeDisplay(block.start)}
        </span>
        <div className={`flex-1 border-l pl-3 py-1 ${
          isDead ? 'border-amber/40 border-dashed' :
          isMeal ? 'border-text-muted/30 border-solid' :
          'border-dashed border-border'
        }`}>
          <span className={`text-xs ${isDead ? 'text-amber/70' : 'text-text-muted'}`}>
            {block.name}
          </span>
          <span className="font-mono text-xs text-text-muted ml-2">
            {block.estimatedMinutes}min
          </span>
        </div>
      </div>
    );
  }

  const isFixed = block.type === 'fixed';
  const isTask = block.type === 'task' || block.type === 'gym';

  return (
    <div
      className={`flex items-start gap-3 py-1 ${isNow ? 'animate-subtle-pulse' : ''} ${isCompleted ? 'opacity-40' : ''}`}
    >
      <span className="font-mono text-xs text-text-muted w-16 shrink-0 pt-2.5">
        {formatTimeDisplay(block.start)}
      </span>
      <div
        className={`flex-1 rounded-btn p-3 ${
          isFixed
            ? 'bg-fixed-block'
            : 'bg-mentor-surface border-l-2 border-accent'
        } ${isNow ? 'ring-1 ring-accent/30' : ''}`}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className={`text-sm font-medium ${isFixed ? 'text-text-body' : 'text-text-primary'}`}>
              {block.name}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-mono text-xs text-text-muted">
                {formatTimeDisplay(block.start)} – {formatTimeDisplay(block.end)}
              </span>
              <span className="text-xs text-text-muted bg-border rounded-pill px-2 py-0.5">
                {block.estimatedMinutes}min
              </span>
            </div>
          </div>
          {isTask && onMarkDone && !isCompleted && (
            <button
              onClick={() => onMarkDone(block.id)}
              className="text-xs font-medium text-accent border border-accent/30 rounded-btn px-3 py-1.5 hover:bg-accent/10 transition-colors"
            >
              Done
            </button>
          )}
          {isCompleted && (
            <span className="text-accent text-sm">&#10003;</span>
          )}
        </div>
      </div>
    </div>
  );
}
