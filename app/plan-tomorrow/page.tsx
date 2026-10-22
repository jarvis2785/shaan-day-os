'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Task } from '@/lib/types';
import { getSettings, savePlannedTasks, generateId } from '@/lib/storage';
import {
  getISTTomorrow,
  getTodayBlocks,
  getRawFreeMinutes,
  formatTimeDisplay,
  minutesToHoursDisplay,
  getDayName,
} from '@/lib/schedule';
import BottomSheet from '@/components/ui/BottomSheet';
import TaskCard from '@/components/ui/TaskCard';
import Toast from '@/components/ui/Toast';

function getFreeTimeColor(minutes: number): string {
  if (minutes > 360) return '#30D158';
  if (minutes > 180) return '#FFD60A';
  return '#FF453A';
}

export default function PlanTomorrowPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [toastVisible, setToastVisible] = useState(false);

  const tomorrow = getISTTomorrow();
  const settings = getSettings();
  const tomorrowBlocks = getTodayBlocks(settings, tomorrow);
  const freeMinutes = getRawFreeMinutes(settings.wakeTime, settings.sleepTime, tomorrowBlocks);
  const freeColor = getFreeTimeColor(freeMinutes);

  const tomorrowLabel = tomorrow.toLocaleDateString('en-US', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  const tomorrowDayName = getDayName(tomorrow);

  useEffect(() => { setMounted(true); }, []);

  const handleAddTask = () => { setEditTask(null); setSheetOpen(true); };
  const handleEditTask = (task: Task) => { setEditTask(task); setSheetOpen(true); };

  const handleSaveTask = useCallback((task: Task) => {
    setTasks((prev) =>
      editTask ? prev.map((t) => (t.id === task.id ? task : t)) : [...prev, task]
    );
  }, [editTask]);

  const handleDeleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const handleSavePlan = () => {
    savePlannedTasks(tasks, tomorrow);
    setToastVisible(true);
    setTimeout(() => router.push('/'), 1200);
  };

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#111111' }}>
        <div className="text-[15px]" style={{ color: '#48484A' }}>Loading...</div>
      </div>
    );
  }

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <motion.button
          onClick={() => router.push('/')}
          className="text-[22px] leading-none"
          style={{ color: '#8E8E93' }}
          whileTap={{ scale: 0.9 }}
        >
          ←
        </motion.button>
        <div>
          <h1 className="text-[17px] font-semibold" style={{ color: '#FFFFFF' }}>
            Plan Tomorrow
          </h1>
          <p className="text-[13px] mt-0.5" style={{ color: '#48484A' }}>
            {tomorrowLabel}
          </p>
        </div>
      </div>

      <div className="space-y-8">
        {/* Free time hero */}
        <motion.div
          className="text-center py-2"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="text-[11px] font-semibold tracking-[0.15em] uppercase" style={{ color: '#48484A' }}>
            FREE TIME TOMORROW
          </div>
          <motion.div
            className="text-[56px] font-extrabold leading-none mt-2"
            style={{ color: freeColor }}
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          >
            ~{minutesToHoursDisplay(freeMinutes)}
          </motion.div>
        </motion.div>

        {/* Tomorrow's fixed blocks */}
        {tomorrowBlocks.length > 0 && (
          <div>
            <div className="text-[11px] font-semibold tracking-[0.15em] uppercase mb-3" style={{ color: '#48484A' }}>
              TOMORROW&apos;S FIXED BLOCKS
            </div>
            <div className="space-y-1.5">
              {tomorrowBlocks.map((block, i) => (
                <motion.div
                  key={block.id}
                  className="rounded-btn px-4 py-3 flex items-center justify-between"
                  style={{ backgroundColor: '#1C1C1E' }}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.05 }}
                >
                  <span className="text-[15px] truncate flex-1 mr-3" style={{ color: '#8E8E93' }}>
                    {block.name}
                  </span>
                  <span className="font-mono text-[13px] shrink-0" style={{ color: '#48484A' }}>
                    {formatTimeDisplay(block.start)}–{formatTimeDisplay(block.end)}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Task input */}
        <div>
          <div className="text-[11px] font-semibold tracking-[0.15em] uppercase mb-4" style={{ color: '#48484A' }}>
            WHAT DO YOU WANT TO DO TOMORROW?
          </div>

          <motion.button
            onClick={handleAddTask}
            className="w-full rounded-card p-4 text-[15px] text-left"
            style={{ backgroundColor: '#1C1C1E', color: '#48484A', border: '1px dashed #2C2C2E' }}
            whileTap={{ scale: 0.98 }}
          >
            + Add a task...
          </motion.button>

          {tasks.length > 0 && (
            <div className="space-y-2.5 mt-4">
              {tasks.map((task, i) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  index={i}
                  onEdit={handleEditTask}
                  onDelete={handleDeleteTask}
                />
              ))}
            </div>
          )}
        </div>

        {/* Save button */}
        <AnimatePresence>
          {tasks.length > 0 && (
            <motion.button
              onClick={handleSavePlan}
              className="w-full py-4 rounded-card text-[15px] font-bold uppercase tracking-wider"
              style={{ backgroundColor: '#30D158', color: '#000000' }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              whileTap={{ scale: 0.98 }}
            >
              Save Tomorrow&apos;s Plan →
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSave={handleSaveTask}
        editTask={editTask}
      />

      <Toast message="Tomorrow's plan saved" visible={toastVisible} onHide={() => setToastVisible(false)} />
    </div>
  );
}
