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

- Production is connected at https://jeevangraph.vercel.app, with the cloud database and private storage. Vercel reported the release Ready. Production Auth site/callback URLs are configured.
- All 15 hosted synthetic access checks passed, including exact-version doctor consent, independent family consent and revocation, anonymous/wrong-account denial, source delivery with private no-store caching, and denial of doctor-created Storage URLs for an actual existing object.
- Two separate hosted browser rehearsals began with zero reviewed reports and a skipped questionnaire, scanned the clean Desktop ZIP, and confirmed all eight PDFs. The resulting account displayed eight reports, three facilities, two prescriptions and four lab reports. The descriptive creatinine change matched +0.70 mg/dL, +77.8%, 246 days.
- Editing a proposed report title survived batch publication and appeared in the source citation. The completed import tray automatically collapsed, leaving the populated dashboard visible.
- Hosted printed-image OCR extracted the March source date, facility, creatinine 1.10 mg/dL and eGFR 88 from the separate PNG test. That duplicate alternative was inspected without publishing it into the eight-PDF account.
- Hosted chat used the optional Gemini question-only topic router and returned the four uploaded laboratory sources with the correct descriptive change. The interface accurately labels Gemini routing separately from local evidence answers.
- The hosted 3D graph rendered the twelve authorized patient/report/facility nodes. Its reset control and accessible evidence list were checked. Camera framing was adjusted after visual inspection.
- Five separate presentation accounts were verified empty through the cloud database after the rehearsals. Their credentials are only in the private Desktop guide and ignored local files. The clean Desktop/public demo ZIP contains exactly eight PDFs.

These checks use fictional documents and scoped synthetic test accounts. They are not a penetration test, clinical validation, handwriting benchmark, or guarantee of provider uptime/free quota. The ZIP file-picker path was exercised end to end; the browser automation interface did not support a native operating-system file-drag gesture.

## Account and AI boundaries

Fresh mentor accounts are separately created, empty synthetic accounts confirmed by the project operator. The provider's email-confirmation policy was not disabled. Arbitrary public email signup requires an appropriate SMTP configuration and is not claimed to work with the default restricted email service.

Gemini receives only a user-authorized fictional question for topic routing. Medical source files/text do not enter that adapter. A bounded local evidence fallback remains available. No diagnosis, clinical verification, autonomous treatment or unrestricted generative medical reasoning is claimed.
