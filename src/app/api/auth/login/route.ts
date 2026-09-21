import { NextResponse } from 'next/server';
import { authService } from '@/auth/authService';
import {
  REMEMBERED_TTL_SECONDS,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSessionToken,
  sessionCookieOptions,
} from '@/auth/session';

interface LoginBody {
  username?: unknown;
  password?: unknown;
  remember?: unknown;
}

export async function POST(request: Request) {
  let body: LoginBody;
  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  const username = typeof body.username === 'string' ? body.username : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const remember = body.remember === true;

  if (!username.trim()) {
    return NextResponse.json(
      { error: 'Please enter your email address or username.' },
      { status: 400 },
    );
  }
  if (!password) {
    return NextResponse.json({ error: 'Please enter your password.' }, { status: 400 });
  }

  const result = await authService.signIn({ username, password, remember });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 401 });
  }

  const maxAge = remember ? REMEMBERED_TTL_SECONDS : SESSION_TTL_SECONDS;
  const token = await createSessionToken(result.user, maxAge);

  const response = NextResponse.json({ user: result.user });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(maxAge));
  return response;
}
