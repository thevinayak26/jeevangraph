# JeevanGraph: four implementation phases

## Phase 1: foundation and product experience

**Target: hours 0-3.** Deliver a running, responsive website that the team can navigate before external accounts are configured.

- Initialize a separate source repository with exact dependency pins and an environment example.
- Establish a clinical design system, navigation, mobile layouts, light/dark theme and role-specific previews.
- Load the canonical fictional patient data through a server-side repository layer.
- Implement patient overview, searchable document library, source detail, chronological timeline and laboratory chart.
- Implement a patient-reported family view and an evidence-map foundation.
- Provide a denied-by-default doctor preview, plus sanitized facility/platform operations previews.
- Add configuration boundaries for future Supabase and Gemini integration; never expose private API keys.
- Validate build, types, relevant data tests and desktop/mobile behavior.

**Exit gate:** the website runs without credentials; every major workspace can be inspected; source values match the fixtures; preview and nonclinical boundaries remain visible. Real login, persistent consent, upload processing and 3D interaction are later phases.

## Phase 2: secure records and consent

Implemented and verified against local Supabase sessions. See [Phase 2 status](PHASE_2_STATUS.md) and [setup](PHASE_2_SETUP.md). Hosted deployment remains unverified.

**Target: hours 3-7.** Replace preview behavior with authenticated, persistent patient-controlled access.

- Supabase Auth, trusted memberships and active organization context.
- Postgres migrations and RLS for records, versions, observations and grants.
- Private Storage, scoped uploads, manual field review and immutable versions.
- Named-recipient, purpose-bound, time-limited, record-version consent.
- Expiry/revocation checks, original-source delivery and sanitized audit history.
- Patient-authorized simulated facility ingestion with idempotency and replay protection.
- Wrong-user, admin-overreach, object access and revocation tests through actual sessions.

**Exit gate:** patient uploads/reviews one report, grants four selected lab versions to a doctor, and revokes access successfully. No connected mode is declared secure solely because the preview UI hides a button.

## Phase 3: evidence intelligence, HealthGraph and family sharing

Implemented and verified locally with separate numerical-analysis permission, current-source graph projections and independent adult-relative sharing. See [Phase 3 status](PHASE_3_STATUS.md) and [setup](PHASE_3_SETUP.md). Hosted behavior and live model access remain unverified.

**Target: hours 7-12.** Add intelligence on top of authorized evidence.

- Deterministic normalization and source-linked kidney trend, including ambiguous-unit/date exclusion.
- Optional Gemini Developer API `gemini-3.5-flash-lite` for a constrained explanation of bundled synthetic evidence.
- No-key explanation template and timeout/quota/schema-failure fallback.
- HealthGraph 3D from the authorized projection, with 2D/list and reduced-motion fallbacks.
- One-time adult-relative invitations; acceptance and medical sharing remain separate actions.
- Independently revocable relative assertion shares; no implicit onward sharing to clinicians.
- Source correction and revocation invalidate affected graph/insight output.

**Exit gate:** the full evidence story works with the cloud model disabled; optional generated wording adds no unsupported values or diagnoses; relatives' unshared data never enters graph/API output.

## Phase 4: release verification and presentation

Release preparation and optional onboarding are implemented locally. Hosted configuration and final visual verification remain pending. See [current release status](PHASE_4_STATUS.md).

**Target: hours 12-16.** Freeze scope and prepare a demonstrable release.

- Run the access matrix, ingestion cases, deterministic edge cases and hosted smoke tests.
- Review keyboard access, mobile layout, dark mode and graph fallbacks.
- Verify actual free account access/quotas and hosting eligibility.
- Inspect tracked source for credentials, local files, unfinished claims and unnecessary artifacts.
- Rehearse the six-minute patient/facility/doctor/family/revocation story.
- Prepare a local deterministic fallback and explicitly labeled prerecorded contingency.

**Exit gate:** no critical privacy/access failures, accurate implementation status, stable presentation and no unsupported live-integration or clinical claims.

## Four-person ownership

| Engineer | Ownership                                                              | Coordination boundary                          |
| -------- | ---------------------------------------------------------------------- | ---------------------------------------------- |
| E1       | Shell, patient screens, upload/review and themes                       | Shared navigation and UI primitives            |
| E2       | Supabase/Auth, RLS, consent, private files and ingestion               | Sole migration owner; reviews permissions      |
| E3       | Clinical-demo fixtures, charts, deterministic rules and Gemini adapter | Evidence schema and numerical correctness      |
| E4       | Family graph/sharing, HealthGraph, operations views and demo tests     | Consumes authorized DTOs; no raw chart queries |

## Eight-hour contingency

- Preserve a coherent core by reducing 3D polish, browser OCR and working relative invitations first.
- Keep authentication, explicit consent, source provenance, revocation and synthetic labels.
- If only preview mode works, describe it as a prototype; do not claim the connected security milestone passed.

## Repository conventions

- Track product source, technical documentation, small fictional fixtures and dependency locks.
- Ignore local environments, credentials, dependencies, build output and browser-test artifacts.
- Use accurate technical commit messages and the actual contributor's configured identity.
- Keep private conversation archives and scratch material outside the source repository.
- Retain dependency licenses and any disclosures required by the event or submission terms.
