# CHIGARI Almajiri Education Information System

A web application built from the approved HTML prototype. The login page is the
entrance, and `/dashboard` is the same dashboard the prototype already had —
same layout, same green identity, same Map / Chart / Grid behaviour — now with
routing, a protected session, typed data and components.

> **CONCEPT PROTOTYPE · SAMPLE DATA ONLY.** Every school, figure, rating and
> trend in this application is randomly generated for demonstration. None of it
> is real Chigari Foundation or government data. School locations are random
> points inside real LGA boundaries. The ribbon that says so is on every page of
> the dashboard and must stay there until a real dataset is connected.

## Running it

```bash
npm install
cp .env.example .env.local   # optional; see "Authentication"
npm run dev                  # http://localhost:3000
```

```bash
npm run build && npm run start   # production build
npm run typecheck                # tsc --noEmit
npm run lint
```

Sign in with the demo account, then you land on `/dashboard`.

## Putting it online

The app is a standard Next.js application and needs a host that runs server
code: `/dashboard` is protected in middleware, and sign-in is a route handler.
A static-file host such as GitHub Pages cannot serve it.

On [Vercel](https://vercel.com/new): sign in with GitHub, import this
repository, and set these two environment variables before the first deploy.
No other configuration is needed — the framework, build command and output
directory are all detected.

| Variable | Value |
| --- | --- |
| `SESSION_SECRET` | any random string of 16+ characters; `openssl rand -base64 32` generates one |
| `DEMO_AUTH_USERS` | `someone@chigari.org\|a-password-you-choose\|Their Name\|Their Role` |

Set both for the Production, Preview and Development environments, then
redeploy — a hosting dashboard does not apply a new variable to a build that
has already happened.

`.env.example` wraps the accounts line in quotes because that is what a `.env`
file needs; a hosting dashboard takes the value literally and does not. Pasting
the quoted line into one is easy to do and used to fail with nothing more than
"Those credentials were not recognised", so a wrapping pair of quotes is now
stripped either way.

**Choose a different password from the one in `.env.example`.** That file is
public in this repository, so anything in it is public too. Add one account per
person you are sharing the link with, separated by semicolons, so you can tell
who is who and withdraw one later:

```
DEMO_AUTH_USERS="ceo@chigari.org|first-password|A Name|Programme Director; partner@example.org|second-password|Another Name|Partner"
```

A deployed build refuses to sign anyone in if `DEMO_AUTH_USERS` is unset, and
refuses to build at all if `SESSION_SECRET` is missing, so neither can be
forgotten silently.

If sign-in is refused and you cannot tell why, open `/api/auth/status` on the
deployment. It reports how many accounts the build parsed, whether the session
secret is set, and which commit is live — a count, some booleans and a short
sha, never a username or a password:

```json
{ "provider": "Demo accounts", "demo": true, "accountsConfigured": 2,
  "sessionSecretSet": true, "build": "27ed2ba" }
```

`accountsConfigured: 0` means the variable never reached this build. A count
you do not recognise means it reached it as something other than what you
pasted. The expected count with the accounts still live means the username or
password does not match. The route is there because `Those credentials were not
recognised` cannot distinguish those three, and on a hosted build there is
otherwise nothing to look at but server logs.

Remember what the deployed site is: a concept prototype full of invented data,
reachable by anyone who has the link and an account. The sample-data ribbon is
what keeps that honest, and it stays on every page.

## The journey

```
/login  →  authenticate  →  /dashboard
```

- Visiting `/dashboard` without a session redirects to `/login`, keeping the
  view you asked for in `?next=` so a shared link survives the trip.
- Refreshing `/dashboard` with a valid session stays on the dashboard.
- Logging out from the account menu clears the session and returns to `/login`.

## Authentication

`/dashboard` is protected in `src/middleware.ts`, which verifies a signed,
HttpOnly session cookie. It is checked on the server before the page renders,
not hidden in the browser.

**The current provider is demo auth and is not production auth.** It lives in
`src/auth/demoAuthProvider.ts` and is clearly marked. It checks a username and
password against a list configured in the environment — nothing is hard-coded
in source, and no password reaches the browser.

```
DEMO_AUTH_USERS="user@example.org|the-password|Display Name|Role; ..."
SESSION_SECRET=...        # required in production
```

Without `DEMO_AUTH_USERS`, development falls back to `demo@chigari.org` /
`chigari-demo` and logs a warning; a production build refuses to sign anyone in
rather than accepting a published default.

To connect a real identity provider, implement `AuthProviderAdapter`
(`src/auth/types.ts`) and point `activeProvider` in `src/auth/authService.ts`
at it. The middleware, the login page and the dashboard do not change.

## Where things are

```
src/
├── app/
│   ├── layout.tsx            root layout, theme bootstrap, fonts
│   ├── login/page.tsx        the login page
│   ├── dashboard/page.tsx    the protected dashboard
│   ├── api/auth/…            login, logout, session routes
│   └── globals.css           the prototype's stylesheet, carried over
├── auth/                     session signing, demo provider, the auth seam
├── components/
│   ├── auth/LoginForm.tsx
│   └── dashboard/
│       ├── DashboardShell, DashboardHeader, FilterSidebar, ViewSwitcher, SearchBox
│       ├── map/              SchoolMap, MapLegend, MapBreadcrumb, MapLayersControl, OverviewPanel
│       ├── charts/           ProgrammeOverview, ChartCard
│       ├── grid/             SchoolGrid, SchoolCard
│       ├── modals/           SchoolProfileModal, FeedbackModal, Modal
│       └── common/           Kpi, EmptyState, Toast, Stars, ConceptRibbon, Credits, SampleDataBadge
├── data/                     types.ts, indicators.ts (labels, bit order, constants)
├── lib/                      filters, aggregations, charts, map, csv, formatting
├── services/dataService.ts   the data seam
├── state/                    DashboardProvider, dashboardReducer
└── middleware.ts             route protection
```

## Data

The prototype carried a 1.5 MB dataset and a 48 KB basemap inline, which is why
the HTML file was 1.7 MB. Both are now separate files under `public/data/`,
fetched at runtime:

| File | Size | What it is | When it loads |
| --- | --- | --- | --- |
| `schools.json` | 580 KB | 5,190 school records, tuple-encoded | with the dashboard |
| `places.json` | 29 KB | state and LGA names, no geometry | with the dashboard |
| `catalog.json` | <1 KB | type, ownership and zone labels | with the dashboard |
| `states.geojson` | 65 KB | 37 state boundaries | map view only |
| `lgas.geojson` | 885 KB | 774 LGA boundaries | map view only |
| `basemap.json` | 47 KB | neighbouring countries, rivers, lakes, cities | map view only |

Records stay tuple-encoded on the wire and are expanded once on load, which is
what keeps the school payload under a megabyte. Place names are split out of the
geometry so the chart and grid views never pay for the 885 KB of LGA polygons.

### The data seam

Views call `dataService` (`src/services/dataService.ts`) and never read a data
file directly:

```
getCatalog()  getSchools()  getSchoolById()  getStates()  getLGAs()
getBoundaries()  getBasemap()  getDashboardAggregates()
```

Swapping `dataService` for an API-backed implementation is the only change
needed when a real backend arrives.

### Indicator bit order is load-bearing

`infra`, `integ` and `health` are bitmasks. The position of each label in
`src/data/indicators.ts` is its bit position in the record. Reordering those
arrays silently changes what every filter, chart and profile means.

### Filter semantics

- Zone, state, LGA and the search query each narrow the set.
- **Infrastructure & WASH, Curriculum integration, Health & Protection**: a
  school must have **every** ticked item.
- **School Type, Ownership, Chigari Support, School Status**: a school matching
  **any** ticked option is shown.

These are the prototype's semantics. They were checked against it directly: the
counts for seven filter combinations match the prototype's own algorithm exactly.

## Notes on the port

**The map instance is created once.** Filter changes update its layers —
polygons, count bubbles, points, popups — rather than rebuilding the map, so pan
and zoom survive every interaction. Leaflet is loaded client-side only
(`ssr: false`), so there is no `window is not defined` on the server.

**While the chart or grid view is on screen the map keeps its state but does no
work.** A hidden container has no size and Leaflet cannot project against one,
so redraws and any owed camera move are deferred until the map is visible again.

**Theme** is remembered in `localStorage` and applied before first paint, so
there is no flash of the wrong theme. Chart colours are read from CSS custom
properties, so switching theme rebuilds the charts with the new palette.

**URL state.** The view, zone, state, LGA, query and sort are reflected in the
URL by name, so `/dashboard?view=map&state=Kano&lga=Nassarawa` can be
bookmarked and shared, and browser back and forward work.

**Fonts** are self-hosted through `next/font` instead of fetched from Google
Fonts, so the dashboard renders with its intended metrics even offline. Leaflet
and Chart.js are bundled rather than loaded from a CDN, for the same reason.

### Four deliberate differences from the prototype

1. **The account menu is new.** The prototype had no signed-in user and so
   nowhere to log out from. The menu sits in the header and is built from the
   same tokens as the rest of it. It widens the header's action group slightly,
   which shifts the centred search box by about 25px.
2. **The overview toggle moved below the map-layers button.** In the prototype
   both sat at the same spot and the overview toggle covered the layers button,
   making the layer control unclickable whenever the overview panel was open.
   They are now stacked at the map's right edge and both work.
3. **The Infrastructure and Health chart tooltips now show their value.** The
   prototype's shared tooltip read the category axis on those horizontal bar
   charts, so every bar reported `0%` regardless of its value.
4. **The login page is markup, not a picture of a page.** The artwork supplied
   with the prototype is a flattened page mock-up: the photograph with a
   wordmark, a top navigation, a headline, a strapline, a footer strip, an
   emblem and a login card all painted into it. The prototype laid that image
   out full bleed and drew a real card on top. Because the rest was pixels it
   could not be re-worded, it did not re-flow, and it was cropped at any window
   shape other than the artwork's own — and the painted card, exactly 470px
   wide like the real one, showed out from behind it at every size but
   1536x1024. All of it is markup now and the image underneath is only the
   photograph. See [The login artwork](#the-login-artwork).

Everything else is carried over: the stylesheet is the prototype's, apart from
the dashboard's scroll lock and full-viewport height moving from `<body>` onto
`.app` so the login page can share the same document.

### The login artwork

Three build steps turn the supplied files into the assets the page uses. They
are one-offs — the outputs are committed — but they are kept so the edits are
reproducible and auditable rather than a binary that mysteriously differs from
what Najib supplied. Sources live in `assets/`; the artwork itself is the file
from the prototype folder.

| Script | In | Out |
| --- | --- | --- |
| `build-login-photo.mjs` | the artwork | `public/chigari-login-photo.png` |
| `build-commission-logo.mjs` | `assets/national-commission-logo-source.jpg` | `public/national-commission-logo.png` |
| `build-foundation-logo.mjs` | `assets/chigari-foundation-logo-source.png` | `public/chigari-logo.png` |

`build-login-photo.mjs` is the interesting one. Painted lettering is thin,
bright and sits on a darker photograph, so it is found by colour rather than by
blanking rectangles, and the surrounding photograph is diffused into the gaps it
leaves — which keeps the veranda, the courtyard and the children intact. The
footer strip is the exception: its lettering, icons and hairline rules are dark
in absolute terms and only stand out against what surrounds them, so there it
looks for local contrast instead. The login card is too large to diffuse into,
so its area is interpolated down each column from the photograph above and below
it and quietly vignetted; the sign-in card covers the middle of it.

## Not built, on purpose

The future modules sketched in the brief — `/children`, `/tsangaya`,
`/mallams`, `/geography`, `/data-quality`, `/cases`, `/reports`, `/admin` — are
not implemented, and neither is a backend. The architecture leaves room for them
without anticipating them.

## Credits

Boundaries: [geoBoundaries](https://www.geoboundaries.org) (Runfola et al. 2020),
from GRID3 Nigeria LGA boundaries, CC BY 4.0. Basemap context: Natural Earth.
© OpenStreetMap contributors, © CARTO. The Chigari Foundation logo is used for
this proposal only. The dashboard layout is modelled on the NPHCDA PHC
infographic.
