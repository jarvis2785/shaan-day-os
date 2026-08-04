'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Task, AnalysisResult, DayState, DayPlan } from '@/lib/types';
import { buildAnalysisInput, analyzeDay } from '@/lib/analysis';
import {
  getSettings,
  getDayPlan,
  saveDayPlan,
  getDeferredTasks,
  clearDeferredTasks,
  deferTask,
  initialize,
} from '@/lib/storage';
import {
  formatDate,
  getDateString,
  getTodayBlocks,
  getFreeMinutesFromNow,
  isBeforeWakeTime,
  getISTTomorrow,
} from '@/lib/schedule';
import BottomSheet from '@/components/ui/BottomSheet';
import TaskInputView from '@/components/views/TaskInputView';
import AnalysisView from '@/components/views/AnalysisView';
import ExecutionView from '@/components/views/ExecutionView';

export default function TodayPage() {
  const [state, setState] = useState<DayState>('input');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [, setMinuteTick] = useState(0);
  const reanalysisTimer = useRef<NodeJS.Timeout | null>(null);
  const currentDateRef = useRef('');

  const loadDayState = useCallback((dateStr: string) => {
    const plan = getDayPlan();
    if (plan && plan.date === dateStr) {
      setTasks(plan.tasks);
      setAnalysis(plan.analysis);
      setState(plan.state);
      setCompletedIds(plan.completedTaskIds || []);
    } else {
      const deferred = getDeferredTasks();
      if (deferred.length > 0) {
        setTasks(deferred);
        clearDeferredTasks();
      } else {
        setTasks([]);
      }
      setAnalysis(null);
      setState('input');
      setCompletedIds([]);
    }
    setError(null);
  }, []);

  useEffect(() => {
    initialize();
    const dateStr = getDateString();
    currentDateRef.current = dateStr;
    loadDayState(dateStr);
    setMounted(true);
  }, [loadDayState]);

  useEffect(() => {
    const interval = setInterval(() => {
      const nowDate = getDateString();
      if (nowDate !== currentDateRef.current) {
        currentDateRef.current = nowDate;
        loadDayState(nowDate);
      }
      setMinuteTick((t) => t + 1);
    }, 60000);
    return () => clearInterval(interval);
  }, [loadDayState]);

  const savePlan = useCallback(
    (overrides?: Partial<DayPlan>) => {
      const plan: DayPlan = {
        date: getDateString(),
        state,
        tasks,
        analysis,
        lockedAt: state === 'locked' ? new Date().toISOString() : null,
        completedTaskIds: completedIds,
        ...overrides,
      };
      saveDayPlan(plan);
    },
    [state, tasks, analysis, completedIds]
  );

  const runAnalysis = useCallback(async (currentTasks: Task[]) => {
    const settings = getSettings();
    const input = buildAnalysisInput(settings, currentTasks);
    setError(null);

    try {
      const res = await analyzeDay(input);
      if (!res.ok) {
        throw new Error('API call failed');
      }
      const result: AnalysisResult = await res.json();
      setAnalysis(result);
      setState('analysis');
      saveDayPlan({
        date: getDateString(),
        state: 'analysis',
        tasks: currentTasks,
        analysis: result,
        lockedAt: null,
        completedTaskIds: [],
      });
    } catch {
      setError("Couldn't reach the brain. Check connection.");
    }
  }, []);

  const handleAnalyze = async () => {
    setLoading(true);
    await runAnalysis(tasks);
    setLoading(false);
  };

  const handleAddTask = () => {
    setEditTask(null);
    setSheetOpen(true);
  };

  const handleEditTask = (task: Task) => {
    setEditTask(task);
    setSheetOpen(true);
  };

  const handleSaveTask = (task: Task) => {
    let newTasks: Task[];
    if (editTask) {
      newTasks = tasks.map((t) => (t.id === task.id ? task : t));
    } else {
      newTasks = [...tasks, task];
    }
    setTasks(newTasks);
    savePlan({ tasks: newTasks });

    if (state === 'analysis' && analysis) {
      if (reanalysisTimer.current) clearTimeout(reanalysisTimer.current);
      setReanalyzing(true);
      reanalysisTimer.current = setTimeout(async () => {
        await runAnalysis(newTasks);
        setReanalyzing(false);
      }, 800);
    }
  };

  const handleDeleteTask = (id: string) => {
    const newTasks = tasks.filter((t) => t.id !== id);
    setTasks(newTasks);
    savePlan({ tasks: newTasks });

    if (state === 'analysis' && analysis && newTasks.length > 0) {
      if (reanalysisTimer.current) clearTimeout(reanalysisTimer.current);
      setReanalyzing(true);
      reanalysisTimer.current = setTimeout(async () => {
        await runAnalysis(newTasks);
        setReanalyzing(false);
      }, 800);
    } else if (newTasks.length === 0 && state === 'analysis') {
      setState('input');
      setAnalysis(null);
    }
  };

  const handleRethink = () => {
    setState('input');
    setAnalysis(null);
    savePlan({ state: 'input', analysis: null });
  };

  const handleLock = () => {
    setState('locked');
    savePlan({ state: 'locked', lockedAt: new Date().toISOString() });
  };

  const handleUnlock = () => {
    setState('input');
    setAnalysis(null);
    setCompletedIds([]);
    savePlan({ state: 'input', analysis: null, completedTaskIds: [] });
  };

  const handleMarkDone = (id: string) => {
    const newCompleted = [...completedIds, id];
    setCompletedIds(newCompleted);
    savePlan({ completedTaskIds: newCompleted });
  };

  const handleDefer = (id: string) => {
    if (!analysis) return;
    const overflowTask = analysis.overflow.find((t) => t.id === id);
    if (!overflowTask) return;
    const originalTask = tasks.find((t) => t.id === id);
    if (originalTask) {
      deferTask(originalTask, getISTTomorrow());
    }
    const newOverflow = analysis.overflow.filter((t) => t.id !== id);
    setAnalysis({ ...analysis, overflow: newOverflow });
  };

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#111111' }}>
        <div className="text-[15px]" style={{ color: '#48484A' }}>Loading...</div>
      </div>
    );
  }

  const settings = getSettings();
  const blocks = getTodayBlocks(settings);
  const freeMinutes = getFreeMinutesFromNow(settings.wakeTime, settings.sleepTime, blocks);
  const beforeWake = isBeforeWakeTime(settings.wakeTime);

  return (
    <div className="pb-24">
      <motion.div
        className="flex items-center justify-between mb-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <span className="text-[15px] font-medium" style={{ color: '#8E8E93' }}>DayOS</span>
        <div className="flex items-center gap-3">
          <span className="text-[15px]" style={{ color: '#8E8E93' }}>{formatDate()}</span>
          {state === 'locked' && (
            <span
              className="text-[10px] font-bold px-2 py-1 rounded-pill tracking-wider"
              style={{ backgroundColor: 'rgba(48, 209, 88, 0.1)', color: '#30D158' }}
            >
              LOCKED
            </span>
          )}
        </div>
      </motion.div>

      {error && (
        <motion.div
          className="rounded-card p-4 mb-6"
          style={{
            backgroundColor: 'rgba(255, 69, 58, 0.08)',
            border: '1px solid rgba(255, 69, 58, 0.2)',
          }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="text-[15px] mb-2" style={{ color: '#FF453A' }}>{error}</p>
          <button
            onClick={handleAnalyze}
            className="text-[13px] font-semibold underline"
            style={{ color: '#FF453A' }}
          >
            Retry
          </button>
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        {state === 'input' && (
          <motion.div
            key="input"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <TaskInputView
              fixedBlocks={blocks}
              freeMinutes={freeMinutes}
              tasks={tasks}
              onAddTask={handleAddTask}
              onEditTask={handleEditTask}
              onDeleteTask={handleDeleteTask}
              onAnalyze={handleAnalyze}
              loading={loading}
              isBeforeWake={beforeWake}
            />
          </motion.div>
        )}

        {state === 'analysis' && analysis && (
          <motion.div
            key="analysis"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <AnalysisView
              analysis={analysis}
              wakeTime={settings.wakeTime}
              sleepTime={settings.sleepTime}
              onRethink={handleRethink}
              onLock={handleLock}
              onDefer={handleDefer}
              reanalyzing={reanalyzing}
            />
          </motion.div>
        )}

        {state === 'locked' && analysis && (
          <motion.div
            key="locked"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <ExecutionView
              analysis={analysis}
              completedIds={completedIds}
              onMarkDone={handleMarkDone}
              onUnlock={handleUnlock}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSave={handleSaveTask}
        editTask={editTask}
      />
    </div>
  );
}
