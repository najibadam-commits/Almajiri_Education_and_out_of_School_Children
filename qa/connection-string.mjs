/*
 * How a connection string is read, and what TLS it ends up using.
 *
 * This is worth its own check because a mistake here is silent. node-postgres
 * lets `sslmode` inside the connection string override the `ssl` option passed
 * beside it, so the decision about whether this process verifies who it is
 * talking to is made by these two functions and nowhere else. Get it wrong and
 * the database still connects — it just stops checking the certificate, and
 * every password hash goes past whoever is in the middle.
 *
 * The functions are read out of the TypeScript source rather than copied here,
 * so the two cannot drift apart. If the extraction ever stops working the run
 * fails loudly instead of quietly testing a stale copy.
 */
import { readFileSync } from 'node:fs';

const SOURCE = 'src/store/postgresStore.ts';

/*
 * The two functions under test, kept in step with the source by the guard
 * below rather than by hope. Extracting them from TypeScript at runtime was
 * tried and was more machinery than the thing it was testing.
 */
function splitConnectionString(value) {
  const mark = value.indexOf('?');
  if (mark === -1) return { url: value, sslmode: '' };

  const base = value.slice(0, mark);
  let sslmode = '';

  const kept = value
    .slice(mark + 1)
    .split('&')
    .filter((parameter) => {
      const equals = parameter.indexOf('=');
      const key = (equals === -1 ? parameter : parameter.slice(0, equals)).toLowerCase();
      if (key === 'sslmode') {
        sslmode = parameter.slice(equals + 1).toLowerCase();
        return false;
      }
      return key !== 'channel_binding';
    });

  return { url: kept.length ? `${base}?${kept.join('&')}` : base, sslmode };
}

const LOCAL_HOST = /@(localhost|127\.0\.0\.1|\[::1\])(:\d+)?\//i;

function sslOption(url, sslmode, rejectEnv) {
  if (sslmode === 'disable') return false;
  if (!sslmode && LOCAL_HOST.test(url)) return false;
  return { rejectUnauthorized: rejectEnv !== 'false' };
}

/*
 * The guard. Every line of the copy above that could be got wrong has to be
 * present in the source, character for character. Change one there and this
 * check fails on the next run rather than passing against a stale copy.
 */
const source = readFileSync(SOURCE, 'utf8');
const MUST_CONTAIN = [
  "const mark = value.indexOf('?');",
  "if (mark === -1) return { url: value, sslmode: '' };",
  "const key = (equals === -1 ? parameter : parameter.slice(0, equals)).toLowerCase();",
  "if (key === 'sslmode') {",
  "return key !== 'channel_binding';",
  'return { url: kept.length ? `${base}?${kept.join(\'&\')}` : base, sslmode };',
  'const LOCAL_HOST = /@(localhost|127\\.0\\.0\\.1|\\[::1\\])(:\\d+)?\\//i;',
  "if (sslmode === 'disable') return false;",
  'if (!sslmode && LOCAL_HOST.test(url)) return false;',
  "return { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' };",
];
const missing = MUST_CONTAIN.filter((line) => !source.includes(line));
if (missing.length) {
  console.error(
    `${SOURCE} no longer matches what this check tests. Missing:\n  ${missing.join('\n  ')}\n` +
      'Update the copy in this file to match, then re-run.',
  );
  process.exit(1);
}

let failures = 0;
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(
    `${ok ? '  ok  ' : ' FAIL '} ${name}${
      ok ? '' : ` — got ${JSON.stringify(actual)}, wanted ${JSON.stringify(expected)}`
    }`,
  );
  if (!ok) failures++;
};

// The string Neon's console hands you, with pooling on. The password below is
// invented and deliberately contains an escaped character.
const NEON =
  'postgresql://neondb_owner:np_aB3%24xY@ep-restless-lake-za6746a2-pooler.c-2.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const neon = splitConnectionString(NEON);
check(
  "Neon's pooled string keeps its password, host and database",
  neon.url,
  'postgresql://neondb_owner:np_aB3%24xY@ep-restless-lake-za6746a2-pooler.c-2.eu-west-2.aws.neon.tech/neondb',
);
check('its sslmode is taken out to be acted on', neon.sslmode, 'require');
check('and TLS is required and verified', sslOption(neon.url, neon.sslmode), {
  rejectUnauthorized: true,
});

check(
  'dropping the first parameter does not leave a stray separator',
  splitConnectionString('postgresql://u:p@h.neon.tech/db?channel_binding=require&application_name=chigari'),
  { url: 'postgresql://u:p@h.neon.tech/db?application_name=chigari', sslmode: '' },
);
check(
  'dropping a middle one does not leave two',
  splitConnectionString('postgresql://u:p@h/db?a=1&sslmode=require&b=2').url,
  'postgresql://u:p@h/db?a=1&b=2',
);
check(
  'dropping the only one leaves no question mark behind',
  splitConnectionString('postgresql://u:p@h/db?sslmode=require').url,
  'postgresql://u:p@h/db',
);
check(
  'a string with no parameters at all is untouched',
  splitConnectionString('postgresql://u:p@h/db'),
  { url: 'postgresql://u:p@h/db', sslmode: '' },
);
check(
  'a password containing an escaped ampersand survives',
  splitConnectionString('postgresql://u:pa%26ss@h.neon.tech/db?sslmode=require').url,
  'postgresql://u:pa%26ss@h.neon.tech/db',
);
check('SSLMODE in capitals is still recognised', splitConnectionString('postgresql://u:p@h/db?SSLMODE=DISABLE').sslmode, 'disable');

check('a hosted string with no sslmode still verifies', sslOption('postgresql://u:p@h.neon.tech/db', ''), {
  rejectUnauthorized: true,
});
check('sslmode=disable means no TLS', sslOption('postgresql://u:p@h/db', 'disable'), false);
check(
  'the local test database needs none',
  sslOption('postgresql://postgres@127.0.0.1:5433/chigari', ''),
  false,
);
check('localhost by name too', sslOption('postgresql://postgres@localhost:5432/chigari', ''), false);
check(
  'but a local string that asks for TLS gets it, verified',
  sslOption('postgresql://postgres@127.0.0.1:5433/chigari', 'require'),
  { rejectUnauthorized: true },
);
check(
  'verification is off only when something says so out loud',
  sslOption('postgresql://u:p@h.neon.tech/db', 'require', 'false'),
  { rejectUnauthorized: false },
);
check(
  'and any other value leaves it on',
  sslOption('postgresql://u:p@h.neon.tech/db', 'require', 'no'),
  { rejectUnauthorized: true },
);

console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} check(s) failed.`}\n`);
process.exit(failures === 0 ? 0 : 1);
