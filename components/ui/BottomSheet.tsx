'use client';

import { useState, useEffect, useRef } from 'react';
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
  const estimateAbortRef = useRef<AbortController | null>(null);

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

  const handleEstimateBlur = async () => {
    const mins = parseInt(estimatedMinutes);
    if (!name.trim() || !estimatedMinutes || isNaN(mins) || mins <= 0) return;

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
      if (!data.isRealistic) {
        setEstimateWarning(data.warning);
        setEstimateSuggested(data.suggestedMinutes);
      }
    } catch {
      // Ignore aborts and network errors
    } finally {
      setEstimateLoading(false);
    }
  };

  if (!open) return null;

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
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="absolute bottom-0 left-0 right-0 bg-surface rounded-t-2xl animate-slide-up max-h-[85vh] overflow-y-auto">
        <div className="max-w-app mx-auto p-5 pb-8">
          <div className="w-10 h-1 bg-border rounded-full mx-auto mb-5" />

          <h3 className="text-text-primary font-semibold text-base mb-5">
            {editTask ? 'Edit Task' : 'Add Task'}
          </h3>

          <div className="space-y-5">
            <div>
              <label className="text-xs text-text-muted font-medium block mb-2">TASK NAME</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="What do you need to do?"
                className="w-full bg-bg border border-border rounded-btn px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50"
                autoFocus
              />
            </div>

            <div>
              <label className="text-xs text-text-muted font-medium block mb-2">CATEGORY</label>
              <div className="flex flex-wrap gap-2">
                {categories.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    className={`text-xs px-3 py-2 rounded-pill transition-colors ${
                      category === c
                        ? 'bg-accent text-bg font-semibold'
                        : 'bg-bg text-text-body border border-border'
                    }`}
                  >
                    {CATEGORY_LABELS[c]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-text-muted font-medium block mb-2">DEADLINE</label>
              <div className="flex flex-wrap gap-2">
                {deadlines.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDeadline(d)}
                    className={`text-xs px-3 py-2 rounded-pill transition-colors ${
                      deadline === d
                        ? 'bg-accent text-bg font-semibold'
                        : 'bg-bg text-text-body border border-border'
                    }`}
                  >
                    {DEADLINE_LABELS[d]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-text-muted font-medium block mb-2">PRIORITY</label>
              <div className="flex gap-2">
                {priorities.map((p) => {
                  const color =
                    p === 'high' ? 'border-danger text-danger' :
                    p === 'medium' ? 'border-amber text-amber' :
                    'border-text-muted text-text-muted';
                  const activeColor =
                    p === 'high' ? 'bg-danger text-bg' :
                    p === 'medium' ? 'bg-amber text-bg' :
                    'bg-text-muted text-bg';
                  return (
                    <button
                      key={p}
                      onClick={() => setPriority(p)}
                      className={`text-xs px-4 py-2 rounded-pill font-semibold transition-colors border ${
                        priority === p ? activeColor : color
                      }`}
                    >
                      {p.toUpperCase()}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-xs text-text-muted font-medium block mb-2">
                ESTIMATED TIME <span className="text-text-muted/60">(optional)</span>
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
                className="w-32 bg-bg border border-border rounded-btn px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 font-mono"
              />
              {estimateLoading && (
                <p className="text-xs text-text-muted mt-2 animate-pulse">Checking estimate…</p>
              )}
              {estimateWarning && !estimateLoading && (
                <div className="mt-2 flex flex-col gap-2">
                  <p className="text-xs text-amber leading-relaxed">
                    ⚠️ {estimateWarning}
                  </p>
                  {estimateSuggested && (
                    <button
                      type="button"
                      onClick={() => {
                        setEstimatedMinutes(String(estimateSuggested));
                        setEstimateWarning(null);
                        setEstimateSuggested(null);
                      }}
                      className="self-start text-xs font-semibold px-3 py-1.5 rounded-pill bg-amber/10 border border-amber/30 text-amber hover:bg-amber/20 transition-colors"
                    >
                      Suggested: {estimateSuggested}min
                    </button>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="text-xs text-text-muted font-medium block mb-2">
                NOTES <span className="text-text-muted/60">(optional)</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any context the AI should know..."
                rows={2}
                className="w-full bg-bg border border-border rounded-btn px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 resize-none"
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={!name.trim()}
              className="w-full py-3.5 rounded-btn font-semibold text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-accent text-bg active:scale-[0.98]"
            >
              {editTask ? 'Save Changes' : 'Add Task'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
