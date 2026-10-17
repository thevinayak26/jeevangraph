# Phase 2: connected synthetic workspace

## Status and boundaries

Phase 2 has a separate authenticated workspace at `/account` and `/secure`. The original `/patient/*`, `/doctor/*`, `/facility/*`, and `/platform/*` routes remain labeled fictional previews. Their role switcher is never used for authorization. The connected workspace reads only persisted, authorized records; it does not silently merge the bundled patient's chart into a new account.

Implemented: email/password account creation and sign-in, SSR session refresh, private uploads, manual field review, immutable report versions, exact-version read consent, expiry/revocation, source delivery, patient audit events, and one-use simulated facility delivery with idempotent retries.

The local stack uses real Supabase Auth, PostgREST, Storage and PostgreSQL. This is a synthetic development release, not a clinically validated or production security-certified service. No hospital, ABHA/ABDM or AI service is connected. Family invitations, dependent/guardian authorization, browser OCR, clinical calculations on uploaded records and 3D exploration remain later work.

## Run the existing local setup

From `/home/vinayak/dev/jeevangraph`:

```bash
npm run dev -- --port 3102
```

Open `http://127.0.0.1:3102/account`. If a production preview is already running on port 3102, use that instance or stop it before starting another. The synthetic preview remains at `/patient/overview`.

The current ignored `.env.local` points only to the local Supabase stack. Synthetic test account credentials are stored in ignored `.env.synthetic-users.local.json`; never commit or copy these files into a submission. Test accounts are not real patients. No cloud API key is needed.

To restart the local backend with Docker running:

```bash
npx --yes supabase@2.121.0 start --exclude studio,imgproxy,realtime,edge-runtime,logflare,vector,supavisor,inbucket
```

The first launch downloads the containers. Local development consumes disk/RAM and electricity but requires no paid API or cloud subscription. CLI configuration is tracked at `supabase/config.toml`; runtime state is ignored by Supabase's generated ignore file.

## New local installation

1. Install the repository's Node version (24), run `npm ci`, and ensure Docker is running.
2. Run the local backend command above. The migration applies to the new database automatically.
3. Copy `.env.example` to `.env.local`.
4. Obtain local values with `npx --yes supabase@2.121.0 status`. Copy the API URL, publishable key and service-role key into the corresponding environment variables. Keep the output private; it contains credentials.
5. Run `npm run dev -- --port 3102`.
6. Create a patient account. If confirmation is enabled, confirm through the local mail viewer or your configured mail service before signing in.

`SUPABASE_SERVICE_ROLE_KEY` is server-only. The only application operation using it is downloading a private source after an authenticated RPC authorizes the exact record/draft. The route checks authorization again before returning bytes. Never add a `NEXT_PUBLIC_` prefix to this secret.

## Hosted Supabase setup

1. Create an eligible Supabase project in your own account. Review current free limits and project availability before relying on it.
2. Apply `supabase/migrations/202610180001_secure_records.sql` once using the SQL editor or the Supabase migration CLI. Do not run the minimal test bootstrap against Supabase.
3. Configure Auth site URL and allowed redirects for the deployed website; retain email confirmation and appropriate rate limiting. Set an appropriate password policy and mail delivery configuration.
4. Configure the three environment variables in the website host. Rebuild after changing public configuration.
5. Provision doctor/facility memberships through a trusted operator, after independently checking the person's identity and organization. A user-supplied profile or URL role never grants membership.
6. Run the access matrix with synthetic data on the hosted deployment. Local verification is not hosted verification.
7. Do not upload real patient data until operational security, consent wording, retention/deletion, backups, incident handling and applicable obligations have been reviewed.

Membership provisioning example, executed by the trusted project operator, not the app client:

```sql
insert into public.memberships(user_id, role, organization)
values ('REPLACE_WITH_REAL_AUTH_USER_UUID', 'doctor', 'Approved Clinic');

insert into public.memberships(user_id, role, organization)
values ('REPLACE_WITH_FACILITY_AUTH_USER_UUID', 'facility', 'Approved Hospital');
```

Organizations are matched exactly for facility delivery. Memberships can be deactivated by the operator. The application does not claim that a provisioned account was checked against an external medical registry. Platform/facility membership does not imply chart access. Every account can manage its own records; a doctor sees other people's versions only through a valid grant and an active doctor membership.

## Patient workflow

1. Sign in. Your empty account has no access to Aarav's bundled fictional chart.
2. Upload a PDF, PNG or JPEG, up to 5 MB. File signature and declared MIME type must agree. Storage also enforces type and size limits. Signature checking is not a malware scanner or complete document parser.
3. Enter title, facility, type and date. Leave date empty if unknown. Failed draft creation attempts remove the orphan upload when possible; an interrupted process can still leave an orphan for operator cleanup.
4. Download the source from the pending review card. Enter notes and optional measurements using the labeled fields. Preserve raw value/unit, exact excerpt and source page. No OCR is performed.
5. Confirm review. The database publishes an immutable version and a transactionally recorded audit event. The same draft cannot be published twice.
6. For a correction, upload another source and select the existing record. This creates another version under that record. Previous versions remain immutable; existing grants do not automatically expand to include corrections. The interface lists history rather than claiming old versions have been replaced everywhere.
7. Enter the exact approved doctor's account ID, purpose, selected versions and expiry (1–720 hours). Read access is the only enabled action; analysis permission is not implied.
8. The doctor signs in with their own account to read only currently granted versions. Revocation/expiry is checked by RLS on every new query and by the source endpoint on every new request. Already delivered bytes or downloaded copies cannot be retracted.
9. Inspect receipts and revoke future access. Status shown in an already open browser tab is a snapshot; refresh to update labels. Database authorization uses database time regardless of the displayed label.

The account-ID recipient field is intentionally explicit for the prototype. A verified, human-readable directory/recipient confirmation experience is a follow-up usability task before a real patient pilot. Do not interpret knowing a UUID as authorization: grants and membership checks are enforced separately.

## Facility simulator

1. A patient authorizes one named facility account and exact organization for one hour.
2. The patient transfers the ticket ID privately to that operator. This is an in-app simulation, not an external hospital integration.
3. The facility signs in and submits a title, date and synthetic structured fields, using a UUID request key.
4. The transaction locks the ticket, checks actor/membership/organization/expiry/revocation, and stores a SHA-256 payload fingerprint and receipt.
5. Repeating the same request key with identical fields returns the original draft. A different key or changed payload on the used ticket is rejected. Expired/revoked authorizations are rejected even on retry.
6. The patient sees a pending draft and independently reviews it. The facility receives the draft ID but cannot read the patient's chart or submitted draft through the general tables.

Simulated ingestion carries structured source assertions, not an original scanned file. The UI labels this difference. Authorizing delivery never authorizes reading the patient's other records.

## API and database contracts

All RPCs require a valid user's Supabase session and are called with the publishable client, not a service-role client.

| RPC                   | Main inputs                                                | Result / boundary                                               |
| --------------------- | ---------------------------------------------------------- | --------------------------------------------------------------- |
| `create_draft`        | owned upload ID/path, optional owned record ID, metadata   | Pending draft ID; validates path and stored object              |
| `review_draft`        | owned pending draft ID, reviewed notes/observations        | Immutable version ID, transactionally marks draft reviewed      |
| `grant_records`       | approved doctor UUID, purpose, owned version UUIDs, expiry | Read-only consent receipt UUID, max 30 days                     |
| `revoke_grant`        | owned grant UUID                                           | Revocation timestamp and audit event                            |
| `authorize_ingestion` | approved facility UUID, exact organization, expiry         | One-use ticket UUID, max 24 hours through RPC; UI uses one hour |
| `revoke_ingestion`    | owned unused ticket UUID                                   | Revokes unused delivery permission                              |
| `ingest_simulated`    | ticket, request-key UUID, title/date/content               | Pending patient draft; identical retry is idempotent            |
| `read_source`         | version UUID                                               | Authorized storage path + source-request audit event            |
| `read_draft_source`   | owned draft UUID                                           | Owner-only pending/original path + audit event                  |

Reviewed content contract:

```json
{
  "notes": "Fictional test report. Date unknown if not recorded.",
  "observations": [
    {
      "label": "Creatinine",
      "value": "0.90",
      "unit": "mg/dL",
      "sourceExcerpt": "Creatinine 0.90 mg/dL",
      "sourcePage": 1
    }
  ]
}
```

Zod validates submitted fields; PostgreSQL independently validates reviewed content and access. Observations are preserved as reviewed JSON inside each immutable version, rather than a separate mutable observation table. They are not normalized for clinical comparison in this phase.

`GET /api/private-source/:versionId` requires an authenticated session cookie. A successful response is an attachment with `Cache-Control: private, no-store`; unauthorized or missing sources return a generic 404. `?draft=1` selects the owner-only draft source operation. No endpoint accepts an arbitrary storage path. Doctor storage SELECT is denied so doctors cannot mint durable signed links. The source service never returns its server key.

## Verification

```bash
npm run lint
npm test
npm run test:rls
npm run build
npm run typecheck
JG_APP_URL=http://127.0.0.1:3102 npm run test:connected
```

`test:connected` refuses non-local Supabase URLs. It creates synthetic local accounts, approved memberships, four files/versions and test grants, and writes their credentials only into an ignored local file. Repeating it adds another isolated test cohort. Never point it at real data. Without `JG_APP_URL`, it tests Supabase APIs; with it, it also tests authenticated Next.js rendering and source delivery.

`supabase/tests/bootstrap.sql` plus `access.sql` provides a minimal, disposable PostgreSQL RLS harness. The bootstrap mocks auth/storage schemas and is **not** an actual Supabase installation. It must never be applied to an existing project. The connected tests above use real Supabase Auth sessions and Storage API separately.

Verified locally: owner/draft isolation; named-recipient version access; anonymous/other-user/facility/platform denial; immutable versions; role escalation rejection; cross-owner upload denial; doctor signed-link denial; source endpoint success/denial; expiry/revocation; one-use ingestion and changed replay rejection; audit persistence. Browser sign-in, upload and manual publication were also exercised. Hosted configuration and end-to-end hosted behavior are unverified.

## Explicit follow-ups

- Human-readable recipient identity/organization confirmation and account recovery UI.
- A full authenticated end-to-end browser suite beyond the manual exercised flow; concurrency/load tests and operational failure drills.
- Pagination beyond the prototype's current result limits (Supabase API max 1,000 rows; audit view shows 30 recent events).
- Hardened retention/deletion, orphan cleanup scheduling, upload malware handling and production abuse controls.
- Complete download-delivery logging and comprehensive data-access auditing. Current logs record mutations/source requests; direct authorized table reads are not individually audited, and source checks may produce two request events.
- Independent guardian/relative authorization, family invitations, source corrections in derived clinical insights, OCR, AI and graph intelligence.

## Reference documentation

- [Supabase SSR auth](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Storage access control](https://supabase.com/docs/guides/storage/security/access-control)
