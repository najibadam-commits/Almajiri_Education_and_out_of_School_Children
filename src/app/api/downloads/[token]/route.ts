import { NextResponse } from 'next/server';
import { readDownloadToken } from '@/auth/downloadToken';
import { storageUnavailable } from '@/server/storageErrors';
import { sessionUser } from '@/auth/guards';
import { can } from '@/access/permissions';
import { renderDataset } from '@/server/datasetFiles';
import { store } from '@/store';

/**
 * Serves an approved dataset.
 *
 * The token says which request it is for and when it stops working, but the
 * token alone is not the authority: the route re-reads the request, checks it
 * is still APPROVED, checks it still belongs to the caller, and checks the
 * caller is signed in as that person with the permission to download. A link
 * that leaks is therefore worth nothing to whoever finds it, and an approval
 * withdrawn after the link was sent stops working at once.
 *
 * `no-store` because the response is specific to one person.
 */
export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    return await serve(context);
  } catch (error) {
    return storageUnavailable(error, 'serving an approved dataset');
  }
}

async function serve(context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const refuse = (message: string, status: number) =>
    NextResponse.json({ error: message }, { status, headers: { 'cache-control': 'no-store' } });

  const claim = await readDownloadToken(token);
  if (!claim) return refuse('This download link is not valid, or it has expired.', 403);

  const user = await sessionUser();
  if (!user) return refuse('Sign in to collect an approved dataset.', 401);
  if (!can(user.role, 'DOWNLOAD_APPROVED_DATA', { verified: user.status === 'VERIFIED' })) {
    return refuse('Your account cannot download datasets.', 403);
  }
  if (user.sub !== claim.userId) {
    return refuse('This download belongs to a different account.', 403);
  }

  const record = await store.findRequest(claim.requestId);
  if (!record) return refuse('This download link is not valid, or it has expired.', 403);
  if (record.userId !== claim.userId || record.datasetId !== claim.datasetId) {
    return refuse('This download link is not valid, or it has expired.', 403);
  }
  if (record.status !== 'APPROVED') {
    return refuse('That request is no longer approved.', 403);
  }
  if (record.expiresAt && new Date(record.expiresAt).getTime() <= Date.now()) {
    await store.updateRequest(record.id, { status: 'EXPIRED' });
    return refuse('This download link is not valid, or it has expired.', 403);
  }

  const dataset = await store.findDataset(claim.datasetId);
  if (!dataset) return refuse('That dataset is no longer published.', 404);

  const file = renderDataset(dataset, claim.format);
  if (!file) return refuse('That dataset has no file to deliver yet.', 404);

  return new NextResponse(file.body, {
    headers: {
      'content-type': file.contentType,
      'content-disposition': `attachment; filename="${file.filename}"`,
      'cache-control': 'no-store',
      'x-row-count': String(file.rowCount),
    },
  });
}
