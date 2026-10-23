'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { sanitizeRedirectPath } from '@/lib/auth';

function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    searchParams.get('error') === 'callback_failed'
      ? "That link couldn't sign you in on this device. If you just confirmed your email, you can sign in below with your password."
      : null
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) {
        setError(err.message === 'Invalid login credentials' ? 'Wrong email or password.' : err.message);
        return;
      }
      window.location.assign(sanitizeRedirectPath(searchParams.get('next')));
    } catch {
      setError('Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center px-6 pb-safe">
      <div className="max-w-sm w-full mx-auto">
        <h1 className="text-[28px] font-bold mb-2" style={{ color: '#FFFFFF' }}>DayOS</h1>
        <p className="text-[15px] mb-8" style={{ color: '#8E8E93' }}>Sign in to your account</p>

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
              style={{ backgroundColor: '#1C1C1E', color: '#FFFFFF', border: '1px solid #3A3A3C' }}
              placeholder="you@example.com" />
          </div>
          <div>
            <label className="text-[13px] font-medium block mb-1.5" style={{ color: '#8E8E93' }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
              className="w-full rounded-btn px-4 py-3 text-[16px] focus:outline-none"
              style={{ backgroundColor: '#1C1C1E', color: '#FFFFFF', border: '1px solid #3A3A3C' }}
              placeholder="••••••••" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-3.5 rounded-btn text-[16px] font-semibold disabled:opacity-50"
            style={{ backgroundColor: '#30D158', color: '#000' }}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="mt-6 text-center space-y-3">
          <Link href="/forgot-password" className="text-[14px] block" style={{ color: '#30D158' }}>Forgot password?</Link>
          <p className="text-[14px]" style={{ color: '#8E8E93' }}>
            No account?{' '}<Link href="/signup" style={{ color: '#30D158' }}>Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" style={{ backgroundColor: '#111111' }} />}>
      <LoginForm />
    </Suspense>
  );
}
