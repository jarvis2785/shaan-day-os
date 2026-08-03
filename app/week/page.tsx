'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DayPlan } from '@/lib/types';
import { getSettings, getDayPlan, initialize } from '@/lib/storage';
import {
  DAY_NAMES,
  DAY_LABELS,
  HEAVY_DAYS,
  LOW_CAP_DAYS,
  FREE_DAYS,
} from '@/lib/constants';
import {
  getTotalFreeMinutes,
  getTotalFixedMinutes,
  getTotalWakingMinutes,
  getDayLabel,
  getDateString,
  getDayName,
} from '@/lib/schedule';

export default function WeekPage() {
  const [mounted, setMounted] = useState(false);
  const [weekData, setWeekData] = useState<
    {
      dayName: string;
      label: string;
      dateStr: string;
      fixedPercent: number;
      taskPercent: number;
      statusLabel: string;
      plan: DayPlan | null;
    }[]
  >([]);
  const router = useRouter();

  useEffect(() => {
    initialize();
    const settings = getSettings();
    const todayDayName = getDayName();
    const todayDow = DAY_NAMES.indexOf(todayDayName as typeof DAY_NAMES[number]);
    const now = Date.now();

    const data = Array.from({ length: 7 }).map((_, i) => {
      const offset = i - todayDow;
      const date = new Date(now + offset * 86400000);
      const dayName = DAY_NAMES[i];
      const dateStr = getDateString(date);
      const blocks = settings.schedule[dayName] || [];
      const wakingMin = getTotalWakingMinutes(settings.wakeTime, settings.sleepTime);
      const fixedMin = getTotalFixedMinutes(blocks);
      const plan = getDayPlan(date);
      const taskMin = plan?.analysis
        ? plan.analysis.schedule
            .filter((b) => b.type === 'task' || b.type === 'gym')
            .reduce((sum, b) => sum + b.estimatedMinutes, 0)
        : 0;

      const fixedPercent = Math.round((fixedMin / wakingMin) * 100);
      const taskPercent = Math.round((taskMin / wakingMin) * 100);

      let statusLabel = getDayLabel(dayName);
      if (plan?.state === 'locked') statusLabel = 'Locked';
      else if (plan?.state === 'analysis') statusLabel = 'Planned';

      return {
        dayName,
        label: DAY_LABELS[i],
        dateStr,
        fixedPercent,
        taskPercent,
        statusLabel,
        plan,
      };
    });

    setWeekData(data);
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-text-muted text-sm">Loading...</div>
      </div>
    );
  }

  const todayStr = getDateString();

  return (
    <div className="pb-20">
      <h1 className="font-display text-xl font-bold text-text-primary mb-6">This Week</h1>

      <div className="space-y-3">
        {weekData.map((day) => {
          const isToday = day.dateStr === todayStr;
          const labelColor =
            HEAVY_DAYS.includes(day.dayName)
              ? 'text-amber'
              : LOW_CAP_DAYS.includes(day.dayName)
                ? 'text-danger/70'
                : day.plan?.state === 'locked'
                  ? 'text-accent'
                  : FREE_DAYS.includes(day.dayName)
                    ? 'text-text-muted'
                    : 'text-text-muted';

          return (
            <button
              key={day.dayName}
              onClick={() => {
                if (isToday) router.push('/');
              }}
              className={`w-full flex items-center gap-4 bg-surface rounded-card p-4 border transition-colors ${
                isToday ? 'border-accent/20' : 'border-border'
              } ${isToday ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <span className={`text-sm font-semibold w-10 ${isToday ? 'text-accent' : 'text-text-body'}`}>
                {day.label}
              </span>

              <div className="flex-1">
                <div className="flex gap-[1px] h-2.5 rounded-sm overflow-hidden bg-bg">
                  {day.fixedPercent > 0 && (
                    <div
                      className="bg-[#2A2A2A] h-full"
                      style={{ width: `${day.fixedPercent}%` }}
                    />
                  )}
                  {day.taskPercent > 0 && (
                    <div
                      className="bg-accent h-full"
                      style={{ width: `${day.taskPercent}%` }}
                    />
                  )}
                </div>
              </div>

              <span className={`text-xs font-medium w-20 text-right ${labelColor}`}>
                {day.statusLabel || '—'}
              </span>

              {isToday ? (
                <span className="text-text-muted text-xs">→</span>
              ) : !day.plan ? (
                <span className="text-text-muted text-xs opacity-0">→</span>
              ) : (
                <span className="text-accent text-xs">&#10003;</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
