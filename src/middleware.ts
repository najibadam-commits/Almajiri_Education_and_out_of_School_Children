import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, readSessionToken } from '@/auth/session';

/**
 * Server-side route protection.
 *
 * `/dashboard` is gated here rather than by hiding it in the browser, so an
 * unauthenticated request never reaches the page at all. When a real identity
 * provider is connected, this file keeps working as-is: it only asks whether
 * the session cookie verifies.
 */
export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const session = await readSessionToken(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname.startsWith('/dashboard')) {
    if (session) return NextResponse.next();

    const login = request.nextUrl.clone();
    login.pathname = '/login';
    login.search = '';
    // Preserves the view the user asked for, so that filters and drill-down
    // in a shared link survive the trip through the login page.
    login.searchParams.set('next', `${pathname}${search}`);
    const response = NextResponse.redirect(login);
    if (request.cookies.has(SESSION_COOKIE)) response.cookies.delete(SESSION_COOKIE);
    return response;
  }

  // A signed-in user landing on the login page goes straight through.
  if (pathname === '/login' && session) {
    const next = request.nextUrl.searchParams.get('next');
    const target = request.nextUrl.clone();
    target.search = '';
    if (next && next.startsWith('/') && !next.startsWith('//')) {
      const parsed = new URL(next, request.nextUrl.origin);
      target.pathname = parsed.pathname;
      target.search = parsed.search;
    } else {
      target.pathname = '/dashboard';
    }
    return NextResponse.redirect(target);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/login'],
};
