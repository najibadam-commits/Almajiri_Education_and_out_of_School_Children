import { Pool } from 'pg';
import { DATASETS } from './datasets';
import type { AccessRequest, OutboxMessage, Store, User } from './types';

/**
 * The durable store: PostgreSQL.
 *
 * This is the same `Store` the in-memory implementation is, so nothing outside
 * this folder knows which one it has. It is used whenever `DATABASE_URL` is
 * set and falls back to memory when it is not, which keeps a fresh checkout
 * working with no database to provision.
 *
 * Three things are persisted: accounts, dataset requests and the notification
 * outbox. The dataset catalogue is not. It is defined in code (`datasets.ts`)
 * because it describes files the server knows how to build, and a row in a
 * database saying where a file lives is no safer than a constant saying the
 * same thing — while being one more thing that can disagree with the code.
 *
 * Timestamps are stored as ISO-8601 text rather than `timestamptz`. Every
 * timestamp in this application is produced by `new Date().toISOString()` and
 * consumed as a string, UTC and fixed-width, so text round-trips exactly and
 * sorts correctly, and there is no driver date conversion to get wrong. If a
 * later version needs to compare or group by time inside SQL, cast in the
 * query rather than changing the column: `(requested_at::timestamptz)`.
 */

/** Runs once per process, before the first query. */
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id                 text PRIMARY KEY,
    full_name          text NOT NULL,
    email              text NOT NULL,
    organization       text NOT NULL DEFAULT '',
    job_title          text NOT NULL DEFAULT '',
    phone              text NOT NULL DEFAULT '',
    country            text NOT NULL DEFAULT '',
    location           text NOT NULL DEFAULT '',
    purpose            text NOT NULL DEFAULT 'Other',
    role               text NOT NULL DEFAULT 'AUTHORIZED_USER',
    account_status     text NOT NULL DEFAULT 'PENDING_VERIFICATION',
    password_hash      text NOT NULL,
    password_salt      text NOT NULL,
    verification_token text,
    created_at         text NOT NULL,
    updated_at         text NOT NULL
  );

  -- One account per address, however it was capitalised when it was typed.
  CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_key ON users (lower(email));
  CREATE INDEX IF NOT EXISTS users_verification_token_idx ON users (verification_token);

  CREATE TABLE IF NOT EXISTS access_requests (
    id               text PRIMARY KEY,
    user_id          text NOT NULL,
    user_name        text NOT NULL DEFAULT '',
    user_email       text NOT NULL DEFAULT '',
    dataset_id       text NOT NULL,
    purpose          text NOT NULL,
    intended_use     text NOT NULL DEFAULT '',
    requested_format text NOT NULL DEFAULT 'CSV',
    organization     text NOT NULL DEFAULT '',
    reason           text NOT NULL DEFAULT '',
    comments         text NOT NULL DEFAULT '',
    status           text NOT NULL DEFAULT 'PENDING',
    reviewed_by      text,
    reviewer_notes   text,
    requested_at     text NOT NULL,
    reviewed_at      text,
    expires_at       text
  );

  CREATE INDEX IF NOT EXISTS access_requests_user_idx ON access_requests (user_id, requested_at DESC);
  CREATE INDEX IF NOT EXISTS access_requests_status_idx ON access_requests (status);

  CREATE TABLE IF NOT EXISTS outbox (
    id         text PRIMARY KEY,
    recipient  text NOT NULL,
    subject    text NOT NULL,
    body       text NOT NULL,
    sent_at    text NOT NULL
  );

  CREATE INDEX IF NOT EXISTS outbox_sent_at_idx ON outbox (sent_at DESC);
`;

interface UserRow {
  id: string;
  full_name: string;
  email: string;
  organization: string;
  job_title: string;
  phone: string;
  country: string;
  location: string;
  purpose: string;
  role: string;
  account_status: string;
  password_hash: string;
  password_salt: string;
  verification_token: string | null;
  created_at: string;
  updated_at: string;
}

interface RequestRow {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  dataset_id: string;
  purpose: string;
  intended_use: string;
  requested_format: string;
  organization: string;
  reason: string;
  comments: string;
  status: string;
  reviewed_by: string | null;
  reviewer_notes: string | null;
  requested_at: string;
  reviewed_at: string | null;
  expires_at: string | null;
}

interface OutboxRow {
  id: string;
  recipient: string;
  subject: string;
  body: string;
  sent_at: string;
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    organization: row.organization,
    jobTitle: row.job_title,
    phone: row.phone,
    country: row.country,
    location: row.location,
    purpose: row.purpose as User['purpose'],
    role: row.role as User['role'],
    accountStatus: row.account_status as User['accountStatus'],
    passwordHash: row.password_hash,
    passwordSalt: row.password_salt,
    verificationToken: row.verification_token,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRequest(row: RequestRow): AccessRequest {
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    userEmail: row.user_email,
    datasetId: row.dataset_id,
    purpose: row.purpose as AccessRequest['purpose'],
    intendedUse: row.intended_use,
    requestedFormat: row.requested_format,
    organization: row.organization,
    reason: row.reason,
    comments: row.comments,
    status: row.status as AccessRequest['status'],
    reviewedBy: row.reviewed_by,
    reviewerNotes: row.reviewer_notes,
    requestedAt: row.requested_at,
    reviewedAt: row.reviewed_at,
    expiresAt: row.expires_at,
  };
}

/**
 * The columns a patch may touch, and where each one goes.
 *
 * An allow-list rather than a loop over the patch's keys: a patch arrives from
 * a route handler, and building SQL from whatever keys an object happens to
 * carry is how an update ends up writing a column nobody meant it to.
 */
const USER_COLUMNS: Record<keyof User, string> = {
  id: 'id',
  fullName: 'full_name',
  email: 'email',
  organization: 'organization',
  jobTitle: 'job_title',
  phone: 'phone',
  country: 'country',
  location: 'location',
  purpose: 'purpose',
  role: 'role',
  accountStatus: 'account_status',
  passwordHash: 'password_hash',
  passwordSalt: 'password_salt',
  verificationToken: 'verification_token',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
};

const REQUEST_COLUMNS: Record<keyof AccessRequest, string> = {
  id: 'id',
  userId: 'user_id',
  userName: 'user_name',
  userEmail: 'user_email',
  datasetId: 'dataset_id',
  purpose: 'purpose',
  intendedUse: 'intended_use',
  requestedFormat: 'requested_format',
  organization: 'organization',
  reason: 'reason',
  comments: 'comments',
  status: 'status',
  reviewedBy: 'reviewed_by',
  reviewerNotes: 'reviewer_notes',
  requestedAt: 'requested_at',
  reviewedAt: 'reviewed_at',
  expiresAt: 'expires_at',
};

/** Builds `SET a = $2, b = $3` from a patch, skipping the key and anything absent. */
function assignments<T extends object>(
  patch: Partial<T>,
  columns: Record<keyof T, string>,
  immutable: readonly (keyof T)[],
): { clause: string; values: unknown[] } {
  const parts: string[] = [];
  const values: unknown[] = [];
  for (const [key, column] of Object.entries(columns) as [keyof T, string][]) {
    if (immutable.includes(key)) continue;
    if (!(key in patch)) continue;
    values.push(patch[key]);
    parts.push(`${column} = $${values.length + 1}`);
  }
  return { clause: parts.join(', '), values };
}

export function createPostgresStore(connectionString: string): Store {
  const pool = new Pool({
    connectionString,
    // Neon and every other hosted Postgres terminate TLS at their proxy with a
    // certificate this process has no root for. The connection is still
    // encrypted; what is skipped is verifying the certificate chain, which is
    // what `sslmode=require` means in a connection string.
    ssl: /\bsslmode=(disable|allow)\b/.test(connectionString)
      ? undefined
      : { rejectUnauthorized: false },
    // A serverless function is one request at a time and is frozen between
    // them, so a big pool is idle connections held against the database's
    // limit for nothing.
    max: Number(process.env.DATABASE_POOL_MAX ?? 3),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });

  // A pool emits errors on idle clients — a database restart, a dropped
  // connection — and an unhandled one takes the process down.
  pool.on('error', (error) => {
    console.error('[store] idle connection error:', error.message);
  });

  /**
   * The schema is created on first use rather than by a migration step,
   * because a serverless deployment has no step to hang one on. The promise is
   * kept so it happens once per process and every later query waits on the
   * same one; if it fails it is cleared, so the next request tries again
   * rather than the process being permanently broken by one bad moment.
   */
  let ready: Promise<void> | null = null;

  function ensureSchema(): Promise<void> {
    if (!ready) {
      ready = pool.query(SCHEMA).then(
        () => undefined,
        (error: unknown) => {
          ready = null;
          throw error;
        },
      );
    }
    return ready;
  }

  async function query<R extends object>(text: string, values: unknown[] = []): Promise<R[]> {
    await ensureSchema();
    const result = await pool.query<R>(text, values);
    return result.rows;
  }

  const USER_SELECT = 'SELECT * FROM users';
  const REQUEST_SELECT = 'SELECT * FROM access_requests';

  return {
    description: 'PostgreSQL (records persist)',
    durable: true,

    async createUser(user) {
      const columns = Object.values(USER_COLUMNS);
      const placeholders = columns.map((_, i) => `$${i + 1}`);
      const values = (Object.keys(USER_COLUMNS) as (keyof User)[]).map((key) => user[key]);
      const rows = await query<UserRow>(
        `INSERT INTO users (${columns.join(', ')}) VALUES (${placeholders.join(', ')})
         ON CONFLICT DO NOTHING
         RETURNING *`,
        values,
      );
      // Nothing came back, so the address was already registered. The caller
      // is told what is on file rather than being handed a row that does not
      // exist, and registration stays idempotent.
      if (rows.length === 0) {
        const existing = await this.findUserByEmail(user.email);
        if (existing) return existing;
      }
      return rows[0] ? toUser(rows[0]) : user;
    },

    async findUserByEmail(email) {
      const rows = await query<UserRow>(`${USER_SELECT} WHERE lower(email) = lower($1) LIMIT 1`, [
        email.trim(),
      ]);
      return rows[0] ? toUser(rows[0]) : null;
    },

    async findUserById(id) {
      const rows = await query<UserRow>(`${USER_SELECT} WHERE id = $1 LIMIT 1`, [id]);
      return rows[0] ? toUser(rows[0]) : null;
    },

    async findUserByVerificationToken(token) {
      if (!token) return null;
      const rows = await query<UserRow>(`${USER_SELECT} WHERE verification_token = $1 LIMIT 1`, [
        token,
      ]);
      return rows[0] ? toUser(rows[0]) : null;
    },

    async updateUser(id, patch) {
      const { clause, values } = assignments(patch, USER_COLUMNS, ['id', 'createdAt', 'updatedAt']);
      const rows = await query<UserRow>(
        `UPDATE users SET ${clause ? `${clause}, ` : ''}updated_at = $${values.length + 2}
         WHERE id = $1 RETURNING *`,
        [id, ...values, new Date().toISOString()],
      );
      return rows[0] ? toUser(rows[0]) : null;
    },

    async listUsers() {
      const rows = await query<UserRow>(`${USER_SELECT} ORDER BY created_at DESC`);
      return rows.map(toUser);
    },

    async listDatasets() {
      return DATASETS.map((dataset) => ({ ...dataset }));
    },

    async findDataset(id) {
      const dataset = DATASETS.find((candidate) => candidate.id === id);
      return dataset ? { ...dataset } : null;
    },

    async createRequest(request) {
      const columns = Object.values(REQUEST_COLUMNS);
      const placeholders = columns.map((_, i) => `$${i + 1}`);
      const values = (Object.keys(REQUEST_COLUMNS) as (keyof AccessRequest)[]).map(
        (key) => request[key],
      );
      const rows = await query<RequestRow>(
        `INSERT INTO access_requests (${columns.join(', ')}) VALUES (${placeholders.join(', ')})
         RETURNING *`,
        values,
      );
      return rows[0] ? toRequest(rows[0]) : request;
    },

    async findRequest(id) {
      const rows = await query<RequestRow>(`${REQUEST_SELECT} WHERE id = $1 LIMIT 1`, [id]);
      return rows[0] ? toRequest(rows[0]) : null;
    },

    async listRequestsForUser(userId) {
      const rows = await query<RequestRow>(
        `${REQUEST_SELECT} WHERE user_id = $1 ORDER BY requested_at DESC`,
        [userId],
      );
      return rows.map(toRequest);
    },

    async listAllRequests() {
      const rows = await query<RequestRow>(`${REQUEST_SELECT} ORDER BY requested_at DESC`);
      return rows.map(toRequest);
    },

    async updateRequest(id, patch) {
      const { clause, values } = assignments(patch, REQUEST_COLUMNS, ['id']);
      if (!clause) return this.findRequest(id);
      const rows = await query<RequestRow>(
        `UPDATE access_requests SET ${clause} WHERE id = $1 RETURNING *`,
        [id, ...values],
      );
      return rows[0] ? toRequest(rows[0]) : null;
    },

    async recordMessage(message) {
      await query(
        `INSERT INTO outbox (id, recipient, subject, body, sent_at) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO NOTHING`,
        [message.id, message.to, message.subject, message.body, message.sentAt],
      );
    },

    async check() {
      try {
        await query('SELECT 1');
        return { ok: true, detail: 'connected' };
      } catch (error) {
        /*
         * The reason is kept short and free of the connection string: this
         * feeds an unauthenticated status route, and a database's host, port
         * and user are not things to hand out. The full error goes to the
         * server log, where whoever is debugging can see it.
         */
        const code =
          typeof error === 'object' && error !== null && 'code' in error
            ? String((error as { code: unknown }).code)
            : '';
        console.error('[store] database unreachable:', error);
        return {
          ok: false,
          detail:
            code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ETIMEDOUT'
              ? 'the database did not answer'
              : code === '28P01' || code === '28000'
                ? 'the database refused these credentials'
                : code === '3D000'
                  ? 'the named database does not exist'
                  : 'the database returned an error',
        };
      }
    },

    async listMessages() {
      const rows = await query<OutboxRow>(
        // Bounded: the administration page shows recent activity, and an
        // outbox that has been running for a year is not a page.
        `SELECT * FROM outbox ORDER BY sent_at DESC LIMIT 200`,
      );
      return rows.map(
        (row): OutboxMessage => ({
          id: row.id,
          to: row.recipient,
          subject: row.subject,
          body: row.body,
          sentAt: row.sent_at,
        }),
      );
    },
  };
}
