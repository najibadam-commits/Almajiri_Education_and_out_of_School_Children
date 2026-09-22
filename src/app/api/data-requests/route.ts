import { NextResponse } from 'next/server';
import { requirePermission } from '@/auth/guards';
import { randomToken } from '@/auth/passwords';
import { store } from '@/store';
import { PURPOSES, type AccessRequest, type Purpose } from '@/store/types';

/**
 * Dataset access requests.
 *
 * GET returns the caller's own requests. `?scope=all` returns everybody's and
 * is refused to anyone without REVIEW_DOWNLOAD_REQUESTS, so the administration
 * view is a permission rather than a URL somebody happens to know.
 *
 * POST records a request. It never returns a dataset and never approves
 * anything: an account is identity and accountability, not entitlement.
 */
export async function GET(request: Request) {
  const scope = new URL(request.url).searchParams.get('scope');

  if (scope === 'all') {
    const guard = await requirePermission('REVIEW_DOWNLOAD_REQUESTS');
    if (!guard.ok) return guard.response;
    const [requests, users, datasets] = await Promise.all([
      store.listAllRequests(),
      store.listUsers(),
      store.listDatasets(),
    ]);
    return NextResponse.json({
      requests: requests.map((r) => {
        // The live record when there is one, so a reviewer sees a corrected
        // name rather than the one typed months ago; the copy on the request
        // otherwise, which is all there is for a seeded account.
        const user = users.find((u) => u.id === r.userId);
        return {
          ...r,
          userName: user?.fullName || r.userName,
          userEmail: user?.email || r.userEmail,
          organization: user?.organization || r.organization,
          datasetName: datasets.find((d) => d.id === r.datasetId)?.name ?? r.datasetId,
        };
      }),
    });
  }

  const guard = await requirePermission('VIEW_OWN_REQUESTS');
  if (!guard.ok) return guard.response;

  const [requests, datasets] = await Promise.all([
    store.listRequestsForUser(guard.user.sub),
    store.listDatasets(),
  ]);
  return NextResponse.json({
    requests: requests.map((r) => ({
      ...r,
      datasetName: datasets.find((d) => d.id === r.datasetId)?.name ?? r.datasetId,
      // The reviewer's private notes stay with the reviewer.
      reviewerNotes: r.status === 'REJECTED' ? null : r.reviewerNotes,
    })),
  });
}

export async function POST(request: Request) {
  const guard = await requirePermission('REQUEST_DATA_ACCESS');
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  const text = (key: string) => (typeof body[key] === 'string' ? (body[key] as string).trim() : '');
  const datasetId = text('datasetId');
  const intendedUse = text('intendedUse');
  const reason = text('reason');
  const organization = text('organization');
  const requestedFormat = text('requestedFormat') || 'CSV';
  const purpose = text('purpose') as Purpose;
  const comments = text('comments');

  const dataset = await store.findDataset(datasetId);
  if (!dataset) return NextResponse.json({ error: 'Choose a dataset.' }, { status: 400 });
  if (dataset.accessLevel === 'ADMIN_ONLY') {
    // Not "forbidden": an administrators-only dataset is not offered for
    // request at all, and saying so is not a disclosure.
    return NextResponse.json({ error: 'That dataset is not available to request.' }, { status: 400 });
  }
  if (!dataset.formats.includes(requestedFormat)) {
    return NextResponse.json({ error: 'Choose a format the dataset is published in.' }, { status: 400 });
  }
  if (!PURPOSES.includes(purpose)) {
    return NextResponse.json({ error: 'Choose what you need the data for.' }, { status: 400 });
  }
  if (intendedUse.length < 10) {
    return NextResponse.json({ error: 'Describe how you intend to use the data.' }, { status: 400 });
  }
  if (reason.length < 10) {
    return NextResponse.json({ error: 'Say why you are requesting this dataset.' }, { status: 400 });
  }
  if (!organization) {
    return NextResponse.json({ error: 'Name the organization making the request.' }, { status: 400 });
  }

  const open = (await store.listRequestsForUser(guard.user.sub)).find(
    (r) => r.datasetId === datasetId && (r.status === 'PENDING' || r.status === 'UNDER_REVIEW'),
  );
  if (open) {
    return NextResponse.json(
      { error: 'You already have a request for this dataset awaiting review.' },
      { status: 409 },
    );
  }

  const now = new Date().toISOString();
  const record: AccessRequest = {
    id: `req_${randomToken(8)}`,
    userId: guard.user.sub,
    userName: guard.user.name,
    userEmail: guard.user.email ?? '',
    datasetId,
    purpose,
    intendedUse,
    requestedFormat,
    organization,
    reason,
    comments,
    status: 'PENDING',
    reviewedBy: null,
    reviewerNotes: null,
    requestedAt: now,
    reviewedAt: null,
    expiresAt: null,
  };
  await store.createRequest(record);

  return NextResponse.json({
    ok: true,
    request: { ...record, datasetName: dataset.name },
    message:
      'Your dataset access request has been submitted successfully. An administrator will review ' +
      'your request and notify you by email once a decision has been made.',
  });
}
