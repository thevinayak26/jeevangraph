import data from '../data/synthetic.json' with { type: 'json' };
import type { FamilyContext, HealthRecord, Role, WorkspaceData } from './domain';

const conditionLabels: Record<string, string> = {
  breast_cancer: 'Breast cancer',
  type_2_diabetes: 'Type 2 diabetes',
  hypertension: 'Hypertension',
};

export function getPreviewWorkspace(role: Role): WorkspaceData {
  const index = data.patients.find((p) => p.alias === 'P_AARAV')!;
  const organizations = data.organizations.filter((o) => o.kind !== 'demo_platform');
  // The preview projection is intentionally narrow; it is not an authentication layer.
  const records: HealthRecord[] =
    role === 'patient'
      ? data.records
          .filter((r) => r.patientId === index.id)
          .map((r) => {
            const org = organizations.find((o) => o.id === r.organizationId)!;
            return {
              alias: r.alias,
              id: r.id,
              versionId: r.versionId,
              title: r.title,
              kind: r.kind,
              clinicalDate: r.clinicalDate,
              clinicalYear: r.clinicalYear,
              datePrecision: r.datePrecision,
              facility: org.name,
              facilityAlias: org.alias,
              sourceRecordId: r.sourceRecordId,
              sections: r.sections,
              observations: r.observations,
              previewImage: (
                {
                  R03: '/fixtures/R03_prescription.png',
                  R04: '/fixtures/R04_january_renal.png',
                  R09: '/fixtures/R09_september_renal.png',
                } as Record<string, string>
              )[r.alias],
            };
          })
          .sort((a, b) => {
            const key = (r: HealthRecord) => r.clinicalDate ?? `${r.clinicalYear ?? '0000'}-01-01`;
            return key(b).localeCompare(key(a));
          })
      : [];
  const family: FamilyContext[] =
    role === 'patient'
      ? data.familyNodes.map((node) => {
          const assertion = data.familyAssertions.find(
            (a) =>
              a.nodeId === node.id &&
              a.ownerPatientId === index.id &&
              a.sourceKind === 'patient_reported',
          );
          return {
            id: node.id,
            label: node.label,
            relationship: node.relationshipToIndex,
            basis: node.basis,
            degree: node.degree,
            condition: assertion ? conditionLabels[assertion.conditionKey] : null,
            diagnosisAge: assertion?.ageAtDiagnosis ?? null,
            agePrecision: assertion?.agePrecision ?? 'unknown',
          };
        })
      : [];
  return {
    role,
    patient:
      role === 'patient'
        ? { name: index.displayName, initials: 'AS', dob: index.dob, demoId: index.demoIdentifier }
        : null,
    records,
    family,
    facilities: (role === 'facility'
      ? organizations.filter((o) => o.alias === 'ORG_A')
      : organizations
    ).map((o) => ({ id: o.id, name: o.name, kind: o.kind, status: o.status })),
  };
}
