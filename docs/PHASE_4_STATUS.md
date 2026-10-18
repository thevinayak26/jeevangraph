# JeevanGraph release preparation and optional onboarding

## Implemented

- Optional first-login questionnaire at `/secure/welcome`, also reachable from private records, family history and HealthGraph navigation.
- Broad region selection and usual surroundings, reported environmental exposure, known/suspected allergy categories, previously reported conditions and one optional family-history detail.
- No GPS, precise address, relative names, diagnostic score, inferred allergy, current regional prevalence or live outbreak claim.
- Checkbox options automatically keep unknown/none-known exclusive. Server and database validate independently, including direct RPC bypass attempts.
- Explicit opt-in to save. Skip works without completing the questionnaire and clears previously saved answers. Clear deletes the owner's questionnaire row. Saved answers can be revisited and replaced.
- Owner-only questionnaire table. Existing doctor grants, family links and analysis consent do not expose this data. No questionnaire content enters external AI or the evidence engine.
- A questionnaire family answer stays patient-reported onboarding context. Detailed Family history entries and independent relative invitations/shares remain separate, explicit actions. No automatic merge, relative verification or account creation.
- General mosquito-exposure education links to WHO. Broad region is context only, not a validated geographic disease model. A live regional assessment needs a maintained, attributed surveillance source and clinical review, neither included here.

## Database

Apply migrations in filename order, including `202610180004_welcome_assessment.sql`.

`welcome_assessments`: owner UUID primary key, completed/skipped status, validated versioned JSON answers, updated timestamp. Row-level SELECT restricted to owner. Direct client mutations revoked, including hosted default privileges.

RPCs:

- `save_welcome_assessment(p_answers jsonb)`: authenticated owner only. Null means skip and remove previous answers. Non-null answers require the exact allowed fields and enum values, compatible checkbox selections, valid integer age and schema version 1.
- `clear_welcome_assessment()`: deletes only the authenticated owner's row. No relative or doctor permissions are created or changed.

Clearing applies to the application row; database backups follow the hosting provider's retention policy. Clearing cannot retract information a user previously copied. No claim of immediate backup erasure.

The existing `/secure` first-visit redirect is offered when the table is reachable and no questionnaire row exists. Missing migration does not trap users behind onboarding. Users can always skip when setup is healthy.

## Verified locally

- 32 unit/domain tests, including invalid questionnaire inputs and non-diagnostic output boundaries.
- PostgreSQL RLS matrix, including new questionnaire owner separation, skip, clear, anonymous denial and direct-write denial.
- 25 actual Supabase/HTTP connected checks, including first-visit routing, persisted questionnaire summary, no implicit family entries and malformed direct RPC rejection.
- 22 Phase 3 actual-session checks covering family privacy, analysis consent, source correction and revocation.
- Production build, type checking and lint.

Questionnaire visual/mobile browser QA remains pending. The old local browser error tab was rejected by browser URL policy; this is not a successful visual check. Earlier Phase 3 visual evidence does not verify the new questionnaire screen.

## Hosting status

- Vercel Hobby project `jeevangraph` created in the user's existing account for the existing GitHub repository.
- No deployment started in this work: user asked to wait during Supabase setup.
- No Supabase cloud project credentials received/configured. Do not copy local URLs or local service keys into Vercel.
- No live Gemini calls. Deterministic operation remains the default.
- Production runtime audit previously clean; known development-only dependency advisories remain documented in Phase 3 setup and need reassessment before any claim of a clean full audit.

## Remaining release gates

1. User creates/signs into a free Supabase cloud project and securely configures the three required variables in Vercel: public project URL, public publishable key and server-only service-role key. Never expose the service-role key through a NEXT_PUBLIC variable, source file, issue or screenshot.
2. Apply all four migrations to the intended fresh cloud project. Verify bucket privacy and role provisioning. Use synthetic data only.
3. Configure the production Auth site URL and approved redirect URLs. Do not disable email confirmation simply to bypass delivery limits. Verify the account's actual email quotas.
4. Build/deploy from the tested commit and verify the public URL. Confirm no local endpoint has leaked into the hosted build.
5. Run hosted synthetic owner/doctor/relative/stranger access checks and private-source/no-cache checks. Local-only integration scripts intentionally refuse non-local Supabase; do not remove their guard casually. Use a reviewed hosted smoke procedure.
6. Visually verify the new questionnaire on desktop/mobile and keyboard, including unknown exclusivity, save, skip, edit and clear. Recheck reduced-motion graph fallback and file failures.
7. Rehearse the demo below. The website remains a synthetic prototype, not a production medical service.

## Mentor demo, approximately six minutes

1. 0:00-0:40: problem, fragmented synthetic reports across three facilities. Open preview if no cloud connection is available.
2. 0:40-1:20: sign into a synthetic patient. Show optional questionnaire and its privacy/non-diagnostic labels. Skip or save fictional answers.
3. 1:20-2:20: inspect four report dates and creatinine source provenance. Explain the descriptive change, without diagnosing kidney disease.
4. 2:20-3:10: grant selected versions to a named synthetic doctor, demonstrate the separate analysis permission and then revoke.
5. 3:10-4:10: accept a synthetic adult-relative invitation. Explain acceptance alone shares nothing, then explicitly share one condition for a limited duration.
6. 4:10-5:00: show HealthGraph, biological versus adoptive context, first/second-degree labels and the 2D/list fallback.
7. 5:00-6:00: show revocation and describe boundaries: patient-reported history is not genetic proof, no live ABDM/hospital connection, no validated clinical risk prediction. Explain next deployment milestones honestly.

## Local fallback

Use the existing ignored local environment, local Supabase stack and production app on port 3102. No cloud model key is needed. Do not put local synthetic account passwords in the public repository or presentation. If network/hosting fails, use the labelled synthetic preview and existing screenshots. A screenshot is evidence of a prior run, not live deployment proof.

## Education reference

WHO, [Dengue and severe dengue](https://www.who.int/news-room/fact-sheets/detail/dengue-and-severe-dengue), reviewed 18 October 2026. The app links general mosquito-bite prevention in response to reported exposure, not a regional outbreak or individual illness determination.
