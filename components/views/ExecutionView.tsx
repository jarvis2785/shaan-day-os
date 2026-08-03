'use client';

import { AnalysisResult, ScheduleBlock } from '@/lib/types';
import { timeToMinutes, formatTimeDisplay } from '@/lib/schedule';
import TimelineBlock from '@/components/ui/TimelineBlock';

interface ExecutionViewProps {
  analysis: AnalysisResult;
  completedIds: string[];
  onMarkDone: (id: string) => void;
  onUnlock: () => void;
}

function getCurrentBlock(schedule: ScheduleBlock[]): ScheduleBlock | null {
  const now = new Date();
  const currentMin = now.getHours() * 60 + now.getMinutes();
  for (const block of schedule) {
    const start = timeToMinutes(block.start);
    const end = timeToMinutes(block.end);
    if (currentMin >= start && currentMin < end) {
      return block;
    }
  }
  return null;
}

function getUpcomingBlocks(schedule: ScheduleBlock[], completedIds: string[]): ScheduleBlock[] {
  const now = new Date();
  const currentMin = now.getHours() * 60 + now.getMinutes();
  return schedule.filter((b) => {
    const start = timeToMinutes(b.start);
    return start > currentMin && !completedIds.includes(b.id) && b.type !== 'wake' && b.type !== 'sleep';
  });
}

export default function ExecutionView({ analysis, completedIds, onMarkDone, onUnlock }: ExecutionViewProps) {
  const currentBlock = getCurrentBlock(analysis.schedule);
  const upcoming = getUpcomingBlocks(analysis.schedule, completedIds);
  const completed = analysis.schedule.filter(
    (b) => completedIds.includes(b.id) || (b.type !== 'wake' && b.type !== 'sleep' && b.type !== 'buffer' && timeToMinutes(b.end) <= new Date().getHours() * 60 + new Date().getMinutes() && !upcoming.includes(b) && b !== currentBlock)
  );

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center">
        <div className="text-xs text-text-muted font-medium tracking-wider">NOW</div>
        <div className="font-display text-2xl font-bold text-text-primary mt-1">{timeStr}</div>
      </div>

      {currentBlock && (
        <div className="bg-surface rounded-card p-4 border border-accent/20 ring-1 ring-accent/10">
          <div className="text-sm font-medium text-text-primary mb-1">{currentBlock.name}</div>
          <div className="font-mono text-xs text-text-muted mb-3">
            ends at {formatTimeDisplay(currentBlock.end)}
          </div>
          {(currentBlock.type === 'task' || currentBlock.type === 'gym') && !completedIds.includes(currentBlock.id) && (
            <button
              onClick={() => onMarkDone(currentBlock.id)}
              className="w-full py-2.5 rounded-btn bg-accent text-bg text-sm font-semibold active:scale-[0.98] transition-transform"
            >
              Mark as Done
            </button>
          )}
        </div>
      )}

      {upcoming.length > 0 && (
        <div>
          <h2 className="text-xs text-text-muted font-semibold tracking-wider mb-3">NEXT UP</h2>
          <div className="space-y-1">
            {upcoming.slice(0, 6).map((block) => (
              <TimelineBlock
                key={block.id}
                block={block}
                onMarkDone={onMarkDone}
              />
            ))}
          </div>
        </div>
      )}

      {completed.length > 0 && (
        <div>
          <h2 className="text-xs text-text-muted font-semibold tracking-wider mb-3">COMPLETED</h2>
          <div className="flex flex-wrap gap-2">
            {completed.map((block) => (
              <div
                key={block.id}
                className="text-xs text-accent bg-accent/5 border border-accent/10 rounded-pill px-3 py-1.5"
              >
                &#10003; {block.name}
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={onUnlock}
        className="w-full py-3.5 rounded-btn border border-danger/30 text-danger text-sm font-medium hover:bg-danger/5 transition-colors"
      >
        Unlock &amp; Re-plan
      </button>
    </div>
  );
}
