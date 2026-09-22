import type { AccessRole } from '@/access/permissions';

/** Whether an account has proved it owns its email address. */
export type AccountStatus = 'PENDING_VERIFICATION' | 'VERIFIED' | 'SUSPENDED';

/** How freely a dataset may be had. */
export type DatasetAccessLevel = 'PUBLIC' | 'RESTRICTED' | 'ADMIN_ONLY';

export type RequestStatus =
  | 'PENDING'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXPIRED';

export const PURPOSES = [
  'Government',
  'NGO',
  'Development Partner',
  'Research',
  'Education',
  'Media',
  'Donor Organization',
  'Private Sector',
  'Other',
] as const;
export type Purpose = (typeof PURPOSES)[number];

export interface User {
  id: string;
  fullName: string;
  email: string;
  organization: string;
  jobTitle: string;
  phone: string;
  country: string;
  location: string;
  purpose: Purpose;
  role: AccessRole;
  accountStatus: AccountStatus;
  /** PBKDF2 hash and salt. The password itself is never stored. */
  passwordHash: string;
  passwordSalt: string;
  /** Consumed on first use; null once the address is proven. */
  verificationToken: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Dataset {
  id: string;
  name: string;
  description: string;
  accessLevel: DatasetAccessLevel;
  /**
   * Where the rows come from. Never sent to the browser: a download is served
   * by a route handler that resolves this itself.
   */
  fileLocation: string;
  formats: readonly string[];
  createdAt: string;
  updatedAt: string;
}

export interface AccessRequest {
  id: string;
  userId: string;
  /**
   * The requester's name and address as they were at the time of the request.
   *
   * Copied rather than looked up because `userId` is a session subject, and a
   * session can come from a seeded administrator that has no record in the
   * store at all. Without this, a request from such an account could be listed
   * but never actioned — the review route would find no user to notify.
   */
  userName: string;
  userEmail: string;
  datasetId: string;
  purpose: Purpose;
  intendedUse: string;
  requestedFormat: string;
  organization: string;
  reason: string;
  comments: string;
  status: RequestStatus;
  reviewedBy: string | null;
  reviewerNotes: string | null;
  requestedAt: string;
  reviewedAt: string | null;
  /** When an approval stops being usable. */
  expiresAt: string | null;
}

/** Whether the store can actually be reached, and why not when it cannot. */
export interface StoreHealth {
  ok: boolean;
  /** A short reason, for the server log. Never a connection string. */
  detail: string;
}

/** A message the platform would have emailed. */
export interface OutboxMessage {
  id: string;
  to: string;
  subject: string;
  body: string;
  sentAt: string;
}

/**
 * Everything the access-control system persists.
 *
 * The application talks to this and never to a storage engine, so moving from
 * the in-memory implementation to a database is a new implementation of this
 * interface and no change anywhere else. Methods are async for that reason:
 * the in-memory one does not need to be, a database one will.
 */
export interface Store {
  createUser(user: User): Promise<User>;
  findUserByEmail(email: string): Promise<User | null>;
  findUserById(id: string): Promise<User | null>;
  findUserByVerificationToken(token: string): Promise<User | null>;
  updateUser(id: string, patch: Partial<User>): Promise<User | null>;
  listUsers(): Promise<User[]>;

  listDatasets(): Promise<Dataset[]>;
  findDataset(id: string): Promise<Dataset | null>;

  createRequest(request: AccessRequest): Promise<AccessRequest>;
  findRequest(id: string): Promise<AccessRequest | null>;
  listRequestsForUser(userId: string): Promise<AccessRequest[]>;
  listAllRequests(): Promise<AccessRequest[]>;
  updateRequest(id: string, patch: Partial<AccessRequest>): Promise<AccessRequest | null>;

  recordMessage(message: OutboxMessage): Promise<void>;
  listMessages(): Promise<OutboxMessage[]>;

  /**
   * Whether this store can be reached right now.
   *
   * `durable` is a claim about the implementation; this is a fact about the
   * deployment. A database that is configured but unreachable would otherwise
   * let the status route report that records persist while every write was
   * failing, which is the one thing it exists not to do.
   */
  check(): Promise<StoreHealth>;

  /** What this implementation is, for the deployment status route. */
  readonly description: string;
  readonly durable: boolean;
}
