import { DATASETS } from './datasets';
import type { AccessRequest, Dataset, OutboxMessage, Store, User } from './types';

/**
 * The default store: in process memory.
 *
 * It is honest rather than clever. Everything the access-control system needs
 * works against it, so every flow can be exercised on a fresh deployment with
 * nothing to provision — but it does not survive a restart, and on a
 * serverless host that means it does not survive a cold start or a second
 * instance either. `durable` is false so the deployment can say so out loud
 * rather than quietly losing an approval.
 *
 * Swapping in a database is a second implementation of `Store`. Nothing
 * outside this folder knows which one it has.
 */
export function createMemoryStore(): Store {
  const users = new Map<string, User>();
  const requests = new Map<string, AccessRequest>();
  const outbox: OutboxMessage[] = [];
  const datasets: Dataset[] = [...DATASETS];

  const clone = <T>(value: T): T => structuredClone(value);
  const byEmail = (email: string) => email.trim().toLowerCase();

  return {
    description: 'In-memory (records are lost when the server restarts)',
    durable: false,

    async createUser(user) {
      users.set(user.id, clone(user));
      return clone(user);
    },
    async findUserByEmail(email) {
      const wanted = byEmail(email);
      for (const user of users.values()) if (byEmail(user.email) === wanted) return clone(user);
      return null;
    },
    async findUserById(id) {
      const user = users.get(id);
      return user ? clone(user) : null;
    },
    async findUserByVerificationToken(token) {
      if (!token) return null;
      for (const user of users.values()) if (user.verificationToken === token) return clone(user);
      return null;
    },
    async updateUser(id, patch) {
      const user = users.get(id);
      if (!user) return null;
      const next = { ...user, ...patch, id, updatedAt: new Date().toISOString() };
      users.set(id, next);
      return clone(next);
    },
    async listUsers() {
      return [...users.values()].map(clone);
    },

    async listDatasets() {
      return datasets.map(clone);
    },
    async findDataset(id) {
      const dataset = datasets.find((d) => d.id === id);
      return dataset ? clone(dataset) : null;
    },

    async createRequest(request) {
      requests.set(request.id, clone(request));
      return clone(request);
    },
    async findRequest(id) {
      const request = requests.get(id);
      return request ? clone(request) : null;
    },
    async listRequestsForUser(userId) {
      return [...requests.values()]
        .filter((r) => r.userId === userId)
        .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))
        .map(clone);
    },
    async listAllRequests() {
      return [...requests.values()]
        .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))
        .map(clone);
    },
    async updateRequest(id, patch) {
      const request = requests.get(id);
      if (!request) return null;
      const next = { ...request, ...patch, id };
      requests.set(id, next);
      return clone(next);
    },

    async recordMessage(message) {
      outbox.unshift(clone(message));
      // Enough to show what happened recently without growing without bound.
      if (outbox.length > 200) outbox.length = 200;
    },
    async listMessages() {
      return outbox.map(clone);
    },
  };
}
