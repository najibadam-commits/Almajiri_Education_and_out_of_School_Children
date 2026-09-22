/*
 * End-to-end check of the access workflow, against a production build.
 *
 * It walks the whole path a person does — visitor, register, verify, request,
 * review, download — and asserts at each step both what the interface shows
 * and what the API allows, because the two are supposed to agree and the
 * point of the exercise is to catch it when they do not.
 *
 * Run with the server already listening on BASE (default http://127.0.0.1:3100).
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://127.0.0.1:3100';
const SHOTS = process.env.SHOTS ?? 'qa/shots';

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

/** A cookie jar per identity, so sessions can be held side by side. */
function jar() {
  const cookies = new Map();
  return {
    header: () => [...cookies].map(([k, v]) => `${k}=${v}`).join('; '),
    absorb(response) {
      for (const raw of response.headers.getSetCookie?.() ?? []) {
        const [pair] = raw.split(';');
        const index = pair.indexOf('=');
        const name = pair.slice(0, index).trim();
        const value = pair.slice(index + 1).trim();
        if (value === '' || /Max-Age=0/i.test(raw)) cookies.delete(name);
        else cookies.set(name, value);
      }
      return response;
    },
  };
}

async function call(session, path, init = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    redirect: 'manual',
    headers: {
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(init.headers ?? {}),
      cookie: session.header(),
    },
  });
  session.absorb(response);
  return response;
}

const json = async (response) => response.json().catch(() => ({}));

const cookiesFor = (session) =>
  session
    .header()
    .split('; ')
    .filter(Boolean)
    .map((pair) => {
      const index = pair.indexOf('=');
      return { name: pair.slice(0, index), value: pair.slice(index + 1), url: BASE };
    });

async function main() {
  console.log(`\n--- API and route protection (${BASE})\n`);

  // ------------------------------------------------------------ anonymous
  const anon = jar();
  let response = await call(anon, '/dashboard');
  check(
    'an anonymous request to /dashboard is redirected to the portal',
    response.status === 307 && (response.headers.get('location') ?? '').includes('/login'),
    `${response.status} ${response.headers.get('location') ?? ''}`,
  );

  response = await call(anon, '/api/data-requests');
  check('an anonymous request list is refused', response.status === 401, `${response.status}`);

  response = await call(anon, '/api/data-requests?scope=all');
  check('an anonymous review list is refused', response.status === 401, `${response.status}`);

  // -------------------------------------------------------------- visitor
  const visitor = jar();
  response = await call(visitor, '/api/access/visitor', { method: 'POST' });
  check('visitor mode issues a session', response.status === 200, `${response.status}`);

  response = await call(visitor, '/dashboard');
  check('a visitor reaches the dashboard', response.status === 200, `${response.status}`);

  response = await call(visitor, '/api/datasets');
  const catalogue = await json(response);
  check('a visitor may read the catalogue', response.status === 200, `${response.status}`);
  check(
    'the catalogue never carries a file location',
    JSON.stringify(catalogue).includes('fileLocation') === false,
  );
  check(
    'administrator-only datasets are not listed',
    (catalogue.datasets ?? []).every((d) => d.accessLevel !== 'ADMIN_ONLY'),
  );

  response = await call(visitor, '/api/data-requests', {
    method: 'POST',
    body: JSON.stringify({ datasetId: 'schools-by-state', purpose: 'Research' }),
  });
  let body = await json(response);
  check(
    'a visitor cannot submit a dataset request',
    response.status === 403 && body.reason === 'ACCOUNT_REQUIRED',
    `${response.status} ${body.reason ?? ''}`,
  );

  response = await call(visitor, '/api/data-requests?scope=all');
  check('a visitor cannot read the review queue', response.status === 403, `${response.status}`);

  response = await call(visitor, '/account/requests');
  check(
    'a visitor is turned away from /account',
    response.status === 307 && (response.headers.get('location') ?? '').includes('/login'),
    `${response.status}`,
  );

  response = await call(visitor, '/admin/requests');
  check(
    'a visitor is turned away from /admin',
    response.status === 307 && (response.headers.get('location') ?? '').includes('/dashboard'),
    `${response.status}`,
  );

  response = await call(visitor, '/login');
  check('a visitor can still reach the portal', response.status === 200, `${response.status}`);

  // ------------------------------------------------------------- register
  const user = jar();
  const email = `qa.user.${Date.now()}@example.org`;
  const password = 'a-long-enough-password';
  response = await call(user, '/api/account/register', {
    method: 'POST',
    body: JSON.stringify({
      fullName: 'QA Requester',
      email,
      organization: 'QA Institute',
      jobTitle: 'Analyst',
      phone: '+2348000000000',
      country: 'Nigeria',
      location: 'Kano',
      purpose: 'Research',
      password,
      confirmPassword: password,
      agreedToTerms: true,
    }),
  });
  body = await json(response);
  check('registration is accepted', response.status === 200 && body.ok === true, `${response.status}`);
  const verificationLink = body.verificationLink ?? '';
  check('a verification link is issued', verificationLink.includes('/verify?token='));

  response = await call(user, '/api/account/register', {
    method: 'POST',
    body: JSON.stringify({
      fullName: 'Someone Else',
      email,
      organization: 'Other',
      jobTitle: 'Other',
      country: 'Nigeria',
      location: 'Lagos',
      purpose: 'Media',
      password,
      confirmPassword: password,
      agreedToTerms: true,
    }),
  });
  body = await json(response);
  check(
    'a repeat registration does not disclose that the address is taken',
    response.status === 200 && body.ok === true && body.verificationLink === null,
  );

  // --------------------------------------------------- signed in, pending
  response = await call(user, '/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: email, password, remember: false }),
  });
  body = await json(response);
  check('a pending account can sign in', response.status === 200, `${response.status}`);
  check(
    'and the session says it is pending',
    body.user?.status === 'PENDING_VERIFICATION',
    body.user?.status,
  );

  const requestBody = {
    datasetId: 'schools-by-state',
    requestedFormat: 'CSV',
    purpose: 'Research',
    organization: 'QA Institute',
    intendedUse: 'Measuring enrolment against infrastructure for a state report.',
    reason: 'The published summary does not break enrolment down by LGA.',
    comments: '',
  };

  response = await call(user, '/api/data-requests', {
    method: 'POST',
    body: JSON.stringify(requestBody),
  });
  body = await json(response);
  check(
    'a pending account cannot request a dataset',
    response.status === 403 && body.reason === 'VERIFICATION_REQUIRED',
    `${response.status} ${body.reason ?? ''}`,
  );

  // --------------------------------------------------------------- verify
  const token = new URL(verificationLink).searchParams.get('token');
  response = await call(user, '/api/account/verify', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
  check('the verification token is accepted', response.status === 200, `${response.status}`);

  response = await call(user, '/api/account/verify', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
  check('and cannot be used twice', response.status === 400, `${response.status}`);

  response = await call(user, '/api/auth/session');
  body = await json(response);
  check('the session was reissued as verified', body.user?.status === 'VERIFIED', body.user?.status);

  // -------------------------------------------------------------- request
  response = await call(user, '/api/data-requests', {
    method: 'POST',
    body: JSON.stringify(requestBody),
  });
  body = await json(response);
  check('a verified account may request a dataset', response.status === 200, `${response.status}`);
  const requestId = body.request?.id ?? '';

  response = await call(user, '/api/data-requests', {
    method: 'POST',
    body: JSON.stringify(requestBody),
  });
  check('a second open request for the same dataset is refused', response.status === 409);

  response = await call(user, '/api/data-requests', {
    method: 'POST',
    body: JSON.stringify({ ...requestBody, datasetId: 'platform-audit' }),
  });
  check('an administrators-only dataset cannot be requested', response.status === 400);

  response = await call(user, `/api/data-requests/${requestId}`, {
    method: 'PATCH',
    body: JSON.stringify({ decision: 'APPROVE' }),
  });
  check('a user cannot approve their own request', response.status === 403, `${response.status}`);

  // -------------------------------------------------------- administrator
  const admin = jar();
  response = await call(admin, '/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      username: process.env.QA_ADMIN_USER,
      password: process.env.QA_ADMIN_PASSWORD,
      remember: false,
    }),
  });
  check('the administrator signs in', response.status === 200, `${response.status}`);

  response = await call(admin, '/api/data-requests?scope=all');
  body = await json(response);
  const queued = (body.requests ?? []).find((r) => r.id === requestId);
  check('the request is in the review queue', Boolean(queued));
  check('with the requester attached', queued?.userEmail === email, queued?.userEmail);

  response = await call(admin, `/api/data-requests/${requestId}`, {
    method: 'PATCH',
    body: JSON.stringify({ decision: 'REJECT' }),
  });
  check('rejecting without a reason is refused', response.status === 400, `${response.status}`);

  response = await call(admin, `/api/data-requests/${requestId}`, {
    method: 'PATCH',
    body: JSON.stringify({ decision: 'APPROVE', reviewerNotes: 'Reasonable research use.' }),
  });
  body = await json(response);
  check('the administrator approves it', response.status === 200, `${response.status}`);
  check('and an expiry is recorded', Boolean(body.request?.expiresAt));

  // ------------------------------------------------------------- download
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addCookies(cookiesFor(user));
  const page = await context.newPage();
  await page.goto(`${BASE}/account/requests`, { waitUntil: 'networkidle' });

  const statusText = (await page.locator('.status-pill').first().textContent()) ?? '';
  check(
    "the request reads as approved on the user's page",
    statusText.trim() === 'Approved',
    statusText.trim(),
  );

  const href = await page.locator('a.ws-primary.download').first().getAttribute('href');
  check('a download link is offered', Boolean(href));
  await page.screenshot({ path: `${SHOTS}/account-requests.png`, fullPage: true });

  response = await call(user, href);
  const csv = await response.text();
  check('the owner can collect the dataset', response.status === 200, `${response.status}`);
  check(
    'it is a CSV attachment',
    (response.headers.get('content-disposition') ?? '').includes('attachment'),
  );
  check('carrying the sample-data header', csv.startsWith('# SAMPLE DATA'), csv.slice(0, 40));
  check(
    'with rows in it',
    Number(response.headers.get('x-row-count') ?? 0) > 100,
    response.headers.get('x-row-count'),
  );

  response = await call(admin, href);
  check('the same link is refused to a different account', response.status === 403, `${response.status}`);

  response = await call(anon, href);
  check('and to nobody at all', response.status === 401, `${response.status}`);

  const tampered = href.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A'));
  response = await call(user, tampered);
  check('a tampered link is refused', response.status === 403, `${response.status}`);

  // A withdrawn approval stops working at once.
  await call(admin, `/api/data-requests/${requestId}`, {
    method: 'PATCH',
    body: JSON.stringify({ decision: 'REJECT', reviewerNotes: 'Withdrawn for the test.' }),
  });
  response = await call(user, href);
  check(
    'a link stops working when the approval is withdrawn',
    response.status === 403,
    `${response.status}`,
  );

  // ------------------------------------------------------------ interface
  console.log('\n--- the interface\n');

  const visitorContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const visitorPage = await visitorContext.newPage();
  await visitorPage.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  check('the portal offers both ways in', (await visitorPage.locator('.access-card').count()) === 2);
  await visitorPage.screenshot({ path: `${SHOTS}/portal.png` });

  // The heading says the same words, so the button is addressed as a button.
  await visitorPage.click('button:has-text("Continue as Visitor")');
  await visitorPage.waitForURL('**/dashboard**', { timeout: 30000 });
  await visitorPage.waitForSelector('.top .access-badge', { timeout: 30000 });
  const badge = (await visitorPage.locator('.top .access-badge').textContent()) ?? '';
  check('the dashboard says it is visitor mode', badge.trim() === 'Visitor Mode', badge.trim());

  const ribbon = (await visitorPage.locator('.app').first().textContent()) ?? '';
  check(
    'the concept-prototype disclaimer is still on the dashboard',
    /CONCEPT PROTOTYPE|SAMPLE DATA/i.test(ribbon),
  );

  // The dashboard reads a few megabytes of sample geometry before it renders
  // its controls, so the view switch is waited for rather than assumed.
  await visitorPage.waitForSelector('.views', { timeout: 90000 }).catch(async () => {
    const pane = await visitorPage.locator('.state-pane').first().textContent().catch(() => '');
    check('the dashboard finished loading its data', false, (pane ?? '').slice(0, 80));
  });

  // The charts live behind the Chart view, and the CSV button lives on them.
  // The switch is a React control, so a click that lands before the page has
  // hydrated does nothing: it is pressed until the view actually changes.
  const csvButton = visitorPage.locator('button[aria-label*="needs an account"]').first();
  for (let attempt = 0; attempt < 12; attempt++) {
    await visitorPage.locator('.views label', { hasText: 'Chart' }).click();
    if (await csvButton.isVisible().catch(() => false)) break;
    await visitorPage.waitForTimeout(1000);
  }
  await csvButton.waitFor({ state: 'visible', timeout: 15000 });
  await csvButton.click();
  await visitorPage.waitForSelector('#account-required-title');
  check('a visitor pressing CSV is told what an account is for', true);
  await visitorPage.screenshot({ path: `${SHOTS}/visitor-account-required.png` });
  await visitorPage.keyboard.press('Escape');
  await visitorContext.close();

  // The access screens, at the sizes people use.
  for (const [name, width, height] of [
    ['desktop', 1440, 900],
    ['laptop', 1280, 800],
    ['tablet', 834, 1112],
    ['phone', 390, 844],
  ]) {
    const sized = await browser.newContext({ viewport: { width, height } });
    const p = await sized.newPage();
    for (const [label, path] of [
      ['portal', '/login'],
      ['register', '/register'],
      ['sign-in', '/login/sign-in'],
    ]) {
      await p.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
      const overflow = await p.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      );
      check(`${label} at ${name} (${width}x${height}) does not scroll sideways`, !overflow);
      const heading = await p.locator('.hero h1').textContent();
      check(`${label} at ${name} has its heading`, (heading ?? '').trim().length > 10);
      await p.screenshot({ path: `${SHOTS}/${label}-${name}.png` });
    }
    await sized.close();
  }

  // The administration screen.
  const adminContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await adminContext.addCookies(cookiesFor(admin));
  const adminPage = await adminContext.newPage();
  await adminPage.goto(`${BASE}/admin/requests`, { waitUntil: 'networkidle' });
  check('the review queue renders', (await adminPage.locator('.ws-filters button').count()) === 6);
  const outbox = await adminPage.locator('.ws-panel.outbox .ws-item').count();
  check('the outbox recorded the messages', outbox >= 2, `${outbox}`);
  const outboxText = (await adminPage.locator('.ws-panel.outbox').textContent()) ?? '';
  check('including an approval link', outboxText.includes('/api/downloads/'));
  await adminPage.screenshot({ path: `${SHOTS}/admin-requests.png`, fullPage: true });

  await browser.close();

  console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} check(s) failed.`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
