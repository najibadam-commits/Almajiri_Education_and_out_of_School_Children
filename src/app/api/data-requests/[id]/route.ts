import { NextResponse } from 'next/server';
import { DOWNLOAD_TTL_SECONDS, createDownloadToken } from '@/auth/downloadToken';
import { requirePermission } from '@/auth/guards';
import { storageUnavailable } from '@/server/storageErrors';
import {
  approvalEmail,
  notificationService,
  rejectionEmail,
} from '@/services/notificationService';
import { store } from '@/store';
import type { RequestStatus } from '@/store/types';

/**
 * Administrative review of a dataset request.
 *
 * Approving mints a signed download link tied to the request, its owner and an
 * expiry, and emails it. Rejecting stores the reviewer's reason for the record
 * and sends the user a neutral message rather than the internal note.
 *
 * Every branch is behind its own permission, so an administrator who may
 * review but not approve — should the roles ever separate — is stopped here
 * and not by which buttons were drawn.
 */
const DECISIONS = {
  APPROVE: { status: 'APPROVED', permission: 'APPROVE_DATA_REQUESTS' },
  REJECT: { status: 'REJECTED', permission: 'REJECT_DATA_REQUESTS' },
  REQUEST_INFO: { status: 'UNDER_REVIEW', permission: 'REVIEW_DOWNLOAD_REQUESTS' },
} as const;

type Decision = keyof typeof DECISIONS;

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    return await review(request, context);
  } catch (error) {
    return storageUnavailable(error, 'reviewing a dataset request');
  }
}

async function review(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  const decision = String(body.decision ?? '').toUpperCase() as Decision;
  if (!(decision in DECISIONS)) {
    return NextResponse.json({ error: 'Choose approve, reject or request more information.' }, { status: 400 });
  }
  const { status, permission } = DECISIONS[decision];

  const guard = await requirePermission(permission);
  if (!guard.ok) return guard.response;

  const notes = typeof body.reviewerNotes === 'string' ? body.reviewerNotes.trim() : '';
  if (decision === 'REJECT' && notes.length < 5) {
    return NextResponse.json({ error: 'Record why the request was rejected.' }, { status: 400 });
  }

  const existing = await store.findRequest(id);
  if (!existing) return NextResponse.json({ error: 'No such request.' }, { status: 404 });
  if (existing.status === 'APPROVED' && decision === 'APPROVE') {
    return NextResponse.json({ error: 'That request is already approved.' }, { status: 409 });
  }

  const [user, dataset] = await Promise.all([
    store.findUserById(existing.userId),
    store.findDataset(existing.datasetId),
  ]);
  if (!dataset) {
    return NextResponse.json({ error: 'That dataset is no longer published.' }, { status: 409 });
  }

  // A seeded administrator's session has no user record, so the name and
  // address captured on the request are the fallback rather than a failure.
  const requester = {
    name: user?.fullName || existing.userName || 'the requester',
    email: user?.email || existing.userEmail,
  };
  if (decision === 'APPROVE' && !requester.email) {
    return NextResponse.json(
      { error: 'That request has no email address to send an approval to.' },
      { status: 409 },
    );
  }

  const now = new Date();
  const expiresAt =
    decision === 'APPROVE' ? new Date(now.getTime() + DOWNLOAD_TTL_SECONDS * 1000) : null;

  const updated = await store.updateRequest(id, {
    status: status as RequestStatus,
    reviewedBy: guard.user.name,
    reviewerNotes: notes || null,
    reviewedAt: now.toISOString(),
    expiresAt: expiresAt?.toISOString() ?? null,
  });
  if (!updated) return NextResponse.json({ error: 'No such request.' }, { status: 404 });

  if (decision === 'APPROVE' && expiresAt) {
    const token = await createDownloadToken({
      requestId: updated.id,
      userId: updated.userId,
      datasetId: updated.datasetId,
      format: updated.requestedFormat,
      exp: Math.floor(expiresAt.getTime() / 1000),
    });
    const link = `${new URL(request.url).origin}/api/downloads/${token}`;
    await notificationService.send({
      to: requester.email,
      ...approvalEmail(requester.name, dataset.name, link, expiresAt.toDateString()),
    });
  }

  if (decision === 'REJECT' && requester.email) {
    await notificationService.send({
      to: requester.email,
      ...rejectionEmail(requester.name, dataset.name),
    });
  }

  return NextResponse.json({ ok: true, request: updated });
}
