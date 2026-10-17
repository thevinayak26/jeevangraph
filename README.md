# JeevanGraph

A patient-controlled health-history workspace connecting source records, longitudinal measurements and family context.

## Current release: Phase 1

- Responsive patient overview, timeline, searchable record library and source inspector.
- Four-point kidney measurement chart with a source-linked data table.
- Patient-reported biological/social family context and a 2D evidence map.
- Separate doctor, facility-admin and platform-admin previews.
- Light, dark and system appearance settings.
- Fictional fixtures only. No real sign-in, persistent consent, hospital connection or clinical validation is enabled in this release.

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

The domain tests verify fixture projection, source values, unknown dates and relationship handling. They do not prove database security; Supabase sessions, RLS and real consent are Phase 2.

## Configuration

Copy `.env.example` to `.env.local` when connecting services. Keep private keys out of source control and client-side code.

- Supabase Auth/Postgres/private Storage is the planned persistent backend.
- Gemini Developer API `gemini-3.5-flash-lite` is selected for the optional later explanation adapter.
- Phase 1 makes no external inference calls and runs without a key.
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
