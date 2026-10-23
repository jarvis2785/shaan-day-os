'use client';

import { useState } from 'react';
import Link from 'next/link';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error: err } = await supabase.auth.signUp({
        email, password,
        options: {
          data: { display_name: name },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
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
            We sent a confirmation link to <strong style={{ color: '#FFFFFF' }}>{email}</strong>
          </p>
          <p className="text-[13px] mb-6" style={{ color: '#48484A' }}>
            If the link opens in a different browser, that&apos;s fine. Your email is confirmed. Come back here and sign in.
          </p>
          <Link href="/login" className="text-[14px]" style={{ color: '#30D158' }}>Back to sign in</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col justify-center px-6 pb-safe">
      <div className="max-w-sm w-full mx-auto">
        <h1 className="text-[28px] font-bold mb-2" style={{ color: '#FFFFFF' }}>DayOS</h1>
        <p className="text-[15px] mb-8" style={{ color: '#8E8E93' }}>Create your account</p>

        {error && (
          <div className="rounded-btn px-4 py-3 mb-6" style={{ backgroundColor: 'rgba(255,69,58,0.08)', border: '1px solid rgba(255,69,58,0.2)' }}>
            <p className="text-[15px]" style={{ color: '#FF453A' }}>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[13px] font-medium block mb-1.5" style={{ color: '#8E8E93' }}>Display name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              className="w-full rounded-btn px-4 py-3 text-[16px] focus:outline-none"
              style={{ backgroundColor: '#1C1C1E', color: '#FFFFFF', border: '1px solid #3A3A3C' }} placeholder="Shaan" />
          </div>
          <div>
            <label className="text-[13px] font-medium block mb-1.5" style={{ color: '#8E8E93' }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full rounded-btn px-4 py-3 text-[16px] focus:outline-none"
              style={{ backgroundColor: '#1C1C1E', color: '#FFFFFF', border: '1px solid #3A3A3C' }} placeholder="you@example.com" />
          </div>
          <div>
            <label className="text-[13px] font-medium block mb-1.5" style={{ color: '#8E8E93' }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8}
              className="w-full rounded-btn px-4 py-3 text-[16px] focus:outline-none"
              style={{ backgroundColor: '#1C1C1E', color: '#FFFFFF', border: '1px solid #3A3A3C' }} placeholder="8+ characters" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-3.5 rounded-btn text-[16px] font-semibold disabled:opacity-50"
            style={{ backgroundColor: '#30D158', color: '#000' }}>
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-[14px]" style={{ color: '#8E8E93' }}>
            Already have an account?{' '}<Link href="/login" style={{ color: '#30D158' }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
