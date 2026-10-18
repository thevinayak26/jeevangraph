# JeevanGraph: upload-to-history demo

## Mentor flow

1. Use a fresh empty synthetic account from the private Desktop guide. Sign in with **Skip questionnaire during demos** enabled. This preference skips only the welcome step, preserves saved answers, and grants no data access.
2. The personal dashboard begins with zero reviewed reports. Drop `JeevanGraph_Demo_History.zip` into the history import area, or choose that ZIP with the file picker.
3. The browser unpacks and scans eight fictional documents. PDF.js extracts selectable text. Tesseract performs printed-English OCR for images and image-only PDF pages. All workers and English language assets are served from the application origin, with no third-party OCR upload.
4. Review the proposed identity/date/measurement fields. Confirm the reviewed pack once. Files publish individually, with source provenance, through the atomic owner-only scanned-document RPC. Each confirmed file refreshes the evidence view. This is extraction and human review, not clinical verification or a test of document authenticity.
5. The account shows eight reports from three fictional facilities, two prescriptions, four lab reports, childhood immunization and an imaging report. The creatinine chart is 0.90, 1.10, 1.40, 1.60 mg/dL across the four exact dates. The descriptive change is +0.70 mg/dL, +77.8%, 246 days. No kidney disease diagnosis or stage is assigned.
6. Open HealthGraph and select **3D**. The 2D/list views remain available; reduced-motion preference uses the accessible list.
7. Open **Ask my history**. Use the suggested questions for a summary, creatinine, recorded medicines, allergies or family mentions. Every factual answer is composed from reviewed source entries with original-source links.
8. Optional Gemini question routing is explicitly labelled. It receives the fictional question only, never reports or relatives' records. Gemini chooses a supported topic; the local evidence engine supplies the factual answer. If the key, provider or quota is unavailable, the labelled local evidence fallback answers supported questions. This is not an unrestricted generative medical assistant.

## Clean archive

The main demo ZIP contains exactly eight PDFs, with no duplicate scanned-image variant. The larger test-fixture folder also contains a PNG alternative for OCR testing. Do not import that image together with its March PDF in the same account, because duplicate-date samples are intentionally excluded from numerical trends.

All fixture patients, clinicians, facilities and prescription entries are fictional. None is a valid prescription or medical record. The archive is intended for a fresh synthetic account.

## Input boundaries

- ZIP: up to 10 MB compressed, at most 64 archive entries, at most eight supported reports, at most 20 MB unpacked total.
- Individual source: non-empty, at most 4,000,000 bytes, PDF/PNG/JPEG. Up to six PDF pages and 16 megapixels per input image.
- ZIP paths with traversal, absolute paths or backslashes are rejected. Archives are expanded in browser memory, not extracted into a server filesystem. Unsupported entries are ignored; encrypted/corrupt archives are rejected.
- Source signatures and MIME type are checked again at upload. A file signature check is not malware scanning or document authenticity validation.
- PDF text is preferred; image-only pages use OCR. Handwriting, unclear scans and unsupported layouts may need manual correction. OCR confidence is not clinical accuracy.
- Mixed patient IDs or birth dates block batch confirmation and direct the user to individual review. Matching printed identifiers are not proof that the source belongs to the account holder.
- Clinical notes retain page and extraction-method markers, with bounded length. Unsupported or qualified laboratory values remain unaltered for conservative downstream exclusion.
- Batch import includes changes made in the individual review fields. Saving is explicit. A retry adds only items still unsaved in the current tray. Re-importing the same pack in a later session is not deduplicated; use a fresh account for each demo.
- Source correction still uses the existing explicit correction flow. New uploads do not silently replace another report.

## Privacy and permissions

- Newly created accounts contain no bundled medical history. The separate synthetic preview and bundled explanation stay clearly separate from account history.
- Scanned results remain untrusted until patient review. `publish_scanned_document` validates owned source paths, content shape and explicit confirmation; creation and review are one database transaction.
- The server stores confirmed source files in private Supabase Storage. Failed database publication attempts clean up the unreferenced owned object.
- The history-chat endpoint re-authenticates every request and reads only the signed-in patient's current owned versions, up to 100. A doctor record grant is not silently expanded into this patient chat feature.
- Quoted family history from uploaded notes is patient-reported. It does not create relative accounts, biological proof or record access. Independently consented family sharing remains in its separate workspace.
- Chat has no persistent transcript table. Tab-local messages clear when hidden, on request failure or through Clear conversation. Past answers are snapshots; new questions recheck current records. No promise is made to retract information already read or copied.
- Gemini has strict enum-only output and a bounded timeout; it cannot insert prose, diagnoses, medicine instructions or unsupported values into the answer. A per-process cooldown supplements provider limits but is not a distributed billing or abuse guarantee.
- Cloud keys are server-only and excluded from Git. No service-role or Gemini key belongs in a NEXT_PUBLIC variable.

## Email signup

The provider's default SMTP service may send confirmation email only to organization members and has strict limits. The prepared mentor logins are separate fresh synthetic users confirmed by the project operator. Email verification was not disabled. An arbitrary public email signup is not claimed to work without configuring an appropriate SMTP provider.

Sources: [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [PDF.js](https://mozilla.github.io/pdf.js/getting_started/), [Tesseract.js](https://github.com/naptha/tesseract.js), [Vercel function limits](https://vercel.com/docs/functions/limitations).

## Verification record

- Unit/domain tests: 47 passing, including archive bounds, mixed identity, extraction provenance and chat evidence boundaries.
- Isolated PostgreSQL RLS suite: passing, including atomic scanned import, explicit review, wrong-account and anonymous denial.
- Local actual-session scan/chat checks: 14 passing, including a new empty account, exact chart arithmetic, source citations and clinician-scope separation.
- Browser checks: PNG OCR, image-only PDF OCR, all eight PDF suggestions, individual confirmation, ZIP expansion/scan and one-confirmation import, actual 3D render and medicine/creatinine chat. Mobile scan and chat tested without document overflow.
- A live Gemini topic request succeeded with the provided key; a local authenticated history request used Gemini routing and returned uploaded prescription evidence.
- Hosted final release verification is recorded separately in RELEASE_VERIFICATION.md when complete. Local checks are not treated as hosted proof.
