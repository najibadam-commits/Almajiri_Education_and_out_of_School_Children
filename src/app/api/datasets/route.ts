import { NextResponse } from 'next/server';
import { requirePermission } from '@/auth/guards';
import { store } from '@/store';

/**
 * The dataset catalogue.
 *
 * Anyone with a session, visitors included, may see what exists — knowing a
 * dataset is there is what tells a visitor an account is worth having. What
 * never leaves the server is `fileLocation`.
 */
export async function GET() {
  const guard = await requirePermission('VIEW_PUBLIC_DATA');
  if (!guard.ok) return guard.response;

  const datasets = await store.listDatasets();
  return NextResponse.json({
    datasets: datasets
      .filter((d) => d.accessLevel !== 'ADMIN_ONLY')
      .map(({ id, name, description, accessLevel, formats }) => ({
        id, name, description, accessLevel, formats,
      })),
  });
}
