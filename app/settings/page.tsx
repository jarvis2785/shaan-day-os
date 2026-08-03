'use client';

import { useState, useEffect, useCallback } from 'react';
import { UserSettings, FixedBlock } from '@/lib/types';
import { getSettings, saveSettings, initialize, generateId } from '@/lib/storage';
import { DAY_NAMES, DAY_FULL_LABELS } from '@/lib/constants';
import Toast from '@/components/ui/Toast';

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    initialize();
    setSettings(getSettings());
    setMounted(true);
  }, []);

  const save = useCallback(
    (updated: UserSettings) => {
      setSettings(updated);
      saveSettings(updated);
      setToastVisible(true);
    },
    []
  );

  if (!mounted || !settings) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-text-muted text-sm">Loading...</div>
      </div>
    );
  }

  const handleTimeChange = (field: 'wakeTime' | 'sleepTime', value: string) => {
    save({ ...settings, [field]: value });
  };

  const handleGymToggle = () => {
    save({
      ...settings,
      gym: { ...settings.gym, enabled: !settings.gym.enabled },
    });
  };

  const handleGymChange = (field: string, value: string | number) => {
    save({
      ...settings,
      gym: { ...settings.gym, [field]: value },
    });
  };

  const handleAddBlock = (day: string) => {
    const newBlock: FixedBlock = {
      id: generateId(),
      name: 'New Block',
      start: '09:00',
      end: '10:00',
      type: 'custom',
    };
    const dayBlocks = [...(settings.schedule[day] || []), newBlock];
    save({
      ...settings,
      schedule: { ...settings.schedule, [day]: dayBlocks },
    });
  };

  const handleUpdateBlock = (day: string, blockId: string, field: string, value: string) => {
    const dayBlocks = (settings.schedule[day] || []).map((b) =>
      b.id === blockId ? { ...b, [field]: value } : b
    );
    save({
      ...settings,
      schedule: { ...settings.schedule, [day]: dayBlocks },
    });
  };

  const handleDeleteBlock = (day: string, blockId: string) => {
    const dayBlocks = (settings.schedule[day] || []).filter((b) => b.id !== blockId);
    save({
      ...settings,
      schedule: { ...settings.schedule, [day]: dayBlocks },
    });
  };

  return (
    <div className="pb-20">
      <h1 className="font-display text-xl font-bold text-text-primary mb-6">Settings</h1>

      <div className="space-y-8">
        <section>
          <h2 className="text-xs text-text-muted font-semibold tracking-wider mb-4">DAILY RHYTHM</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-surface rounded-card p-4 border border-border">
              <span className="text-sm text-text-body">Wake time</span>
              <input
                type="time"
                value={settings.wakeTime}
                onChange={(e) => handleTimeChange('wakeTime', e.target.value)}
                className="bg-bg border border-border rounded-btn px-3 py-2 text-sm text-text-primary font-mono focus:outline-none focus:border-accent/50"
              />
            </div>
            <div className="flex items-center justify-between bg-surface rounded-card p-4 border border-border">
              <span className="text-sm text-text-body">Sleep time</span>
              <input
                type="time"
                value={settings.sleepTime}
                onChange={(e) => handleTimeChange('sleepTime', e.target.value)}
                className="bg-bg border border-border rounded-btn px-3 py-2 text-sm text-text-primary font-mono focus:outline-none focus:border-accent/50"
              />
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xs text-text-muted font-semibold tracking-wider mb-4">GYM</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-surface rounded-card p-4 border border-border">
              <span className="text-sm text-text-body">Gym sessions</span>
              <button
                onClick={handleGymToggle}
                className={`w-12 h-7 rounded-full transition-colors relative ${
                  settings.gym.enabled ? 'bg-accent' : 'bg-border'
                }`}
              >
                <div
                  className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-transform ${
                    settings.gym.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {settings.gym.enabled && (
              <>
                <div className="flex items-center justify-between bg-surface rounded-card p-4 border border-border">
                  <span className="text-sm text-text-body">Per week</span>
                  <select
                    value={settings.gym.frequency}
                    onChange={(e) => handleGymChange('frequency', parseInt(e.target.value))}
                    className="bg-bg border border-border rounded-btn px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/50"
                  >
                    {[2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>{n}x</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center justify-between bg-surface rounded-card p-4 border border-border">
                  <span className="text-sm text-text-body">Duration</span>
                  <select
                    value={settings.gym.duration}
                    onChange={(e) => handleGymChange('duration', parseInt(e.target.value))}
                    className="bg-bg border border-border rounded-btn px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/50"
                  >
                    {[45, 60, 75, 90, 120].map((n) => (
                      <option key={n} value={n}>{n} min</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center justify-between bg-surface rounded-card p-4 border border-border">
                  <span className="text-sm text-text-body">Preferred time</span>
                  <select
                    value={settings.gym.preference}
                    onChange={(e) => handleGymChange('preference', e.target.value)}
                    className="bg-bg border border-border rounded-btn px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/50"
                  >
                    <option value="auto">Let AI decide</option>
                    <option value="morning">Morning</option>
                    <option value="afternoon">Afternoon</option>
                    <option value="evening">Evening</option>
                  </select>
                </div>
              </>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-xs text-text-muted font-semibold tracking-wider mb-4">
            WEEKLY CLASS SCHEDULE
          </h2>
          <div className="space-y-2">
            {DAY_NAMES.map((day, idx) => {
              const blocks = settings.schedule[day] || [];
              const isExpanded = expandedDay === day;
              const dayIndex = idx === 0 ? 6 : idx - 1;

              return (
                <div key={day} className="bg-surface rounded-card border border-border overflow-hidden">
                  <button
                    onClick={() => setExpandedDay(isExpanded ? null : day)}
                    className="w-full flex items-center justify-between p-4"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-text-primary capitalize">
                        {DAY_FULL_LABELS[idx]}
                      </span>
                      <span className="text-xs text-text-muted">
                        {blocks.length} block{blocks.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#555"
                      strokeWidth="2"
                      className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3">
                      {blocks.map((block) => (
                        <div key={block.id} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={block.name}
                            onChange={(e) => handleUpdateBlock(day, block.id, 'name', e.target.value)}
                            className="flex-1 bg-bg border border-border rounded-btn px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent/50 min-w-0"
                          />
                          <input
                            type="time"
                            value={block.start}
                            onChange={(e) => handleUpdateBlock(day, block.id, 'start', e.target.value)}
                            className="bg-bg border border-border rounded-btn px-2 py-2 text-xs text-text-primary font-mono focus:outline-none focus:border-accent/50 w-[90px]"
                          />
                          <input
                            type="time"
                            value={block.end}
                            onChange={(e) => handleUpdateBlock(day, block.id, 'end', e.target.value)}
                            className="bg-bg border border-border rounded-btn px-2 py-2 text-xs text-text-primary font-mono focus:outline-none focus:border-accent/50 w-[90px]"
                          />
                          <button
                            onClick={() => handleDeleteBlock(day, block.id)}
                            className="text-text-muted hover:text-danger p-1"
                          >
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                              <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            </svg>
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => handleAddBlock(day)}
                        className="text-xs text-accent font-medium hover:underline"
                      >
                        + Add block
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <Toast message="Saved" visible={toastVisible} onHide={() => setToastVisible(false)} />
    </div>
  );
}
