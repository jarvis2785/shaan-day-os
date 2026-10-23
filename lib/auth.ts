export function sanitizeRedirectPath(raw: string | null): string {
  if (!raw) return '/';
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/';
  try {
    const url = new URL(raw, 'http://n');
    if (url.origin !== 'http://n') return '/';
    return url.pathname + url.search;
  } catch {
    return '/';
  }
}

const AUTH_PATHS = ['/login', '/signup', '/forgot-password', '/reset-password', '/auth/callback'];

export function isAuthRoute(pathname: string): boolean {
  return AUTH_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'));
}

type RouteDecision = { action: 'next' } | { action: 'redirect'; to: string } | { action: 'unauthorized' };

export function decideRoute({ pathname, signedIn }: { pathname: string; signedIn: boolean }): RouteDecision {
  if (pathname.startsWith('/api/')) {
    return signedIn ? { action: 'next' } : { action: 'unauthorized' };
  }

  if (pathname === '/auth/callback' || pathname.startsWith('/auth/callback/')) {
    return { action: 'next' };
  }

  if (pathname === '/reset-password' || pathname.startsWith('/reset-password/')) {
    return signedIn ? { action: 'next' } : { action: 'redirect', to: '/forgot-password' };
  }

  const signedOutOnly = ['/login', '/signup', '/forgot-password'];
  if (signedOutOnly.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return signedIn ? { action: 'redirect', to: '/' } : { action: 'next' };
  }

  if (!signedIn) {
    const to = pathname === '/' ? '/login' : `/login?next=${encodeURIComponent(pathname)}`;
    return { action: 'redirect', to };
  }

  return { action: 'next' };
}
