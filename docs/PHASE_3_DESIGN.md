# Phase 3 design decisions

- Keep the existing clinical palette: page #f5f7f9, surface #ffffff, ink #213338, teal #087e76, mint #e2f3ed and muted #687c80. Keep the existing Segoe UI / system stack for consistency.
- The evidence page reads like a consultation workspace: source-linked trend first, exclusions beside its explanation, evidence graph below. Family history has a distinct page because accepting a relationship is separate from sharing a condition.
- Light canvas is the default. 3D is explicitly activated, never required to use the product. The labeled SVG and keyboard-operable list remain available; reduced-motion users start with the list.
- Only current, authorized versions enter derived results. Superseded versions remain original evidence but do not contribute to a fresh trend/graph. Each subject has a separate series.
- AI may select only prewritten evidence facts and a wording template from bundled fictional fixtures. No model-authored clinical prose, diagnosis, private record text, relative condition or arbitrary prompt is accepted.
- Family links are self-attested adult relationships, not guardian authorization or genetic verification. An invitation has a named recipient and one-use secret, and grants no chart access. Each assertion share is separately time-limited and revocable. Clinician record grants never imply onward family access.
- Directly reported family history is clearly distinguished from a condition independently shared by a relative. Supporting source files remain private unless separately authorized through the existing exact-version flow.

The design review retained the existing typography and palette rather than introducing a new template. The graph is the focal interactive element; ordinary review and permission forms keep their established controls. Distinct source, relative and family-context labels carry information rather than ornamental status badges.
