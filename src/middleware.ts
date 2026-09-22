import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, readSessionToken } from '@/auth/session';

/**
 * Server-side route protection.
 *
 * The rules, and why each one is what it is:
 *
 * - `/dashboard` needs a session of some kind. Visitor mode is a session, so a
 *   visitor gets in: the brief asks that the platform be browsable without an
 *   account, and what a visitor may then do is decided by the permission table
 *   rather than by which pages exist.
 * - `/account` needs an account, so a visitor is sent to the access portal.
 * - `/admin` needs the administrator role.
 * - `/login` lets a visitor through, because that is where Create Account is.
 *   Only a real account is bounced onwards.
 *
 * This is the first of two checks, not the only one: every page and API route
 * behind these paths asks again for itself. Middleware can be bypassed by a
 * misconfigured matcher; a route handler that checks its own caller cannot.
 */
function toLogin(request: NextRequest, target: string) {
  const login = request.nextUrl.clone();
  login.pathname = '/login';
  login.search = '';
  // Preserves the view the user asked for, so filters and drill-down in a
  // shared link survive the trip through the access portal.
  login.searchParams.set('next', target);
  return NextResponse.redirect(login);
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const session = await readSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  const here = `${pathname}${search}`;

  if (pathname.startsWith('/dashboard')) {
    if (session) return NextResponse.next();
    const response = toLogin(request, here);
    if (request.cookies.has(SESSION_COOKIE)) response.cookies.delete(SESSION_COOKIE);
    return response;
  }

  if (pathname.startsWith('/account')) {
    if (session && session.role !== 'VISITOR') return NextResponse.next();
    return toLogin(request, here);
  }

  if (pathname.startsWith('/admin')) {
    if (session?.role === 'ADMINISTRATOR') return NextResponse.next();
    if (session) {
      // Signed in, but not as an administrator. Sending them to the dashboard
      // rather than to the login page says "not you" instead of "sign in
      // again", which is the truth.
      const dashboard = request.nextUrl.clone();
      dashboard.pathname = '/dashboard';
      dashboard.search = '';
      return NextResponse.redirect(dashboard);
    }
    return toLogin(request, here);
  }

  // A signed-in account landing on the access portal or the sign-in form goes
  // straight through to where it was headed. A visitor does not: the portal is
  // how a visitor reaches Create Account.
  if ((pathname === '/login' || pathname === '/login/sign-in') && session?.role !== 'VISITOR' && session) {
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
  matcher: ['/dashboard/:path*', '/account/:path*', '/admin/:path*', '/login', '/login/sign-in'],
};
