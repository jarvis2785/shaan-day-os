import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decideRoute } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next();

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;
  const decision = decideRoute({ pathname, signedIn: !!user });

  if (decision.action === 'next') return supabaseResponse;

  if (decision.action === 'unauthorized') {
    return NextResponse.json(
      { error: 'not_signed_in', message: 'Please log in again.' },
      { status: 401 }
    );
  }

  const dest = request.nextUrl.clone();
  const parsed = new URL(decision.to, request.nextUrl.origin);
  dest.pathname = parsed.pathname;
  dest.search = parsed.search;
  return NextResponse.redirect(dest);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|manifest\\.json|icon-.*\\.png|sw\\.js).*)'],
};
