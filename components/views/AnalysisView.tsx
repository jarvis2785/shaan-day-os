'use client';

import { motion } from 'framer-motion';
import { AnalysisResult } from '@/lib/types';
import { getISTMinutes } from '@/lib/schedule';
import CapacityBar from '@/components/ui/CapacityBar';
import DayLoadScore from '@/components/ui/DayLoadScore';
import MentorCard from '@/components/ui/MentorCard';
import TimelineBlock from '@/components/ui/TimelineBlock';
import OverflowCard from '@/components/ui/OverflowCard';

function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

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
  const currentMinutes = getISTMinutes();

  const firstActiveIdx = analysis.schedule.findIndex(
    (b) => b.type !== 'wake' && b.type !== 'sleep' && timeToMin(b.end) > currentMinutes
  );

  return (
    <div className="space-y-8">
      <DayLoadScore
        percent={analysis.dayLoadPercent}
        label={analysis.dayLoadLabel}
        loading={reanalyzing}
      />

      <motion.div
        className="flex justify-center gap-3"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        {[
          { label: 'Free', value: analysis.stats.freeTimeAvailable },
          { label: 'Tasks', value: analysis.stats.estimatedTaskTime },
          ...(analysis.stats.usableTimeAfterDeadZones
            ? [{ label: 'Usable', value: analysis.stats.usableTimeAfterDeadZones }]
            : []),
        ].map((stat) => (
          <div
            key={stat.label}
            className="px-4 py-2 rounded-btn text-center"
            style={{ backgroundColor: '#242424' }}
          >
            <div className="text-[11px] font-semibold tracking-[0.15em] uppercase" style={{ color: '#48484A' }}>
              {stat.label}
            </div>
            <div className="text-[15px] font-semibold mt-0.5" style={{ color: '#FFFFFF' }}>
              {stat.value}
            </div>
          </div>
        ))}
      </motion.div>

      <CapacityBar
        wakeTime={wakeTime}
        sleepTime={sleepTime}
        schedule={analysis.schedule}
        loading={reanalyzing}
        loadLabel={analysis.dayLoadLabel}
      />

      <MentorCard assessment={analysis.mentorAssessment} loadLabel={analysis.dayLoadLabel} />

      <div>
        <div className="text-[11px] font-semibold tracking-[0.15em] uppercase mb-3" style={{ color: '#48484A' }}>
          TODAY&apos;S SCHEDULE
        </div>
        <div className="space-y-0.5">
          {analysis.schedule.map((block, idx) => {
            const isPast =
              block.type !== 'wake' &&
              block.type !== 'sleep' &&
              timeToMin(block.end) <= currentMinutes;
            const isStartHere = idx === firstActiveIdx;
            return (
              <div key={block.id}>
                {isStartHere && (
                  <motion.div
                    className="flex items-center gap-2 pl-[76px] mb-1 mt-3"
                    initial={{ opacity: 0, scaleX: 0 }}
                    animate={{ opacity: 1, scaleX: 1 }}
                    transition={{ duration: 0.4, delay: idx * 0.05 }}
                  >
                    <span className="text-[11px] font-semibold tracking-[0.2em] shrink-0" style={{ color: '#30D158' }}>
                      NOW
                    </span>
                    <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(48, 209, 88, 0.25)' }} />
                  </motion.div>
                )}
                <TimelineBlock
                  block={block}
                  index={idx}
                  isPast={isPast}
                  loadLabel={analysis.dayLoadLabel}
                />
              </div>
            );
          })}
        </div>
      </div>

      {analysis.overflow.length > 0 && (
        <div>
          <div className="text-[11px] font-semibold tracking-[0.15em] uppercase mb-3" style={{ color: '#FF453A' }}>
            DIDN&apos;T MAKE THE CUT
          </div>
          <div className="space-y-2">
            {analysis.overflow.map((task, i) => (
              <OverflowCard key={task.id} task={task} index={i} onDefer={onDefer} />
            ))}
          </div>
        </div>
      )}

      {analysis.warnings.length > 0 && (
        <div className="space-y-2">
          {analysis.warnings.map((w, i) => (
            <div
              key={i}
              className="text-[13px] rounded-btn px-3.5 py-2.5"
              style={{
                backgroundColor: 'rgba(255, 214, 10, 0.06)',
                border: '1px solid rgba(255, 214, 10, 0.15)',
                color: '#FFD60A',
              }}
            >
              {w}
            </div>
          ))}
        </div>
      )}

      <motion.div
        className="flex gap-3 pt-2"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.8 }}
      >
        <motion.button
          onClick={onRethink}
          className="flex-1 py-3.5 rounded-btn text-[15px] font-medium"
          style={{
            backgroundColor: '#242424',
            color: '#8E8E93',
            border: '1px solid #3A3A3C',
          }}
          whileTap={{ scale: 0.96 }}
        >
          Rethink
        </motion.button>
        <motion.button
          onClick={onLock}
          className="flex-1 py-3.5 rounded-btn text-[15px] font-bold"
          style={{
            backgroundColor: analysis.dayLoadLabel === 'CLEAR' ? '#30D158'
              : analysis.dayLoadLabel === 'TIGHT' ? '#FFD60A'
              : '#FF453A',
            color: '#000000',
          }}
          whileTap={{ scale: 0.96 }}
        >
          Lock Day
        </motion.button>
      </motion.div>
    </div>
  );
}
