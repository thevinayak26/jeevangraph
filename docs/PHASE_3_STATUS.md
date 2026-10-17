# Phase 3 status

Recorded 18 October 2026, Asia/Kolkata.

## Implemented locally

- Authorized numerical evidence with raw source values/units, conversion and explicit exclusions.
- Separate permission for doctor numerical analysis; read-only grants stay read-only.
- Current-source HealthGraph in 3D, 2D and accessible list modes.
- Reduced-motion fallback and escaped 3D tooltips.
- Adult-relative invitation/acceptance without implicit medical access.
- Independent condition sharing, expiry, revocation, withdrawal and relationship termination.
- Private patient-reported family history and first/second-degree biological context.
- Source supersession invalidates affected fresh trends, graph nodes and document-linked assertions.
- Automatic fresh permission checks while the evidence page is visible, with fail-closed clearing.
- Optional fixed-fictional-fact Gemini adapter and no-key fallback.

## Evidence

- Production build, TypeScript and ESLint passed.
- 28 unit/domain tests passed.
- Disposable PostgreSQL RLS matrix passed for records and family permissions.
- 21 Phase 2 connected regression checks passed.
- 22 Phase 3 connected checks passed using actual local Supabase sessions and source storage.
- Browser checks exercised graph modes, labeled 3D navigation, source details, reduced motion, reported-history save/withdraw and no-key explanation.
- Desktop (1440 px) and mobile (375 px) evidence/family layouts were inspected with no document-level horizontal overflow.
- Revoking a relative share removed the condition from the already-open graph/list after its next permission refresh.
- Runtime-only dependency audit reported zero advisories. Known development-tool findings are documented in the setup guide.

## Scope boundaries

This is a synthetic local implementation. No hosted deployment, successful live Gemini request, clinical validation, verified biological identity, guardian/minor authorization, OCR or ABDM/hospital integration is claimed. Gemini remains disabled without explicit server configuration and per-request disclosure. Family history is not genetic proof. Read/analysis grants do not grant onward family access.

See `PHASE_3_SETUP.md` for setup, migrations, exact contracts, cost caveats and limits.
