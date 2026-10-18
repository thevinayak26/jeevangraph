# Release verification

Date: 18 October 2026. Synthetic prototype only.

## Candidate

This release adds ZIP-to-history scanning and review, personal timeline/metrics, source-linked history chat, an optional question-only Gemini topic router, demo-skip preference and hosted upload compatibility. All six schema migrations are applied to the cloud project through the SQL editor. The private bucket is capped at 4,000,000 bytes. This manual setup does not populate CLI migration history; reconcile it before future CLI migration pushes.

## Completed local evidence

- 47 unit/domain tests passed.
- PostgreSQL RLS matrix passed, including owner-only atomic scanned publication, explicit review, cross-account and anonymous denial.
- 14 real-session import/chat checks passed. Existing Phase 2/3 checks are retained separately.
- Browser-tested new-account demo skip, selectable-text PDFs, printed PNG OCR, image-only PDF OCR, eight-report import, ZIP expansion/scanning and batch confirmation, source citations, medicine retrieval and 3D rendering.
- Mobile scan and chat layouts checked without document horizontal overflow.
- A live Gemini request accepted the supplied key. Authenticated local question routing returned a supported topic and the answer used the patient's reviewed sources.
- Production build, types and lint passed. Runtime dependency audit reported zero advisories; known development-only findings remain documented in Phase 3 setup.
- Candidate source was checked for configured service-role/Gemini key strings. Secrets are in ignored local files and production secret environment settings, not Git.

## Hosted verification

Pending until the deployment finishes. Do not treat local checks as hosted proof. The final result is appended after live checks.

## Account and AI boundaries

Fresh mentor accounts are separately created, empty synthetic accounts confirmed by the project operator. The provider's email-confirmation policy was not disabled. Arbitrary public email signup requires an appropriate SMTP configuration and is not claimed to work with the default restricted email service.

Gemini receives only a user-authorized fictional question for topic routing. Medical source files/text do not enter that adapter. A bounded local evidence fallback remains available. No diagnosis, clinical verification, autonomous treatment or unrestricted generative medical reasoning is claimed.
