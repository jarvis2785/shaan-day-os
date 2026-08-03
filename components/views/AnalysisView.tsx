'use client';

import { AnalysisResult, Task } from '@/lib/types';
import CapacityBar from '@/components/ui/CapacityBar';
import DayLoadScore from '@/components/ui/DayLoadScore';
import MentorCard from '@/components/ui/MentorCard';
import TimelineBlock from '@/components/ui/TimelineBlock';
import OverflowCard from '@/components/ui/OverflowCard';

interface AnalysisViewProps {
  analysis: AnalysisResult;
  wakeTime: string;
  sleepTime: string;
  onRethink: () => void;
  onLock: () => void;
  onDefer: (id: string) => void;
  reanalyzing: boolean;
}

export default function AnalysisView({
  analysis,
  wakeTime,
  sleepTime,
  onRethink,
  onLock,
  onDefer,
  reanalyzing,
}: AnalysisViewProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <div className="text-xs text-text-muted font-semibold tracking-wider mb-3">DAY CAPACITY</div>
        <CapacityBar
          wakeTime={wakeTime}
          sleepTime={sleepTime}
          schedule={analysis.schedule}
          loading={reanalyzing}
        />
      </div>

      <DayLoadScore percent={analysis.dayLoadPercent} label={analysis.dayLoadLabel} />

      <div className="flex items-center justify-center gap-6 text-xs text-text-muted">
        <span>Free: {analysis.stats.freeTimeAvailable}</span>
        <span className="text-border">|</span>
        <span>Tasks: {analysis.stats.estimatedTaskTime} est</span>
      </div>

      <MentorCard assessment={analysis.mentorAssessment} />

      <div>
        <h2 className="text-xs text-text-muted font-semibold tracking-wider mb-3">
          TODAY&apos;S SCHEDULE
        </h2>
        <div className="space-y-1">
          {analysis.schedule.map((block) => (
            <TimelineBlock key={block.id} block={block} />
          ))}
        </div>
      </div>

      {analysis.overflow.length > 0 && (
        <div>
          <h2 className="text-xs text-danger font-semibold tracking-wider mb-3">
            DIDN&apos;T MAKE THE CUT
          </h2>
          <div className="space-y-2">
            {analysis.overflow.map((task) => (
              <OverflowCard key={task.id} task={task} onDefer={onDefer} />
            ))}
          </div>
        </div>
      )}

      {analysis.warnings.length > 0 && (
        <div className="space-y-2">
          {analysis.warnings.map((w, i) => (
            <div key={i} className="text-xs text-amber bg-amber/5 rounded-btn px-3 py-2 border border-amber/10">
              {w}
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          onClick={onRethink}
          className="flex-1 py-3.5 rounded-btn border border-border text-text-body text-sm font-medium hover:border-text-muted transition-colors"
        >
          Rethink
        </button>
        <button
          onClick={onLock}
          className="flex-1 py-3.5 rounded-btn bg-accent text-bg text-sm font-semibold active:scale-[0.98] transition-transform"
        >
          Lock Day
        </button>
      </div>
    </div>
  );
}
