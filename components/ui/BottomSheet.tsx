'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { Task, TaskCategory, TaskDeadline, TaskPriority, CATEGORY_LABELS, DEADLINE_LABELS } from '@/lib/types';
import { generateId } from '@/lib/storage';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  onSave: (task: Task) => void;
  editTask?: Task | null;
}

const categories: TaskCategory[] = ['personal_brand', 'agency_client', 'college', 'health', 'personal'];
const deadlines: TaskDeadline[] = ['today', 'tomorrow', 'this_week', 'next_week', 'two_plus_weeks', 'none'];
const priorities: TaskPriority[] = ['high', 'medium', 'low'];

const priorityColors: Record<TaskPriority, string> = {
  high: '#FF453A',
  medium: '#FFD60A',
  low: '#30D158',
};

export default function BottomSheet({ open, onClose, onSave, editTask }: BottomSheetProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<TaskCategory>('personal_brand');
  const [deadline, setDeadline] = useState<TaskDeadline>('today');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [estimatedMinutes, setEstimatedMinutes] = useState('');
  const [notes, setNotes] = useState('');
  const [estimateWarning, setEstimateWarning] = useState<string | null>(null);
  const [estimateSuggested, setEstimateSuggested] = useState<number | null>(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [bottomOffset, setBottomOffset] = useState(0);
  const estimateAbortRef = useRef<AbortController | null>(null);
  const dragControls = useDragControls();

  useEffect(() => {
    if (editTask) {
      setName(editTask.name);
      setCategory(editTask.category);
      setDeadline(editTask.deadline);
      setPriority(editTask.priority);
      setEstimatedMinutes(editTask.estimatedMinutes?.toString() || '');
      setNotes(editTask.notes || '');
    } else {
      setName('');
      setCategory('personal_brand');
      setDeadline('today');
      setPriority('medium');
      setEstimatedMinutes('');
      setNotes('');
    }
    setEstimateWarning(null);
    setEstimateSuggested(null);
  }, [editTask, open]);

  // Keyboard avoidance via visualViewport (iOS PWA)
  useEffect(() => {
    if (!open) {
      setBottomOffset(0);
      return;
    }
    const vv = window.visualViewport;
    if (!vv) return;

    const handleResize = () => {
      const keyboardHeight = window.innerHeight - vv.height - vv.pageTop;
      setBottomOffset(Math.max(0, keyboardHeight));
    };

    vv.addEventListener('resize', handleResize);
    vv.addEventListener('scroll', handleResize);
    return () => {
      vv.removeEventListener('resize', handleResize);
      vv.removeEventListener('scroll', handleResize);
    };
  }, [open]);

  const handleEstimateBlur = async () => {
    const mins = parseInt(estimatedMinutes);
    console.log('[Estimate] blur fired', { name: name.trim(), category, estimatedMinutes, mins });
    if (!name.trim() || !estimatedMinutes || isNaN(mins) || mins <= 0) {
      console.log('[Estimate] skipped — guard failed', { hasName: !!name.trim(), estimatedMinutes, mins });
      return;
    }

    estimateAbortRef.current?.abort();
    const controller = new AbortController();
    estimateAbortRef.current = controller;

    setEstimateLoading(true);
    setEstimateWarning(null);
    setEstimateSuggested(null);

    try {
      const res = await fetch('/api/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskName: name.trim(), category, estimatedMinutes: mins }),
        signal: controller.signal,
      });
      const data = await res.json();
      console.log('[Estimate] response', data);
      if (!data.isRealistic) {
        setEstimateWarning(data.warning);
        setEstimateSuggested(data.suggestedMinutes);
      }
    } catch (err) {
      console.log('[Estimate] error', err);
    } finally {
      setEstimateLoading(false);
    }
  };

  const handleSubmit = () => {
    if (!name.trim()) return;
    const task: Task = {
      id: editTask?.id || generateId(),
      name: name.trim(),
      category,
      deadline,
      priority,
      estimatedMinutes: estimatedMinutes ? parseInt(estimatedMinutes) : null,
      notes: notes.trim() || null,
    };
    onSave(task);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[60]"
          style={{ touchAction: 'none' }}
        >
          {/* Backdrop — dismiss on tap */}
          <motion.div
            className="absolute inset-0"
            style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Sheet — position shifts up when keyboard opens */}
          <motion.div
            className="absolute left-0 right-0 flex flex-col"
            style={{
              bottom: bottomOffset,
              transition: 'bottom 0.25s ease-out',
              backgroundColor: '#1C1C1E',
              borderRadius: '20px 20px 0 0',
              maxHeight: '88vh',
            }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0, bottom: 0.25 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 80 || info.velocity.y > 500) onClose();
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle — only this area triggers drag-to-dismiss */}
            <div
              className="flex-shrink-0 flex justify-center items-center"
              style={{ height: 44, touchAction: 'none', cursor: 'grab' }}
              onPointerDown={(e) => dragControls.start(e)}
            >
              <div className="w-10 h-1 rounded-full" style={{ backgroundColor: '#3A3A3C' }} />
            </div>

            {/* Scrollable content area — pan-y allows native scroll, never triggers drag */}
            <div
              className="overflow-y-auto flex-1"
              style={{
                WebkitOverflowScrolling: 'touch',
                touchAction: 'pan-y',
                overscrollBehavior: 'contain',
                paddingBottom: 'env(safe-area-inset-bottom)',
              }}
            >
              <div className="max-w-app mx-auto px-5 pb-8">
                <h3 className="text-[15px] font-semibold mb-5" style={{ color: '#FFFFFF' }}>
                  {editTask ? 'Edit Task' : 'Add Task'}
                </h3>

                <div className="space-y-5">
                  <div>
                    <label className="text-[11px] font-semibold tracking-[0.15em] uppercase block mb-2" style={{ color: '#48484A' }}>
                      TASK NAME
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="What do you need to do?"
                      className="w-full rounded-btn px-4 py-3 text-[15px] focus:outline-none"
                      style={{
                        backgroundColor: '#111111',
                        color: '#FFFFFF',
                        border: '1px solid #2C2C2E',
                      }}
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold tracking-[0.15em] uppercase block mb-2" style={{ color: '#48484A' }}>
                      CATEGORY
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {categories.map((c) => (
                        <motion.button
                          key={c}
                          onClick={() => setCategory(c)}
                          className="text-[13px] px-3.5 py-2 rounded-pill font-medium"
                          style={{
                            backgroundColor: category === c ? '#30D158' : '#111111',
                            color: category === c ? '#000000' : '#8E8E93',
                            border: category === c ? 'none' : '1px solid #2C2C2E',
                          }}
                          whileTap={{ scale: 0.96 }}
                        >
                          {CATEGORY_LABELS[c]}
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold tracking-[0.15em] uppercase block mb-2" style={{ color: '#48484A' }}>
                      DEADLINE
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {deadlines.map((d) => (
                        <motion.button
                          key={d}
                          onClick={() => setDeadline(d)}
                          className="text-[13px] px-3.5 py-2 rounded-pill font-medium"
                          style={{
                            backgroundColor: deadline === d ? '#30D158' : '#111111',
                            color: deadline === d ? '#000000' : '#8E8E93',
                            border: deadline === d ? 'none' : '1px solid #2C2C2E',
                          }}
                          whileTap={{ scale: 0.96 }}
                        >
                          {DEADLINE_LABELS[d]}
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold tracking-[0.15em] uppercase block mb-2" style={{ color: '#48484A' }}>
                      PRIORITY
                    </label>
                    <div className="flex gap-2">
                      {priorities.map((p) => (
                        <motion.button
                          key={p}
                          onClick={() => setPriority(p)}
                          className="text-[13px] px-4 py-2 rounded-pill font-semibold"
                          style={{
                            backgroundColor: priority === p ? priorityColors[p] : 'transparent',
                            color: priority === p ? '#000000' : priorityColors[p],
                            border: `1px solid ${priority === p ? priorityColors[p] : priorityColors[p] + '55'}`,
                          }}
                          whileTap={{ scale: 0.96 }}
                        >
                          {p.toUpperCase()}
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold tracking-[0.15em] uppercase block mb-2" style={{ color: '#48484A' }}>
                      ESTIMATED TIME <span style={{ opacity: 0.5 }}>(optional)</span>
                    </label>
                    <input
                      type="number"
                      value={estimatedMinutes}
                      onChange={(e) => {
                        setEstimatedMinutes(e.target.value);
                        setEstimateWarning(null);
                        setEstimateSuggested(null);
                      }}
                      onBlur={handleEstimateBlur}
                      placeholder="minutes"
                      className="w-32 rounded-btn px-4 py-3 text-[15px] font-mono focus:outline-none"
                      style={{
                        backgroundColor: '#111111',
                        color: '#FFFFFF',
                        border: '1px solid #2C2C2E',
                      }}
                    />
                    {estimateLoading && (
                      <p className="text-[13px] mt-2 animate-pulse" style={{ color: '#48484A' }}>
                        Checking estimate...
                      </p>
                    )}
                    <AnimatePresence>
                      {estimateWarning && !estimateLoading && (
                        <motion.div
                          className="mt-2 flex flex-col gap-2"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                        >
                          <p className="text-[13px] leading-relaxed" style={{ color: '#FFD60A' }}>
                            {estimateWarning}
                          </p>
                          {estimateSuggested && (
                            <motion.button
                              type="button"
                              onClick={() => {
                                setEstimatedMinutes(String(estimateSuggested));
                                setEstimateWarning(null);
                                setEstimateSuggested(null);
                              }}
                              className="self-start text-[13px] font-semibold px-3 py-1.5 rounded-pill"
                              style={{
                                backgroundColor: 'rgba(255, 214, 10, 0.1)',
                                border: '1px solid rgba(255, 214, 10, 0.3)',
                                color: '#FFD60A',
                              }}
                              whileTap={{ scale: 0.96 }}
                            >
                              Suggested: {estimateSuggested}min
                            </motion.button>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold tracking-[0.15em] uppercase block mb-2" style={{ color: '#48484A' }}>
                      NOTES <span style={{ opacity: 0.5 }}>(optional)</span>
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Any context the AI should know..."
                      rows={2}
                      className="w-full rounded-btn px-4 py-3 text-[15px] focus:outline-none resize-none"
                      style={{
                        backgroundColor: '#111111',
                        color: '#FFFFFF',
                        border: '1px solid #2C2C2E',
                      }}
                    />
                  </div>

                  <motion.button
                    onClick={handleSubmit}
                    disabled={!name.trim()}
                    className="w-full py-3.5 rounded-btn font-bold text-[15px] uppercase tracking-wider disabled:opacity-30 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: '#30D158',
                      color: '#000000',
                    }}
                    whileTap={{ scale: 0.96 }}
                  >
                    {editTask ? 'Save Changes' : 'Add Task'}
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
