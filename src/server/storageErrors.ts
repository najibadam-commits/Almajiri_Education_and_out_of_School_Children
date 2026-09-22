import { NextResponse } from 'next/server';

/**
 * What to say when the records cannot be reached.
 *
 * Without this a database that is down answers a registration with a bare
 * 500 and an empty body, which the browser shows as "That could not be
 * submitted" — a message that blames the form. The person retyping their
 * details is not the problem, and telling them to try again shortly is both
 * truer and more useful.
 *
 * The real error is logged, never returned: a driver's message carries the
 * host, the port and sometimes the user it tried.
 */

/**
 * Whether a thrown value looks like the storage layer failing, rather than a
 * defect in the handler above it. A `pg` error carries a `code` — either a
 * SQLSTATE like `28P01` or a socket error like `ECONNREFUSED` — and a pool
 * that gave up waiting says so in its message.
 */
export function isStorageFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if ('code' in error && typeof (error as { code: unknown }).code === 'string') return true;
  return /connect|connection|timeout|pool|database/i.test(error.message);
}

/**
 * The answer to give. `action` names what was being attempted, for the log
 * only. Anything that is not a storage failure is re-thrown, so a genuine bug
 * still reaches the error boundary instead of being dressed up as an outage.
 */
export function storageUnavailable(error: unknown, action: string): NextResponse {
  if (!isStorageFailure(error)) throw error;
  console.error(`[store] ${action} failed:`, error);
  return NextResponse.json(
    {
      error:
        'The platform could not reach its records just now. Nothing was saved. ' +
        'Please try again in a moment.',
      reason: 'STORAGE_UNAVAILABLE',
    },
    { status: 503, headers: { 'cache-control': 'no-store' } },
  );
}
