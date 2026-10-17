# Phase 1: foundation release

Date: 17 October 2026.

## Implemented

- Next.js/TypeScript application with a pinned npm lockfile and one source repository.
- Responsive clinical shell, mobile navigation and light/dark/system preferences.
- Patient overview, searchable record library and chronological timeline with exact/year-only dates.
- Creatinine/reported-eGFR chart, equivalent data table and source-document inspector.
- Patient-reported family history distinguishing biological, adoptive and unknown relationships.
- Interactive 2D evidence map linking the four kidney panels to their source details.
- Separate doctor, facility-admin and platform-admin previews.
- Explicit fictional-data and preview labels; file selection makes no upload or extraction claim.
- Gemini 3.5 Flash-Lite configuration choice, disabled external inference and no-key operation.
- Product flowchart in editable Mermaid and rendered SVG; four-phase plan.

## Verified

| Check                                  | Result                                                                                    |
| -------------------------------------- | ----------------------------------------------------------------------------------------- |
| Production build, including TypeScript | Passed                                                                                    |
| ESLint                                 | Passed without reported errors or warnings                                                |
| Domain/data tests                      | 7 passed                                                                                  |
| HTTP route checks                      | 11 expected routes returned 200                                                           |
| Invalid role/doctor record route       | 2 expected 404 responses                                                                  |
| Source inspector                       | Chart table opens correct January report and values                                       |
| Search                                 | Beacon query returns the March diagnostic report                                          |
| Historical timeline                    | 1994 remains year-only with explicit unknown exact date                                   |
| Theme                                  | Light and dark inspected in browser                                                       |
| Mobile                                 | 390 px viewport checked; primary pages have no horizontal page overflow                   |
| Clinician preview                      | No patient chart displayed without a grant                                                |
| Fixture projection                     | Relative-owned records excluded; professional previews receive no clinical/family payload |

## Important boundaries

- Role previews are not authenticated sessions. These checks do not prove Supabase RLS or production access control.
- File selection is local-only. Secure uploads, extraction and immutable review transactions are Phase 2.
- There is no persistent consent or invitation service in Phase 1; buttons do not pretend to send requests or grant access.
- The evidence map is 2D. The planned 3D renderer and its authorized projection are Phase 3.
- No cloud inference request is made. Actual free model quota and key access remain unverified.
- No live hospital/ABDM/ABHA integration or clinical validation is claimed.
- Local browser checks are not a public hosting deployment.

## Next milestone

Phase 2 connects Supabase Auth, user-scoped RLS, private Storage, record review, exact-resource consent and simulated facility ingestion. Its release gate requires actual separate-session denial and revocation tests.
