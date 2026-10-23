import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { sanitizeRedirectPath } from '@/lib/auth';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const type = searchParams.get('type');
  const defaultNext = type === 'recovery' ? '/reset-password' : '/';
  const next = sanitizeRedirectPath(searchParams.get('next') ?? defaultNext);

  if (code) {
    try {
      const supabase = createSupabaseServerClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(`${origin}${next}`);
    } catch {}
  }

  return NextResponse.redirect(`${origin}/login?error=callback_failed`);
}
