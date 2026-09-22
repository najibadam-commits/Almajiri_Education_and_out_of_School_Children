import type { Dataset } from './types';

const NOW = '2026-09-01T00:00:00.000Z';

/**
 * The catalogue.
 *
 * These describe the sample dataset the dashboard already ships, split the way
 * someone would actually ask for it. `fileLocation` is resolved on the server
 * when a download is served and is never sent to the browser.
 *
 * Access level is what decides the workflow: PUBLIC is served to anyone with
 * an account, RESTRICTED goes through request and review, ADMIN_ONLY is not
 * offered for request at all.
 */
export const DATASETS: readonly Dataset[] = [
  {
    id: 'schools-by-state',
    name: 'Almajiri Schools by State',
    description:
      'One row per school: state, LGA, type, ownership, enrolment, mallams and the infrastructure, curriculum and health indicators.',
    accessLevel: 'RESTRICTED',
    fileLocation: 'data/schools.json',
    formats: ['CSV', 'JSON'],
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'learner-statistics',
    name: 'Learner Statistics',
    description:
      'Enrolment by state, LGA and age band, with the pupils-per-mallam ratio for each area.',
    accessLevel: 'RESTRICTED',
    fileLocation: 'derived/learners',
    formats: ['CSV'],
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'infrastructure-indicators',
    name: 'Infrastructure and WASH Indicators',
    description:
      'Per-school infrastructure and water, sanitation and hygiene indicators, as the dashboard charts them.',
    accessLevel: 'RESTRICTED',
    fileLocation: 'derived/infrastructure',
    formats: ['CSV'],
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'state-summary',
    name: 'State Coverage Summary',
    description:
      'School and learner counts for each of the 37 states, the figures behind the dashboard overview.',
    accessLevel: 'PUBLIC',
    fileLocation: 'derived/state-summary',
    formats: ['CSV'],
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'platform-audit',
    name: 'Platform Audit Log',
    description: 'Account and data-access activity. Held for administrators.',
    accessLevel: 'ADMIN_ONLY',
    fileLocation: 'internal/audit',
    formats: ['CSV'],
    createdAt: NOW,
    updatedAt: NOW,
  },
];

/** The datasets a user may ask for. */
export const REQUESTABLE = DATASETS.filter((d) => d.accessLevel === 'RESTRICTED');
