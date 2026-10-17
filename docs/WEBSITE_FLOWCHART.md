# JeevanGraph website flow

## Role entry and the complete journey

```mermaid
flowchart TD
  START[Open JeevanGraph] --> MODE{Environment}
  MODE -->|Synthetic prototype| PREVIEW[Choose an explicitly labeled role preview]
  MODE -->|Connected application| LOGIN[Sign in and verify session]
  LOGIN --> AUTH[Load trusted roles and active organization]
  PREVIEW --> ROLE{Workspace}
  AUTH --> ROLE

  ROLE -->|Patient| P[Patient overview]
  P --> RECORDS[Timeline and document library]
  P --> UPLOAD[Upload PDF or image]
  UPLOAD --> DRAFT[Validate and extract draft]
  DRAFT --> REVIEW[Check source values dates and units]
  REVIEW --> COMMIT[Save immutable reviewed record]
  COMMIT --> RECORDS
  RECORDS --> CHART[Longitudinal measurements and original sources]
  P --> CONSENT[Sharing requests and active grants]
  CONSENT --> SELECT[Choose recipient purpose actions exact records and expiry]
  SELECT --> GRANT[Create revocable grant]
  P --> FAMILY[Private biological and social family map]
  FAMILY --> INVITE[Invite an adult relative]
  INVITE --> ACCEPT[Relative accepts relationship only]
  ACCEPT --> SHARE[Relative separately shares selected assertions]
  CHART --> GRAPH[HealthGraph with authorized sources]
  FAMILY --> GRAPH

  ROLE -->|Doctor| D[Doctor overview]
  D --> REQUEST[Request access using patient-issued context]
  REQUEST --> CONSENT
  GRANT --> CHECK[Check live scope expiry membership and revocation]
  CHECK -->|Allowed| CLINICAL[Authorized timeline and lab chart]
  CHECK -->|Denied| DENIED[Access unavailable]
  CLINICAL --> RULES[Deterministic observation and evidence]
  RULES --> AI{Optional synthetic-only explanation}
  AI -->|Configured and valid| GEMINI[Gemini 3.5 Flash-Lite]
  AI -->|Unavailable or invalid| TEMPLATE[Fixed explanation template]
  GEMINI --> RECHECK[Recheck all evidence permissions]
  TEMPLATE --> RECHECK
  RECHECK -->|Still allowed| DISPLAY[Show explanation with source evidence]
  RECHECK -->|Access ended| DENIED
  CONSENT --> REVOKE[Patient revokes or grant expires]
  REVOKE --> CLEAR[New requests denied and active view cleared]

  ROLE -->|Facility admin| F[Facility operations]
  F --> STAFF[Manage own organization staff]
  F --> TOKEN[Patient authorizes one scoped delivery]
  TOKEN --> INGEST[Simulated idempotent hospital ingestion]
  INGEST --> DRAFT

  ROLE -->|Platform admin| A[Platform operations]
  A --> ORGS[Approve or suspend demo organizations]
  A --> OPS[Sanitized service and membership status]
```

## Family access boundary

```mermaid
sequenceDiagram
  actor P as Patient
  participant M as JeevanGraph
  actor R as Relative
  actor D as Doctor
  P->>M: Create reported family node
  P->>M: Generate one-time invitation
  R->>M: Accept relationship invitation
  M-->>P: Relationship linked, no chart access
  R->>M: Share selected assertion with patient
  M-->>P: Show assertion within its permitted scope
  D->>M: Request family context
  M-->>D: Patient-only relative share does not authorize doctor
  P->>M: Approve index-patient family context
  R->>M: Separately approve selected assertion for doctor
  M-->>D: Show only the intersecting authorized assertion
```

## Guardrails

- Prototype role selection is a navigation aid, not authentication.
- A facility connection permits scoped ingestion, not unrestricted chart access.
- A platform administrator manages operations, not every patient's medical data.
- Accepting a family invitation grants no clinical access.
- Upload review confirms transcription, not a diagnosis or clinical validity.
- Explanations require the same evidence permissions as the underlying records.
- All prototype records are fictional. Real hospital, ABDM and ABHA integration are outside this release.
