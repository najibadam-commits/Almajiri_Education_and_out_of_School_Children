import { NextResponse } from 'next/server';
import { sessionUser } from '@/auth/guards';

/**
 * The caller's own session.
 *
 * It returns the whole of what the cookie carries — role and account status
 * included — because that is what the interface needs to say what this session
 * is, and it is the caller's own identity rather than anybody else's.
 */
export async function GET() {
  const user = await sessionUser();
  if (!user) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({ user }, { headers: { 'cache-control': 'no-store' } });
}
