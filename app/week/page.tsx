'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { DayPlan } from '@/lib/types';
import { getSettings, getDayPlan } from '@/lib/storage';
import { useApp } from '@/components/providers/AppProvider';
import { DAY_NAMES, DAY_LABELS } from '@/lib/constants';
import {
  getTotalFixedMinutes,
  getTotalWakingMinutes,
  getDayLabel,
  getDayProfile,
  getDateString,
  getDayName,
} from '@/lib/schedule';
import { UserSettings } from '@/lib/types';

function getStatusColor(label: string, dayName: string, plan: DayPlan | null, settings: UserSettings): string {
  if (plan?.state === 'locked') return '#30D158';
  if (plan?.state === 'analysis') return '#FFD60A';
  const profile = getDayProfile(dayName, settings);
  if (profile === 'heavy') return '#FFD60A';
  if (profile === 'low-capacity') return '#FF453A';
  return '#48484A';
}

function getMiniRingPercent(fixedPercent: number, taskPercent: number): number {
  return Math.min(fixedPercent + taskPercent, 100);
}

function getMiniRingColor(percent: number): string {
  if (percent <= 60) return '#30D158';
  if (percent <= 85) return '#FFD60A';
  return '#FF453A';
}

export default function WeekPage() {
  const { ready } = useApp();
  const [mounted, setMounted] = useState(false);
  const [settings, setSettingsState] = useState<UserSettings | null>(null);
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
    if (!ready) return;
    const settings = getSettings();
    setSettingsState(settings);
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

      let statusLabel = getDayLabel(dayName, settings);
      if (plan?.state === 'locked') statusLabel = 'Locked';
      else if (plan?.state === 'analysis') statusLabel = 'Planned';

      return { dayName, label: DAY_LABELS[i], dateStr, fixedPercent, taskPercent, statusLabel, plan };
    });

    setWeekData(data);
    setMounted(true);
  }, [ready]);

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#111111' }}>
        <div className="text-[15px]" style={{ color: '#48484A' }}>Loading...</div>
      </div>
    );
  }

  const todayStr = getDateString();

  return (
    <div className="pb-24">
      <div className="text-[11px] font-semibold tracking-[0.15em] uppercase mb-5" style={{ color: '#48484A' }}>
        THIS WEEK
      </div>

      <div className="space-y-2">
        {weekData.map((day, i) => {
          const isToday = day.dateStr === todayStr;
          const ringPercent = getMiniRingPercent(day.fixedPercent, day.taskPercent);
          const ringColor = getMiniRingColor(ringPercent);
          const statusColor = getStatusColor(day.statusLabel, day.dayName, day.plan, settings!);

          const size = 32;
          const sw = 3;
          const r = (size - sw) / 2;
          const circ = 2 * Math.PI * r;
          const filled = circ * (ringPercent / 100);

          return (
            <motion.button
              key={day.dayName}
              onClick={() => { if (isToday) router.push('/'); }}
              className="w-full flex items-center gap-4 rounded-card p-4"
              style={{
                backgroundColor: '#1C1C1E',
                ...(isToday ? { boxShadow: `inset 0 0 0 1px rgba(48, 209, 88, 0.15)` } : {}),
              }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.05 }}
              whileTap={isToday ? { scale: 0.98 } : {}}
            >
              <span
                className="text-[15px] font-semibold w-10"
                style={{ color: isToday ? '#30D158' : '#8E8E93' }}
              >
                {day.label}
              </span>

              <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
                <circle
                  cx={size / 2} cy={size / 2} r={r}
                  fill="none" stroke="#2C2C2E" strokeWidth={sw}
                />
                <circle
                  cx={size / 2} cy={size / 2} r={r}
                  fill="none" stroke={ringColor} strokeWidth={sw}
                  strokeDasharray={`${filled} ${circ - filled}`}
                  strokeLinecap="round"
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
              </svg>

              <span className="flex-1" />

              <span className="text-[13px] font-medium" style={{ color: statusColor }}>
                {day.statusLabel || '—'}
              </span>

              {isToday && (
                <span style={{ color: '#48484A' }} className="text-[13px]">→</span>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
