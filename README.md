# JeevanGraph

## Phase 2: connected records and consent

The authenticated synthetic workspace is implemented and tested with local Supabase Auth, Storage and PostgreSQL. Open `/account`, then `/secure`. Existing role routes remain explicitly fictional previews.

See [Phase 2 setup and contracts](docs/PHASE_2_SETUP.md) and [verification status](docs/PHASE_2_STATUS.md). No hosted deployment or clinical validation is claimed. Use synthetic documents only.

A patient-controlled health-history workspace connecting source records, longitudinal measurements and family context.

## Included Phase 1 preview

- Responsive patient overview, timeline, searchable record library and source inspector.
- Four-point kidney measurement chart with a source-linked data table.
- Patient-reported biological/social family context and a 2D evidence map.
- Separate doctor, facility-admin and platform-admin previews.
- Light, dark and system appearance settings.
- Fictional fixtures only. Preview routes do not sign in or grant consent. Real sign-in and persistent consent are in the separate Phase 2 workspace; hospital connections and clinical validation are not included.

## Run locally

Requirements: Node 24.x and npm.

```bash
npm ci
npm run dev
```

Open the Local URL printed by the server. The root opens the patient workspace. The role selector opens explicitly labeled previews; it is not an authentication or authorization system.

## Checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

The domain tests verify fixture projection, source values, unknown dates and relationship handling. They do not prove database security. Phase 2 adds separate PostgreSQL access tests and connected Supabase session/storage tests; see the setup guide.

## Configuration

Copy `.env.example` to `.env.local` when connecting services. Keep private keys out of source control and client-side code.

- Supabase Auth/Postgres/private Storage is implemented for the connected workspace.
- Gemini Developer API `gemini-3.5-flash-lite` is selected for the optional later explanation adapter.
- The app makes no external inference calls. The synthetic preview runs without service credentials; connected records require Supabase configuration.
- The explanation feature must preserve a deterministic fallback, synthetic-only processing and current evidence permissions.

## Product flow and roadmap

- [Website flowchart](docs/WEBSITE_FLOWCHART.md)
- [Visual website flowchart](docs/WEBSITE_FLOWCHART.svg)
- [Four-phase implementation plan](docs/FOUR_PHASE_PLAN.md)
- [Phase 1 verification](docs/PHASE_1_STATUS.md)

## Data boundaries

- All people, facilities, results and identifiers are fictional.
- Relatives' independently owned source records are excluded from the index-patient workspace projection.
- Doctor and operational previews receive no patient record, measurement or family payload.
- The synthetic seed is a development asset, not a patient database. Never replace it with real medical data or ship real records as static assets.
- The source specimens are not valid prescriptions, reports or vaccination certificates.

## Repository

Source repository: [thevinayak26/jeevangraph](https://github.com/thevinayak26/jeevangraph).

Track application source, documentation, small fictional fixtures and the dependency lockfile. Exclude credentials, build output and local runtime/test artifacts.
