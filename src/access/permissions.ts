/**
 * Who may do what.
 *
 * This is the single place a permission is defined. Routes ask `can()`; the
 * interface asks the same function so that what it shows and what the server
 * allows cannot drift apart. Hiding a control is a courtesy to the user, never
 * the enforcement — every protected route checks for itself.
 */

export const ACCESS_ROLES = ['VISITOR', 'AUTHORIZED_USER', 'ADMINISTRATOR'] as const;
export type AccessRole = (typeof ACCESS_ROLES)[number];

export const PERMISSIONS = [
  'VIEW_PUBLIC_DATA',
  'REQUEST_DATA_ACCESS',
  'VIEW_OWN_REQUESTS',
  'DOWNLOAD_APPROVED_DATA',
  'MANAGE_USERS',
  'MANAGE_DATASETS',
  'REVIEW_DOWNLOAD_REQUESTS',
  'APPROVE_DATA_REQUESTS',
  'REJECT_DATA_REQUESTS',
  'MANAGE_PLATFORM',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<AccessRole, readonly Permission[]> = {
  VISITOR: ['VIEW_PUBLIC_DATA'],
  AUTHORIZED_USER: [
    'VIEW_PUBLIC_DATA',
    'REQUEST_DATA_ACCESS',
    'VIEW_OWN_REQUESTS',
    'DOWNLOAD_APPROVED_DATA',
  ],
  ADMINISTRATOR: [
    'VIEW_PUBLIC_DATA',
    'REQUEST_DATA_ACCESS',
    'VIEW_OWN_REQUESTS',
    'DOWNLOAD_APPROVED_DATA',
    'MANAGE_USERS',
    'MANAGE_DATASETS',
    'REVIEW_DOWNLOAD_REQUESTS',
    'APPROVE_DATA_REQUESTS',
    'REJECT_DATA_REQUESTS',
    'MANAGE_PLATFORM',
  ],
};

export function isAccessRole(value: unknown): value is AccessRole {
  return typeof value === 'string' && (ACCESS_ROLES as readonly string[]).includes(value);
}

export function permissionsFor(role: AccessRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

/**
 * Whether a role may do something.
 *
 * An account that has not verified its email is held at visitor permissions:
 * it can read everything a visitor can and nothing that carries its identity.
 * That is what lets someone browse while their account is pending, as the
 * brief asks, without the pending account being worth anything yet.
 */
export function can(
  role: AccessRole,
  permission: Permission,
  options: { verified?: boolean } = {},
): boolean {
  const effective =
    role !== 'VISITOR' && options.verified === false ? 'VISITOR' : role;
  return ROLE_PERMISSIONS[effective].includes(permission);
}

/** A label for the access mode, shown in the header. */
export function roleLabel(role: AccessRole): string {
  switch (role) {
    case 'VISITOR':
      return 'Visitor Mode';
    case 'ADMINISTRATOR':
      return 'Administrator';
    default:
      return 'Authorized User';
  }
}
