import { createMemoryStore } from './memoryStore';
import { createPostgresStore } from './postgresStore';
import type { Store } from './types';

/**
 * The storage seam.
 *
 * Everything that persists goes through this one object. `DATABASE_URL`
 * decides which implementation it is: PostgreSQL when it is set, memory when
 * it is not, so a fresh checkout runs with nothing to provision and a real
 * deployment keeps its records. No route, page or component knows which one
 * it got — they ask `store.durable` when it matters.
 *
 * The instance is cached on globalThis because a development server
 * re-imports modules between requests, which would otherwise hand every
 * request a fresh and empty store, and a serverless runtime re-uses a warm
 * process, which would otherwise open a new connection pool per request.
 */
declare global {
  var __chigariStore: Store | undefined;
}

function createStore(): Store {
  const url = process.env.DATABASE_URL?.trim();
  if (url) {
    try {
      return createPostgresStore(url);
    } catch (error) {
      // A malformed URL should not take the whole platform down, but it must
      // not pass unnoticed either: the deployment is about to lose records it
      // was told to keep, and /api/auth/status will say the store is not
      // durable.
      console.error(
        '[store] DATABASE_URL is set but a PostgreSQL store could not be created. ' +
          'Falling back to memory, which does not survive a restart. ' +
          (error instanceof Error ? error.message : String(error)),
      );
    }
  }
  return createMemoryStore();
}

export const store: Store = globalThis.__chigariStore ?? createStore();
globalThis.__chigariStore = store;

export type { Store } from './types';
