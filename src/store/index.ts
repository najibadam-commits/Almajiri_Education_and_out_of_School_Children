import { createMemoryStore } from './memoryStore';
import type { Store } from './types';

/**
 * The storage seam.
 *
 * Everything that persists goes through this one object. To move the platform
 * onto a database, write a second implementation of `Store` and return it
 * here; no route, page or component changes.
 *
 * The instance is cached on globalThis because a development server re-imports
 * modules between requests, which would otherwise hand every request a fresh
 * and empty store.
 */
declare global {
  var __chigariStore: Store | undefined;
}

export const store: Store = globalThis.__chigariStore ?? createMemoryStore();
globalThis.__chigariStore = store;

export type { Store } from './types';
