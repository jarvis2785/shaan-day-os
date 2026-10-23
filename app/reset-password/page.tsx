'use client';

import { useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords don't match."); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) { setError(err.message); return; }
      window.location.assign('/');
    } catch {
      setError('Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center px-6 pb-safe">
      <div className="max-w-sm w-full mx-auto">
        <h1 className="text-[22px] font-bold mb-2" style={{ color: '#FFFFFF' }}>New password</h1>
        <p className="text-[15px] mb-8" style={{ color: '#8E8E93' }}>Choose a new password for your account</p>

        {error && (
          <div className="rounded-btn px-4 py-3 mb-6" style={{ backgroundColor: 'rgba(255,69,58,0.08)', border: '1px solid rgba(255,69,58,0.2)' }}>
            <p className="text-[15px]" style={{ color: '#FF453A' }}>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[13px] font-medium block mb-1.5" style={{ color: '#8E8E93' }}>New password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8}
              className="w-full rounded-btn px-4 py-3 text-[16px] focus:outline-none"
              style={{ backgroundColor: '#1C1C1E', color: '#FFFFFF', border: '1px solid #3A3A3C' }} />
          </div>
          <div>
            <label className="text-[13px] font-medium block mb-1.5" style={{ color: '#8E8E93' }}>Confirm password</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required minLength={8}
              className="w-full rounded-btn px-4 py-3 text-[16px] focus:outline-none"
              style={{ backgroundColor: '#1C1C1E', color: '#FFFFFF', border: '1px solid #3A3A3C' }} />
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-3.5 rounded-btn text-[16px] font-semibold disabled:opacity-50"
            style={{ backgroundColor: '#30D158', color: '#000' }}>
            {loading ? 'Updating...' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  );
}
