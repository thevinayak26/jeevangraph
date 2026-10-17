export const roles = ['patient', 'doctor', 'facility', 'platform'] as const;
export type Role = (typeof roles)[number];
export type Section =
  | 'overview'
  | 'timeline'
  | 'records'
  | 'family'
  | 'graph'
  | 'sharing'
  | 'settings';
export const sections: Section[] = [
  'overview',
  'timeline',
  'records',
  'family',
  'graph',
  'sharing',
  'settings',
];
export type Observation = {
  id: string;
  analyteKey: string;
  rawLabel: string;
  rawValue: string;
  rawUnit: string;
  valueNumeric: number;
  sampleDate: string | null;
  sourceExcerpt: string;
  sourcePage: number;
};
export type HealthRecord = {
  alias: string;
  id: string;
  versionId: string;
  title: string;
  kind: string;
  clinicalDate: string | null;
  clinicalYear: number | null;
  datePrecision: string;
  facility: string;
  facilityAlias: string;
  sourceRecordId: string;
  sections: { heading: string; lines: string[] }[];
  observations: Observation[];
  previewImage?: string;
};
export type FamilyContext = {
  id: string;
  label: string;
  relationship: string;
  basis: string;
  degree: string;
  condition: string | null;
  diagnosisAge: number | null;
  agePrecision: string;
};
export type WorkspaceData = {
  role: Role;
  patient: { name: string; initials: string; dob: string; demoId: string } | null;
  records: HealthRecord[];
  family: FamilyContext[];
  facilities: { id: string; name: string; kind: string; status: string }[];
};

export function isRole(value: string): value is Role {
  return (roles as readonly string[]).includes(value);
}
export function isSection(value: string): value is Section {
  return sections.includes(value as Section);
}

export function formatRecordDate(
  record: Pick<HealthRecord, 'clinicalDate' | 'clinicalYear'>,
): string {
  if (!record.clinicalDate)
    return record.clinicalYear
      ? `${record.clinicalYear} · exact date unknown`
      : 'Date not recorded';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(record.clinicalDate + 'T12:00:00Z'));
}

export function searchRecords(
  records: HealthRecord[],
  query: string,
  kind: string,
  period: string,
): HealthRecord[] {
  const text = query.trim().toLowerCase();
  return records.filter(
    (r) =>
      (kind === 'all' || r.kind === kind) &&
      (period === 'all' ||
        r.clinicalDate?.startsWith(period) ||
        String(r.clinicalYear) === period) &&
      (!text ||
        `${r.title} ${r.facility} ${r.kind} ${r.sourceRecordId}`.toLowerCase().includes(text)),
  );
}

export function getKidneySeries(records: HealthRecord[]) {
  return records
    .filter((r) => r.kind === 'lab_report' && r.clinicalDate)
    .map((record) => {
      const creatinine = record.observations.find((o) => o.analyteKey === 'creatinine');
      const egfr = record.observations.find((o) => o.analyteKey === 'egfr_reported');
      return {
        recordId: record.id,
        date: record.clinicalDate!,
        timestamp: Date.parse(record.clinicalDate! + 'T00:00:00Z'),
        creatinine: creatinine?.valueNumeric ?? null,
        egfr: egfr?.valueNumeric ?? null,
        facility: record.facility,
        facilityAlias: record.facilityAlias,
      };
    })
    .sort((a, b) => a.timestamp - b.timestamp);
}
