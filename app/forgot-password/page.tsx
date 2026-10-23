'use client';

import { useState } from 'react';
import Link from 'next/link';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      if (err) { setError(err.message); return; }
      setSent(true);
    } catch {
      setError('Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen flex flex-col justify-center px-6 pb-safe">
        <div className="max-w-sm w-full mx-auto text-center">
          <h1 className="text-[22px] font-bold mb-3" style={{ color: '#FFFFFF' }}>Check your email</h1>
          <p className="text-[15px] mb-3" style={{ color: '#8E8E93' }}>
            We sent a reset link to <strong style={{ color: '#FFFFFF' }}>{email}</strong>
          </p>
          <p className="text-[13px] mb-6" style={{ color: '#48484A' }}>
            Open the link in the same browser you used here, or it may not work.
          </p>
          <Link href="/login" className="text-[14px]" style={{ color: '#30D158' }}>Back to sign in</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col justify-center px-6 pb-safe">
      <div className="max-w-sm w-full mx-auto">
        <h1 className="text-[22px] font-bold mb-2" style={{ color: '#FFFFFF' }}>Reset password</h1>
        <p className="text-[15px] mb-8" style={{ color: '#8E8E93' }}>Enter your email to get a reset link</p>

        {error && (
          <div className="rounded-btn px-4 py-3 mb-6" style={{ backgroundColor: 'rgba(255,69,58,0.08)', border: '1px solid rgba(255,69,58,0.2)' }}>
            <p className="text-[15px]" style={{ color: '#FF453A' }}>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[13px] font-medium block mb-1.5" style={{ color: '#8E8E93' }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full rounded-btn px-4 py-3 text-[16px] focus:outline-none"
              style={{ backgroundColor: '#1C1C1E', color: '#FFFFFF', border: '1px solid #3A3A3C' }} />
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-3.5 rounded-btn text-[16px] font-semibold disabled:opacity-50"
            style={{ backgroundColor: '#30D158', color: '#000' }}>
            {loading ? 'Sending...' : 'Send reset link'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link href="/login" className="text-[14px]" style={{ color: '#30D158' }}>Back to sign in</Link>
        </div>
      </div>
    </div>
  );
}
