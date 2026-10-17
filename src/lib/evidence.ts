export type ReviewedObservation = {
  label: string;
  value: string;
  unit: string;
  sourceExcerpt: string;
  sourcePage: number;
};
export type EvidenceVersion = {
  id: string;
  record_id: string;
  owner_id: string;
  title: string;
  kind: string;
  clinical_date: string | null;
  facility: string;
  reviewed_at: string;
  superseded_at: string | null;
  object_path?: string | null;
  content: { notes: string; observations: ReviewedObservation[] };
};
export type Point = {
  id: string;
  versionId: string;
  subjectId: string;
  date: string;
  timestamp: number;
  value: number;
  rawValue: string;
  rawUnit: string;
  sourceExcerpt: string;
  sourcePage: number;
  title: string;
  facility: string;
  converted: boolean;
};
export type Exclusion = { versionId: string; title: string; reason: string };
export type Trend = {
  subjectId: string;
  points: Point[];
  reportedEgfr: Point[];
  summary: string;
  change: number | null;
  percent: number | null;
  days: number | null;
};
export type FamilyLink = {
  id: string;
  inviter_id: string;
  invitee_id: string;
  relationship: string;
  basis: string;
  ended_at: string | null;
};
export type FamilyAssertion = {
  id: string;
  owner_id: string;
  condition: string;
  age_at_diagnosis: number | null;
  source_kind: string;
  source_version_id: string | null;
  created_at: string;
};
export type ReportedHistory = {
  id: string;
  owner_id: string;
  relationship: string;
  basis: string;
  condition: string;
  age_at_diagnosis: number | null;
  withdrawn_at: string | null;
};
export type GraphNode = {
  id: string;
  label: string;
  kind: 'person' | 'record' | 'facility' | 'relative' | 'family';
  detail: string;
  versionId?: string;
  sourceAvailable?: boolean;
  basis?: string;
};
export type GraphLink = { source: string; target: string; label: string; basis?: string };
export type EvidenceProjection = {
  trends: Trend[];
  exclusions: Exclusion[];
  graph: { nodes: GraphNode[]; links: GraphLink[] };
  family: {
    id: string;
    label: string;
    basis: string;
    degree: number | null;
    condition: string;
    age: number | null;
    source: string;
  }[];
  revision: string;
};
export const relationshipOptions = [
  'mother',
  'father',
  'parent',
  'child',
  'sibling',
  'half_sibling',
  'grandparent',
  'grandchild',
  'aunt_uncle',
  'niece_nephew',
  'other',
] as const;
export const basisOptions = ['biological', 'adoptive', 'social', 'unknown'] as const;
export function relationshipLabel(s: string) {
  return s.replaceAll('_', ' / ');
}
export function relationshipDegree(relation: string, basis: string): number | null {
  if (basis !== 'biological') return null;
  if (['mother', 'father', 'parent', 'child', 'sibling'].includes(relation)) return 1;
  if (
    ['half_sibling', 'grandparent', 'grandchild', 'aunt_uncle', 'niece_nephew'].includes(relation)
  )
    return 2;
  return null;
}
export function relativeToViewer(link: FamilyLink, viewer: string) {
  if (link.inviter_id === viewer) return link.relationship;
  const inverse: Record<string, string> = {
    mother: 'child',
    father: 'child',
    parent: 'child',
    child: 'parent',
    grandparent: 'grandchild',
    grandchild: 'grandparent',
    aunt_uncle: 'niece_nephew',
    niece_nephew: 'aunt_uncle',
  };
  return inverse[link.relationship] ?? link.relationship;
}
function exactDate(raw: string | null): number | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const n = Date.parse(raw + 'T00:00:00Z');
  return Number.isFinite(n) && new Date(n).toISOString().slice(0, 10) === raw ? n : null;
}
function tidy(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .replaceAll('µ', 'u')
    .replaceAll('μ', 'u')
    .replaceAll('²', '2')
    .replace(/\s/g, '');
}
function metric(label: string): 'creatinine' | 'egfr' | null {
  const l = label
    .trim()
    .toLowerCase()
    .replace(/[_\s.]/g, '');
  if (['creatinine', 'serumcreatinine', 'creatinineserum', 'screatinine'].includes(l))
    return 'creatinine';
  if (['egfr', 'egfrreported', 'reportedegfr', 'estimatedglomerularfiltrationrate'].includes(l))
    return 'egfr';
  return null;
}
function round(n: number, d = 2) {
  return Math.round((n + Number.EPSILON) * 10 ** d) / 10 ** d;
}
export function buildEvidence(
  versions: EvidenceVersion[],
  viewer: string,
  links: FamilyLink[] = [],
  assertions: FamilyAssertion[] = [],
  reported: ReportedHistory[] = [],
): EvidenceProjection {
  const exclusions: Exclusion[] = [];
  const candidates: { point: Point; metric: 'creatinine' | 'egfr' }[] = [];
  for (const v of versions) {
    if (v.superseded_at) {
      exclusions.push({
        versionId: v.id,
        title: v.title,
        reason: 'Superseded version; excluded from current derived results.',
      });
      continue;
    }
    for (const [index, o] of (v.content?.observations ?? []).entries()) {
      const m = metric(o.label);
      if (!m) continue;
      let reason = '';
      const date = exactDate(v.clinical_date);
      const unit = tidy(o.unit);
      const n = /^(?:\d+(?:\.\d+)?|\.\d+)$/.test(o.value.trim()) ? Number(o.value) : NaN;
      if (date === null) reason = 'Exact, valid report date is missing.';
      else if (!Number.isFinite(n) || n <= 0)
        reason = 'Value is ambiguous, qualified or non-positive.';
      else if (m === 'creatinine' && !['mg/dl', 'umol/l'].includes(unit))
        reason = 'Creatinine unit is missing or unsupported.';
      else if (m === 'egfr' && !['ml/min/1.73m2', 'ml/min/1.73m^2'].includes(unit))
        reason = 'Reported eGFR unit is missing or unsupported.';
      else {
        const escaped = o.value.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (
          !o.sourceExcerpt ||
          !new RegExp(`(?<![\\d.])${escaped}(?![\\d.])`).test(o.sourceExcerpt) ||
          !tidy(o.sourceExcerpt).includes(unit) ||
          !Number.isInteger(o.sourcePage) ||
          o.sourcePage < 1
        )
          reason = 'Value/unit or page is not grounded in the reviewed source excerpt.';
      }
      if (reason) {
        exclusions.push({ versionId: v.id, title: v.title, reason });
        continue;
      }
      candidates.push({
        metric: m,
        point: {
          id: `${v.id}:${index}`,
          versionId: v.id,
          subjectId: v.owner_id,
          date: v.clinical_date!,
          timestamp: date!,
          value: m === 'creatinine' && unit === 'umol/l' ? n / 88.4 : n,
          rawValue: o.value,
          rawUnit: o.unit,
          sourceExcerpt: o.sourceExcerpt,
          sourcePage: o.sourcePage,
          title: v.title,
          facility: v.facility,
          converted: m === 'creatinine' && unit === 'umol/l',
        },
      });
    }
  }
  const unique: typeof candidates = [];
  const groups = new Map<string, typeof candidates>();
  for (const c of candidates) {
    const k = `${c.point.subjectId}:${c.metric}:${c.point.date}`;
    groups.set(k, [...(groups.get(k) ?? []), c]);
  }
  for (const group of groups.values()) {
    if (group.length > 1) {
      // Multiple samples on the same date cannot be ordered without trustworthy sample times.
      for (const c of group)
        exclusions.push({
          versionId: c.point.versionId,
          title: c.point.title,
          reason: 'Multiple measurements on the same date; sample order is unknown.',
        });
    } else unique.push(group[0]);
  }
  const subjectIds = [...new Set(unique.map((c) => c.point.subjectId))].sort();
  const trends = subjectIds.map((subjectId) => {
    const points = unique
      .filter((c) => c.point.subjectId === subjectId && c.metric === 'creatinine')
      .map((c) => c.point)
      .sort((a, b) => a.timestamp - b.timestamp);
    const reportedEgfr = unique
      .filter((c) => c.point.subjectId === subjectId && c.metric === 'egfr')
      .map((c) => c.point)
      .sort((a, b) => a.timestamp - b.timestamp);
    const first = points[0],
      last = points.at(-1);
    const hasChange = points.length >= 2;
    const delta = hasChange ? last!.value - first.value : null;
    const change = delta === null ? null : round(delta);
    const percent = delta === null ? null : round((delta / first.value) * 100, 1);
    const days = hasChange ? Math.round((last!.timestamp - first.timestamp) / 86400000) : null;
    const summary = hasChange
      ? `Reported creatinine changed from ${round(first.value, 3)} to ${round(last!.value, 3)} mg/dL between ${first.date} and ${last!.date} (${change! >= 0 ? '+' : ''}${change} mg/dL; ${percent! >= 0 ? '+' : ''}${percent}%; ${days} days).`
      : points.length === 1
        ? 'One supported creatinine measurement is available. At least two dated measurements are required to describe a change.'
        : 'No supported creatinine measurements are available.';
    return { subjectId, points, reportedEgfr, summary, change, percent, days };
  });
  const nodes: GraphNode[] = [];
  const graphLinks: GraphLink[] = [];
  const nodeIds = new Set<string>();
  function add(n: GraphNode) {
    if (!nodeIds.has(n.id)) {
      nodes.push(n);
      nodeIds.add(n.id);
    }
  }
  for (const v of versions.filter((v) => !v.superseded_at)) {
    const person = `person:${v.owner_id}`;
    const facility = `facility:${v.owner_id}:${v.facility}`;
    add({
      id: person,
      label: v.owner_id === viewer ? 'You' : `Shared patient ${v.owner_id.slice(0, 8)}`,
      kind: 'person',
      detail: 'A separate patient record group. Measurements are never combined across people.',
    });
    add({
      id: facility,
      label: v.facility,
      kind: 'facility',
      detail: 'Facility name as reviewed; integration is not implied.',
    });
    add({
      id: `record:${v.id}`,
      label: v.title,
      kind: 'record',
      detail: `${v.clinical_date ?? 'Date unknown'}; reviewed source version.`,
      versionId: v.id,
      sourceAvailable: Boolean(v.object_path),
    });
    graphLinks.push(
      { source: person, target: `record:${v.id}`, label: 'has reviewed report' },
      { source: `record:${v.id}`, target: facility, label: 'reported facility' },
    );
  }
  const family: EvidenceProjection['family'] = [];
  const activeLinks = links.filter(
    (l) => !l.ended_at && (l.inviter_id === viewer || l.invitee_id === viewer),
  );
  if (activeLinks.length || reported.length || assertions.some((a) => a.owner_id === viewer))
    add({
      id: `person:${viewer}`,
      label: 'You',
      kind: 'person',
      detail: 'Your family context. Family history is not genetic proof.',
    });
  for (const l of activeLinks) {
    const relation = relativeToViewer(l, viewer);
    const relative = l.inviter_id === viewer ? l.invitee_id : l.inviter_id;
    const label = relationshipLabel(relation);
    const degree = relationshipDegree(relation, l.basis);
    add({
      id: `relative:${l.id}`,
      label,
      kind: 'relative',
      basis: l.basis,
      detail: `${l.basis} relationship; ${degree ? `${degree === 1 ? 'first' : 'second'}-degree biological relative` : 'no biological degree asserted'}. Link acceptance alone shares no medical history.`,
    });
    graphLinks.push({
      source: `person:${viewer}`,
      target: `relative:${l.id}`,
      label: l.basis,
      basis: l.basis,
    });
    for (const a of assertions.filter((a) => a.owner_id === relative)) {
      const row = {
        id: a.id,
        label,
        basis: l.basis,
        degree,
        condition: a.condition,
        age: a.age_at_diagnosis,
        source:
          a.source_kind === 'document_linked'
            ? 'Shared by relative; document-linked, source file private'
            : 'Shared by relative; self-reported',
      };
      family.push(row);
      add({
        id: `assertion:${a.id}`,
        label: a.condition,
        kind: 'family',
        detail: `${row.source}. Age at diagnosis: ${a.age_at_diagnosis ?? 'unknown'}. Family context, not your diagnosis.`,
      });
      graphLinks.push({
        source: `relative:${l.id}`,
        target: `assertion:${a.id}`,
        label: 'explicitly shared condition',
      });
    }
  }
  for (const a of assertions.filter((a) => a.owner_id === viewer)) {
    add({
      id: `assertion:${a.id}`,
      label: a.condition,
      kind: 'family',
      detail: `Your own assertion; ${a.source_kind.replaceAll('_', ' ')}. Sharing requires a separate action.`,
    });
    graphLinks.push({
      source: `person:${viewer}`,
      target: `assertion:${a.id}`,
      label: 'own reported condition',
    });
  }
  for (const h of reported.filter((h) => h.owner_id === viewer && !h.withdrawn_at)) {
    const label = relationshipLabel(h.relationship),
      degree = relationshipDegree(h.relationship, h.basis);
    family.push({
      id: h.id,
      label,
      basis: h.basis,
      degree,
      condition: h.condition,
      age: h.age_at_diagnosis,
      source: 'Patient-reported; not independently confirmed',
    });
    add({
      id: `reported:${h.id}`,
      label: `${label}: ${h.condition}`,
      kind: 'family',
      basis: h.basis,
      detail: `Patient-reported ${h.basis} family context. Age at diagnosis: ${h.age_at_diagnosis ?? 'unknown'}. Not genetic proof.`,
    });
    graphLinks.push({
      source: `person:${viewer}`,
      target: `reported:${h.id}`,
      label: 'patient-reported family history',
      basis: h.basis,
    });
  }
  const graph = { nodes, links: graphLinks };
  // Revision contains authorized identifiers/status only, never a global/private database revision.
  const revision = JSON.stringify({
    versions: versions.map((v) => [v.id, v.superseded_at]),
    links: activeLinks.map((l) => l.id),
    assertions: assertions.map((a) => a.id),
    reported: reported.filter((h) => !h.withdrawn_at).map((h) => h.id),
  });
  return { trends, exclusions, graph, family, revision };
}
