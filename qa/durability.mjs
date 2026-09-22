/*
 * Does the deployment keep what it was told to keep?
 *
 * Run it, restart the server, run it again: the counts it prints must not go
 * down. That is the whole claim a durable store makes, and it is the one thing
 * the access-flow suite cannot check, because that suite only ever talks to a
 * server that is still running.
 */
const BASE = process.env.BASE ?? 'http://127.0.0.1:3200';

const cookies = new Map();
const header = () => [...cookies].map(([k, v]) => `${k}=${v}`).join('; ');

async function call(path, init = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    redirect: 'manual',
    headers: {
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      cookie: header(),
    },
  });
  for (const raw of response.headers.getSetCookie?.() ?? []) {
    const [pair] = raw.split(';');
    const index = pair.indexOf('=');
    cookies.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
  }
  return response;
}

const status = await (await call('/api/auth/status')).json();

await call('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({
    username: process.env.QA_ADMIN_USER,
    password: process.env.QA_ADMIN_PASSWORD,
    remember: false,
  }),
});

const { requests = [] } = await (await call('/api/data-requests?scope=all')).json();
const approved = requests.filter((r) => r.status === 'APPROVED').length;

console.log(
  JSON.stringify({
    storage: status.storage,
    durable: status.storageDurable,
    requests: requests.length,
    approved,
    requesters: new Set(requests.map((r) => r.userEmail)).size,
  }),
);
