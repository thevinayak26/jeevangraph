# JeevanGraph

A patient-controlled synthetic health-history prototype with local document scanning, source-linked answers, consent and family context.

## Mentor flow

**Fresh empty account → skip optional questionnaire → drop a history ZIP → review and confirm → populated timeline, charts, chat and 3D HealthGraph.**

See [the demo guide](docs/SCAN_CHAT_DEMO.md) and [release verification](docs/RELEASE_VERIFICATION.md). The fictional history ZIP is available in the import area. No actual patient data is supplied with the repository.

## Included

- Supabase email/password authentication, private Storage and owner/recipient PostgreSQL access rules.
- Optional questionnaire with an explicit browser-session demo-skip switch.
- ZIP upload/drop, PDF text extraction and printed-English OCR for image sources, followed by patient review. No clinical verification or authenticity claim.
- Immutable reviewed sources, exact-version doctor grants, separate numerical-analysis consent, expiry and revocation.
- Reviewed source timeline, descriptive creatinine trend and 3D/2D/list HealthGraph.
- Patient-owned history chat with source citations. Gemini can select the question topic; the local evidence engine supplies the answer. Reports are not sent to that model. No-key/provider-failure fallback remains available.
- Patient-reported family history and independent adult-relative invitations/shares. A relationship alone never opens another person's records.
- Simulated facility ingestion. Live hospital connections and ABDM integration are not claimed.

## Stack

Next.js 16.4.2, React 19.3.1, TypeScript 6.0.3, Tailwind 4.3.3, Supabase, Recharts 3.10.1, react-force-graph-3d 1.29.2, PDF.js 6.4.299, Tesseract.js 7.0.0 with English data, fflate 0.8.3. All direct versions are pinned in package.json.

## Local setup

Node 24.x and npm are required.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Configure the environment locally and apply all six migration files in filename order. Before each build/dev run the asset preparation script copies pinned OCR/PDF workers and language data to the same-origin public asset directory. Never commit actual service-role or Gemini keys.

The root opens sign-in when Supabase is configured, otherwise the explicitly synthetic preview. A new signed-in account has no bundled medical history. Mentor logins are provided privately outside the repository. Default Supabase email delivery may be restricted; see the demo guide rather than assuming arbitrary public signup works.

## Checks

```bash
npm test
npm run lint
npm run typecheck
npm run test:rls
npm run build
```

Local connected checks are documented in [Phase 2 setup](docs/PHASE_2_SETUP.md), [Phase 3 setup](docs/PHASE_3_SETUP.md) and the demo guide. The hosted release smoke script has an exact project guard and explicit synthetic-data opt-in; never point it at a project containing actual patient records.

## Boundaries

Synthetic data only. Extraction and arithmetic are not validated clinical reasoning. Recorded medicine entries may be historical and never constitute instructions to start, stop or change treatment. Family history is not genetic proof. Guardian/minor authority, handwriting recognition, live regional surveillance, production medical governance and complete auditing/retention/abuse controls are outside this prototype.

The chosen services have no-cost options, quotas and eligibility constraints. No perpetual free capacity or model availability is guaranteed. Billing status cannot be certified by the app; provider failure falls back to local evidence.

## Further context

- [Four-phase implementation plan](docs/FOUR_PHASE_PLAN.md)
- [Phase 2 security and API contracts](docs/PHASE_2_SETUP.md)
- [Phase 3 evidence and family design](docs/PHASE_3_DESIGN.md)
- [Phase 3 setup and API contracts](docs/PHASE_3_SETUP.md)
- [Website flowchart](docs/WEBSITE_FLOWCHART.md)
