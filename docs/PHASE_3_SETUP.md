# Phase 3: evidence intelligence, HealthGraph and family consent

Status recorded 18 October 2026, Asia/Kolkata. This is a locally verified synthetic development release. Hosted deployment and live Gemini access are not claimed.

## What is included

- Deterministic, source-linked creatinine observations from reviewed, authorized versions.
- Separate patient series, explicit unit normalization, source excerpts, exact dates and exclusions.
- Original reported eGFR values without recalculation, disease staging or diagnosis.
- Interactive 3D HealthGraph, a labeled 2D view, keyboard-operable evidence list and reduced-motion fallback.
- Self-attested adult-relative invitations with a named recipient, one-use secret and 24-hour expiry.
- Patient-reported family context, independently owned condition entries and separate relative-sharing receipts.
- Exact-recipient, purpose-bound and independently expiring/revocable family-condition sharing.
- Source correction, assertion withdrawal, relationship termination and consent revocation remove affected data from fresh derived output.
- Separate permission for numerical analysis. Existing Phase 2 read grants are not expanded automatically.
- Optional Gemini selection of approved fictional fact IDs/templates, with a fully local deterministic fallback. No private record content or family conditions are passed to this adapter.

## Start and open

From `/home/vinayak/dev/jeevangraph`, with the existing local Supabase backend running:

```bash
npm ci
npx --yes supabase@2.121.0 migration up --local
npm run dev -- --port 3102
```

If the production preview is already running on port 3102, use that instance rather than starting another process on the same port.

Pages:

- `/account`: account access.
- `/secure`: private records, manual review and doctor consent.
- `/secure/intelligence`: authorized numerical evidence, HealthGraph and visible family context.
- `/secure/family`: reported history, adult-relative links, condition entries and explicit sharing.

The browser is left signed into a synthetic Phase 3 demonstration account. Local test credentials are in ignored `.env.phase3-users.local.json`. They are never committed. A normal new account has no access to those fixtures or other accounts' charts.

The original Phase 1 role routes still show fictional previews. Selecting a preview role never grants authenticated permissions.

## Migrations and hosting

Apply in timestamp order:

1. `202610180001_secure_records.sql`: Phase 2 private records and consent.
2. `202610180002_evidence_family.sql`: source supersession and separate family boundaries.
3. `202610180003_analysis_consent.sql`: explicit read-plus-analysis grants and analysis projection.

For an existing hosted Phase 2 project, apply only the two new migrations using your normal migration workflow. Do not apply test bootstrap SQL to a real Supabase project. Configure the same URL, publishable key and server-only service-role key described in `PHASE_2_SETUP.md` and rebuild the website.

No hosted project was configured or modified during local implementation. Hosted access-matrix tests are still required before calling that deployment verified.

## Numerical evidence rules

- Only reviewed observations with supported labels are interpreted as creatinine or reported eGFR.
- Exact calendar dates are required. Unknown and invalid dates are excluded from comparison, not replaced with guessed dates.
- Qualified values such as `>1.2`, decimal-comma ambiguity, non-positive values, missing units and unsupported units are excluded.
- Every accepted value must appear as a standalone numerical token in its reviewed excerpt, together with its unit and positive integer source page.
- Creatinine in `mg/dL` is retained. `µmol/L`, `μmol/L` and `umol/L` normalize by division by **88.4**, preserving the original value and unit. [NIDDK conversion reference](https://www.niddk.nih.gov/research-funding/research-programs/kidney-clinical-research-epidemiology/laboratory/glomerular-filtration-rate-equations/adults)
- Multiple measurements for one person/metric on the same date are excluded because sample order is unknown. The prototype does not invent a sample time or select an arbitrary result.
- Each patient owner has a separate series. A doctor receiving two patients' records never gets a combined trend.
- Summary arithmetic describes the first and last accepted measurements. It does not establish assay comparability, clinical significance, chronicity or diagnosis.
- Reported eGFR is retained in a separate source-linked list. Calculation methods are unspecified, so no eGFR is recomputed, disease stage assigned or cross-method interpretation performed.
- Superseded versions remain immutable evidence and may remain readable through a historical grant, but are excluded from new trends and record graph nodes. New correction versions require separate doctor authorization.

The canonical fictional series remains 0.90, 1.10, 1.40 and 1.60 mg/dL on 6 January, 17 March, 19 June and 9 September 2026: +0.70 mg/dL, +77.8%, 246 days. This is non-validated demonstration logic, not an early-disease detector.

## Reading and analysis are separate permissions

The original `grant_records` RPC creates `action='read'`. The new `grant_records_with_analysis` RPC creates `action='read_analyze'` only when the patient explicitly selects the numerical-analysis option in the consent form.

`record_versions` and the source endpoint still require valid read permission. `authorized_analysis_versions()` independently requires ownership or a current exact-version read-plus-analysis grant, active approved doctor membership, matching recipient and unexpired/unrevoked consent. A read-only grant cannot be used to populate numerical insights or the record evidence graph.

Numerical-analysis permission does **not** authorize cloud AI or relatives' medical history.

## Family flow and privacy

### Patient-reported history

A user may record a relationship, biological/adoptive/social/unknown basis, reported condition and age at diagnosis, leaving age unknown when needed. This is private to that account and labeled patient-reported, not independently confirmed. It does not create an account for the relative or assert that the user has that disease.

First-degree biological relationships include parents, children and siblings. Second-degree includes grandparents, grandchildren, half-siblings, aunts/uncles and nieces/nephews. Adoptive, social, other and unknown relationships do not receive a biological degree through inference. Family history is not genetic proof. Relationship labels follow the [NCI first-degree definition](https://www.cancer.gov/publications/dictionaries/genetics-dictionary/def/first-degree-relative) and [second-degree definition](https://www.cancer.gov/publications/dictionaries/genetics-dictionary/def/second-degree-relative); they are descriptive context, not a genetic test.

### Invitations

1. The inviter enters the intended adult relative's exact account UUID and the relationship **relative to the inviter**.
2. Both parties must separately self-attest adulthood. This is not verified age, verified biological identity or guardian authorization.
3. The server generates a 64-character random secret, stores only its SHA-256 hash, and returns plaintext once to the inviter. The invitation expires after 24 hours. An account may create at most 20 invitations per day.
4. The inviter transfers the invitation ID and secret privately. The app sends no email, message or external invitation automatically.
5. Only the named signed-in invitee can accept with the correct unused secret. The transaction locks the invitation; wrong-account, wrong-secret, expired, revoked and replayed acceptance is rejected.
6. Acceptance creates a relationship link only. It shares no condition or source record.
7. Either party may end the relationship, which invalidates subsequent use of shares associated with that link. Reconnecting requires a new invitation and new assertion shares; old shares do not revive.

### Independent condition sharing

- Each person creates their own condition entry, with optional age at diagnosis and a link to one of their own current source versions.
- A linked report records provenance; the system does not verify that the report proves the condition.
- Sharing selects **one owned entry**, one accepted relative, a purpose and expiry (1–720 hours in the UI, max 30 days in PostgreSQL).
- The recipient sees only that condition, age and source-kind label through `visible_family_assertions()`.
- The supporting report UUID is withheld from other accounts. Its original source file is not included in the share. Separate record consent would be required to read it.
- The raw condition-entry table remains owner-only. Recipients cannot modify or onward-share another person's entry.
- Doctor membership and a patient's record/analysis grant do not reveal either patient-reported family history or independently shared relative assertions. There is no implicit onward family consent.
- Each receipt is independent: revoking one does not cancel another separately valid share of the same entry. Revocation, expiry, withdrawal, source supersession or relationship termination removes affected access from fresh projections. Already viewed information, screenshots and downloaded files cannot be retracted.

This release supports adult account-to-account relationships, including an adult child linking to a parent. It does not implement dependent child profiles, verified guardian authority, consent transfer at adulthood or access to a minor's records. Those require a separate authorization design; biological relationship alone is never permission.

## HealthGraph and freshness

The graph is built on the server from the current authorized analysis versions and explicitly visible family projection. It includes patient record groups, report versions, facility labels, accepted direct relatives and visible context nodes. It does not query a relative's underlying chart, expand into their unshared family tree, infer relationships between unrelated accounts or train a diagnostic graph model.

The 3D packages are pinned to `react-force-graph-3d@1.29.2` and `three-spritetext@1.10.0`, with matching Three.js development types. Text labels and a node-kind legend accompany the connections. The viewer loads only on request. Labels supplied to HTML-based 3D tooltips are escaped. The 2D SVG and source/evidence list remain available, including if WebGL fails. Reduced-motion preference switches to the list and disables animated graph modes.

`GET /api/evidence` verifies the session and responds with `Cache-Control: private, no-store`. The client refetches every ten seconds while visible and on focus/visibility changes. Losing visibility clears the displayed private projection until a fresh fetch succeeds. Network/auth failures clear previous results. Responses from aborted/outdated fetches are discarded.

Freshness is request-based, not a promise to retract previously delivered data. A displayed view may lag revocation by the polling interval. Server-side authorization takes effect on subsequent requests; original-source delivery independently rechecks consent.

Prototype limits: up to 500 authorized analysis versions per refresh; 60 nodes in the 2D diagram and 120 in the 3D view. The evidence list contains the full returned graph. Supabase's configured row limits also apply to other lists. Pagination and larger-record performance remain follow-ups; this is not a completeness claim for a lifelong history.

## Optional Gemini configuration and cost boundary

Default: no cloud inference. The application works with `AI_PROVIDER=deterministic` and no model key.

For an optional synthetic-only demonstration, obtain your own Gemini Developer API key for an eligible **free-tier project with billing disabled**, verify its current quotas in AI Studio, and set server environment values:

```dotenv
AI_PROVIDER=gemini
GEMINI_MODEL=gemini-3.5-flash-lite
GEMINI_API_KEY=YOUR_OWN_SERVER_ONLY_KEY
ALLOW_EXTERNAL_AI_FOR_BUNDLED_FIXTURES=true
```

Restart/redeploy after changing configuration. The requesting user must also check the disclosure for that request. Do not put keys in browser code, URLs, source control or screenshots. Do not attach billing simply to complete this MVP.

The provider receives only a fixed, fictional fact list compiled into the adapter. It never receives uploads, patient identifiers, source excerpts, relative conditions or an arbitrary user prompt. It can return only approved fact IDs and an approved wording-template key. The displayed wording always comes from the checked fact list, including the required clinical caveat. Free-form model prose is not rendered.

The adapter makes at most one provider call per request, with no retries, a 4.5-second timeout and a 64 KB response cap. Missing configuration, disallowed model, timeout, quota error, malformed schema, invented ID, duplicate fact or missing required fact falls back to deterministic text. A per-process user cooldown supplements provider limits; it is not a distributed rate limit or billing cap.

As checked on 18 October 2026, Google's pricing page lists free input/output for eligible Gemini 3.5 Flash-Lite free-tier usage. There is no universal guaranteed quota: active RPM/TPM/RPD depend on the project/account and must be checked in AI Studio. Availability and terms can change. Free-tier content may be used to improve Google's products, which is another reason this adapter is limited to fictional facts. A key for a billing-enabled project can incur costs; the app cannot independently certify the billing status of a supplied key.

- [Official pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Official rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)
- [Model documentation](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite)
- [Structured output documentation](https://ai.google.dev/gemini-api/docs/structured-output)

No live Gemini request was made or claimed verified during this implementation. The adapter success and failure paths were exercised with mocked provider responses. The no-key browser flow was exercised against the real application.

## New RPC contracts

| RPC                                | Inputs                                                               | Boundary/result                                                                   |
| ---------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `grant_records_with_analysis`      | named doctor, purpose, exact owned version IDs, expiry               | Explicit read-plus-analysis grant; existing read grants unchanged                 |
| `authorized_analysis_versions`     | authenticated identity only                                          | Up to 500 currently authorized source versions                                    |
| `create_family_invitation`         | named adult account, relationship, basis, adult attestation          | Invitation ID and one-time secret, 24-hour expiry                                 |
| `accept_family_invitation`         | invitation ID, secret, independent adult attestation                 | One active relationship link; no medical access                                   |
| `revoke_family_invitation`         | owned pending invitation ID                                          | Invalidates unused invitation                                                     |
| `end_family_link`                  | relationship ID owned by either endpoint                             | Ends link and subsequent assertion sharing                                        |
| `add_family_assertion`             | own condition, optional diagnosis age, optional current owned source | Immutable condition entry                                                         |
| `withdraw_family_assertion`        | own active entry ID                                                  | Excludes withdrawn entry from fresh projection                                    |
| `share_family_assertion`           | owned entry, accepted relative, purpose, expiry                      | Independent sharing receipt                                                       |
| `revoke_family_share`              | owned sharing receipt                                                | Removes future assertion access                                                   |
| `visible_family_assertions`        | authenticated identity only                                          | Own current entries plus explicitly shared entries; others' source UUIDs withheld |
| `add_reported_family_history`      | relationship, basis, reported condition, optional age                | Owner-only reported family context                                                |
| `withdraw_reported_family_history` | owned context-entry ID                                               | Withdraws the entry from current display                                          |

## Verification commands

```bash
npm run lint
npm test
npm run test:rls
npm run build
npm run typecheck
JG_APP_URL=http://127.0.0.1:3102 npm run test:connected
JG_APP_URL=http://127.0.0.1:3102 npm run test:phase3
npm audit --omit=dev
```

The connected suites refuse non-local Supabase hosts and create fictional local accounts. The Phase 3 suite leaves a synthetic demonstration with four creatinine points, first-degree relative-shared context and first/second-degree patient-reported context. It writes account credentials only to ignored local files. The minimal SQL harness is disposable and separate from real Supabase Auth/Storage tests.

## Verification and remaining limits

Locally exercised: deterministic edge cases; model fallback/schema rejection; PostgreSQL access matrix; real Supabase sessions; separate read/analysis scopes; invitation replay/expiry/revocation; independent family sharing; no implicit file/doctor access; correction and revocation invalidation; browser 3D/2D/list navigation; reduced-motion fallback; source inspection and no-key explanation; reported-family save/withdraw; removal of a revoked condition from an already-open evidence list.

Not claimed: hosted integration, real clinical validity, minor/guardian access, verified genetics, automatic hospital ingestion, OCR, complete access auditing, distributed abuse controls, exhaustive concurrency/load testing or a successful live Gemini call.

`npm audit --omit=dev` reported no runtime dependency advisories during verification. The full development audit reports five high findings along the existing ESLint → fast-glob → micromatch → braces chain. The latest braces release remained affected and the suggested automatic fix downgraded unrelated framework lint tooling, so no forced downgrade was applied. Track the upstream fix and recheck before release; these are development-tool findings, not a claim that the runtime has been comprehensively security-audited.
