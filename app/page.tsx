'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
  generateId,
} from '@/lib/storage';
import {
  formatDate,
  getDateString,
  getTodayBlocks,
  getFreeMinutesFromNow,
  getDayName,
  isBeforeWakeTime,
  getISTTomorrow,
} from '@/lib/schedule';
import CapacityBar from '@/components/ui/CapacityBar';
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
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-text-muted text-sm">Loading...</div>
      </div>
    );
  }

  const settings = getSettings();
  const blocks = getTodayBlocks(settings);
  const freeMinutes = getFreeMinutesFromNow(settings.wakeTime, settings.sleepTime, blocks);
  const beforeWake = isBeforeWakeTime(settings.wakeTime);

  return (
    <div className="pb-20">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-xl font-bold text-text-primary">DayOS</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-text-body">{formatDate()}</span>
          {state === 'locked' && (
            <span className="text-[10px] font-bold text-accent bg-accent/10 px-2 py-1 rounded-pill tracking-wider">
              LOCKED
            </span>
          )}
          {state === 'analysis' && (
            <button
              onClick={handleRethink}
              className="text-text-muted hover:text-text-body transition-colors"
              title="Edit"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {(state === 'analysis' || state === 'locked') && analysis && (
        <div className="mb-6">
          <CapacityBar
            wakeTime={settings.wakeTime}
            sleepTime={settings.sleepTime}
            schedule={analysis.schedule}
            loading={reanalyzing || loading}
          />
        </div>
      )}

      {error && (
        <div className="bg-danger/10 border border-danger/20 rounded-card p-4 mb-6">
          <p className="text-sm text-danger mb-2">{error}</p>
          <button
            onClick={handleAnalyze}
            className="text-xs text-danger font-semibold underline"
          >
            Retry
          </button>
        </div>
      )}

      {state === 'input' && (
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
      )}

      {state === 'analysis' && analysis && (
        <AnalysisView
          analysis={analysis}
          wakeTime={settings.wakeTime}
          sleepTime={settings.sleepTime}
          onRethink={handleRethink}
          onLock={handleLock}
          onDefer={handleDefer}
          reanalyzing={reanalyzing}
        />
      )}

      {state === 'locked' && analysis && (
        <ExecutionView
          analysis={analysis}
          completedIds={completedIds}
          onMarkDone={handleMarkDone}
          onUnlock={handleUnlock}
        />
      )}

      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSave={handleSaveTask}
        editTask={editTask}
      />
    </div>
  );
}
