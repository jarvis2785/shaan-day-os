'use client';

import { Task, FixedBlock } from '@/lib/types';
import { formatTimeDisplay, minutesToHoursDisplay } from '@/lib/schedule';
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
}: TaskInputViewProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      {fixedBlocks.length > 0 && (
        <div>
          <h2 className="text-xs text-text-muted font-semibold tracking-wider mb-3">
            TODAY&apos;S FIXED BLOCKS
          </h2>
          <div className="space-y-2">
            {fixedBlocks.map((block) => (
              <div
                key={block.id}
                className="bg-fixed-block rounded-btn px-3 py-2.5 flex items-center justify-between"
              >
                <span className="text-sm text-text-body truncate flex-1 mr-2">{block.name}</span>
                <span className="font-mono text-xs text-text-muted shrink-0">
                  {formatTimeDisplay(block.start)}–{formatTimeDisplay(block.end)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-center py-2">
        <div className="text-xs text-text-muted font-medium tracking-wider">FREE TIME AVAILABLE</div>
        <div className="font-display text-3xl font-bold text-accent mt-1">
          ~{minutesToHoursDisplay(freeMinutes)}
        </div>
      </div>

      <div className="border-t border-border pt-5">
        <h2 className="text-xs text-text-muted font-semibold tracking-wider mb-4">
          WHAT DO YOU WANT TO DO TODAY?
        </h2>

        <button
          onClick={onAddTask}
          className="w-full border border-dashed border-border rounded-card p-4 text-sm text-text-muted hover:border-accent/30 hover:text-text-body transition-colors text-left"
        >
          + Add a task...
        </button>

        {tasks.length > 0 && (
          <div className="space-y-3 mt-4">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onEdit={onEditTask}
                onDelete={onDeleteTask}
              />
            ))}
          </div>
        )}
      </div>

      {tasks.length > 0 && (
        <button
          onClick={onAnalyze}
          disabled={loading}
          className="w-full py-4 rounded-card bg-accent text-bg font-semibold text-sm transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? 'Reading your day...' : 'Analyze My Day →'}
        </button>
      )}
    </div>
  );
}
