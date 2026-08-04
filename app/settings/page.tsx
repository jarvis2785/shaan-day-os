'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserSettings, FixedBlock, DeadZoneSettings } from '@/lib/types';
import { getSettings, saveSettings, initialize, generateId } from '@/lib/storage';
import { DAY_NAMES, DAY_FULL_LABELS, DEFAULT_DEAD_ZONES } from '@/lib/constants';
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
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#111111' }}>
        <div className="text-[15px]" style={{ color: '#48484A' }}>Loading...</div>
      </div>
    );
  }

  const handleTimeChange = (field: 'wakeTime' | 'sleepTime', value: string) => {
    save({ ...settings, [field]: value });
  };

  const handleGymToggle = () => {
    save({ ...settings, gym: { ...settings.gym, enabled: !settings.gym.enabled } });
  };

  const handleGymChange = (field: string, value: string | number) => {
    save({ ...settings, gym: { ...settings.gym, [field]: value } });
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
    save({ ...settings, schedule: { ...settings.schedule, [day]: dayBlocks } });
  };

  const handleUpdateBlock = (day: string, blockId: string, field: string, value: string) => {
    const dayBlocks = (settings.schedule[day] || []).map((b) =>
      b.id === blockId ? { ...b, [field]: value } : b
    );
    save({ ...settings, schedule: { ...settings.schedule, [day]: dayBlocks } });
  };

  const handleDeleteBlock = (day: string, blockId: string) => {
    const dayBlocks = (settings.schedule[day] || []).filter((b) => b.id !== blockId);
    save({ ...settings, schedule: { ...settings.schedule, [day]: dayBlocks } });
  };

  const deadZones = settings.deadZones ?? DEFAULT_DEAD_ZONES;

  const handleDeadZoneChange = (field: keyof DeadZoneSettings, value: number) => {
    save({ ...settings, deadZones: { ...deadZones, [field]: value } });
  };

  const SettingsRow = ({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) => (
    <div
      className="flex items-center justify-between p-4"
      style={{ backgroundColor: '#1C1C1E' }}
    >
      <div>
        <span className="text-[15px]" style={{ color: '#8E8E93' }}>{label}</span>
        {desc && <span className="text-[13px] block mt-0.5" style={{ color: '#48484A' }}>{desc}</span>}
      </div>
      {children}
    </div>
  );

  return (
    <div className="pb-24">
      <div className="text-[11px] font-semibold tracking-[0.15em] uppercase mb-5" style={{ color: '#48484A' }}>
        SETTINGS
      </div>

      <div className="space-y-8">
        <section>
          <div className="text-[11px] font-semibold tracking-[0.15em] uppercase mb-3" style={{ color: '#48484A' }}>
            DAILY RHYTHM
          </div>
          <div className="rounded-card overflow-hidden divide-y" style={{ borderColor: '#2C2C2E' }}>
            <SettingsRow label="Wake time">
              <input
                type="time"
                value={settings.wakeTime}
                onChange={(e) => handleTimeChange('wakeTime', e.target.value)}
                className="rounded-btn px-3 py-2 text-[15px] font-mono focus:outline-none"
                style={{ backgroundColor: '#111111', color: '#FFFFFF', border: '1px solid #2C2C2E' }}
              />
            </SettingsRow>
            <SettingsRow label="Sleep time">
              <input
                type="time"
                value={settings.sleepTime}
                onChange={(e) => handleTimeChange('sleepTime', e.target.value)}
                className="rounded-btn px-3 py-2 text-[15px] font-mono focus:outline-none"
                style={{ backgroundColor: '#111111', color: '#FFFFFF', border: '1px solid #2C2C2E' }}
              />
            </SettingsRow>
          </div>
        </section>

        <section>
          <div className="text-[11px] font-semibold tracking-[0.15em] uppercase mb-3" style={{ color: '#48484A' }}>
            GYM
          </div>
          <div className="rounded-card overflow-hidden divide-y" style={{ borderColor: '#2C2C2E' }}>
            <SettingsRow label="Gym sessions">
              <button
                onClick={handleGymToggle}
                className="w-[51px] h-[31px] rounded-full transition-colors relative"
                style={{ backgroundColor: settings.gym.enabled ? '#30D158' : '#3A3A3C' }}
              >
                <motion.div
                  className="w-[27px] h-[27px] bg-white rounded-full absolute top-[2px]"
                  animate={{ x: settings.gym.enabled ? 22 : 2 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              </button>
            </SettingsRow>
            <AnimatePresence>
              {settings.gym.enabled && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="divide-y" style={{ borderColor: '#2C2C2E' }}>
                    <SettingsRow label="Per week">
                      <select
                        value={settings.gym.frequency}
                        onChange={(e) => handleGymChange('frequency', parseInt(e.target.value))}
                        className="rounded-btn px-3 py-2 text-[15px] focus:outline-none"
                        style={{ backgroundColor: '#111111', color: '#FFFFFF', border: '1px solid #2C2C2E' }}
                      >
                        {[2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}x</option>)}
                      </select>
                    </SettingsRow>
                    <SettingsRow label="Duration">
                      <select
                        value={settings.gym.duration}
                        onChange={(e) => handleGymChange('duration', parseInt(e.target.value))}
                        className="rounded-btn px-3 py-2 text-[15px] focus:outline-none"
                        style={{ backgroundColor: '#111111', color: '#FFFFFF', border: '1px solid #2C2C2E' }}
                      >
                        {[45, 60, 75, 90, 120].map((n) => <option key={n} value={n}>{n} min</option>)}
                      </select>
                    </SettingsRow>
                    <SettingsRow label="Preferred time">
                      <select
                        value={settings.gym.preference}
                        onChange={(e) => handleGymChange('preference', e.target.value)}
                        className="rounded-btn px-3 py-2 text-[15px] focus:outline-none"
                        style={{ backgroundColor: '#111111', color: '#FFFFFF', border: '1px solid #2C2C2E' }}
                      >
                        <option value="auto">Let AI decide</option>
                        <option value="morning">Morning</option>
                        <option value="afternoon">Afternoon</option>
                        <option value="evening">Evening</option>
                      </select>
                    </SettingsRow>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        <section>
          <div className="text-[11px] font-semibold tracking-[0.15em] uppercase mb-3" style={{ color: '#48484A' }}>
            SMART SCHEDULING
          </div>
          <div className="rounded-card overflow-hidden divide-y" style={{ borderColor: '#2C2C2E' }}>
            {([
              { field: 'morningRoutine' as const, label: 'Morning routine', desc: 'Dead zone after waking' },
              { field: 'lunchDuration' as const, label: 'Lunch duration', desc: 'Time for lunch' },
              { field: 'dinnerDuration' as const, label: 'Dinner duration', desc: 'Time for dinner' },
              { field: 'gymRecovery' as const, label: 'Gym recovery', desc: 'Shower + food after gym' },
            ]).map(({ field, label, desc }) => (
              <SettingsRow key={field} label={label} desc={desc}>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={deadZones[field]}
                    onChange={(e) => handleDeadZoneChange(field, Math.max(0, parseInt(e.target.value) || 0))}
                    className="rounded-btn px-3 py-2 text-[15px] font-mono focus:outline-none w-[70px] text-right"
                    style={{ backgroundColor: '#111111', color: '#FFFFFF', border: '1px solid #2C2C2E' }}
                    min={0}
                    max={120}
                  />
                  <span className="text-[13px]" style={{ color: '#48484A' }}>min</span>
                </div>
              </SettingsRow>
            ))}
          </div>
        </section>

        <section>
          <div className="text-[11px] font-semibold tracking-[0.15em] uppercase mb-3" style={{ color: '#48484A' }}>
            WEEKLY CLASS SCHEDULE
          </div>
          <div className="space-y-1.5">
            {DAY_NAMES.map((day, idx) => {
              const blocks = settings.schedule[day] || [];
              const isExpanded = expandedDay === day;

              return (
                <div key={day} className="rounded-card overflow-hidden" style={{ backgroundColor: '#1C1C1E' }}>
                  <button
                    onClick={() => setExpandedDay(isExpanded ? null : day)}
                    className="w-full flex items-center justify-between p-4"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-[15px] font-medium capitalize" style={{ color: '#FFFFFF' }}>
                        {DAY_FULL_LABELS[idx]}
                      </span>
                      <span className="text-[13px]" style={{ color: '#48484A' }}>
                        {blocks.length} block{blocks.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <motion.svg
                      width="16" height="16" viewBox="0 0 24 24" fill="none"
                      stroke="#48484A" strokeWidth="2"
                      animate={{ rotate: isExpanded ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </motion.svg>
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        className="px-4 pb-4 space-y-3 overflow-hidden"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        {blocks.map((block) => (
                          <div key={block.id} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={block.name}
                              onChange={(e) => handleUpdateBlock(day, block.id, 'name', e.target.value)}
                              className="flex-1 rounded-btn px-3 py-2 text-[13px] focus:outline-none min-w-0"
                              style={{ backgroundColor: '#111111', color: '#FFFFFF', border: '1px solid #2C2C2E' }}
                            />
                            <input
                              type="time"
                              value={block.start}
                              onChange={(e) => handleUpdateBlock(day, block.id, 'start', e.target.value)}
                              className="rounded-btn px-2 py-2 text-[13px] font-mono focus:outline-none w-[90px]"
                              style={{ backgroundColor: '#111111', color: '#FFFFFF', border: '1px solid #2C2C2E' }}
                            />
                            <input
                              type="time"
                              value={block.end}
                              onChange={(e) => handleUpdateBlock(day, block.id, 'end', e.target.value)}
                              className="rounded-btn px-2 py-2 text-[13px] font-mono focus:outline-none w-[90px]"
                              style={{ backgroundColor: '#111111', color: '#FFFFFF', border: '1px solid #2C2C2E' }}
                            />
                            <button
                              onClick={() => handleDeleteBlock(day, block.id)}
                              className="p-1"
                              style={{ color: '#48484A' }}
                            >
                              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                                <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                              </svg>
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => handleAddBlock(day)}
                          className="text-[13px] font-medium"
                          style={{ color: '#30D158' }}
                        >
                          + Add block
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
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
