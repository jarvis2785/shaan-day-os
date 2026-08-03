'use client';

import { useState, useEffect } from 'react';
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
  }, [editTask, open]);

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
                onChange={(e) => setEstimatedMinutes(e.target.value)}
                placeholder="minutes"
                className="w-32 bg-bg border border-border rounded-btn px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 font-mono"
              />
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
