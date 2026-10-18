import { z } from 'zod';
export const regions = [
  'undisclosed',
  'north_india',
  'south_india',
  'east_india',
  'west_india',
  'central_india',
  'northeast_india',
  'outside_india',
] as const;
export const environments = ['unknown', 'urban', 'rural', 'coastal', 'hilly'] as const;
export const allergies = [
  'none_known',
  'unknown',
  'medicine',
  'food',
  'dust_pollen',
  'insect',
  'other',
] as const;
export const conditions = [
  'none_known',
  'unknown',
  'diabetes',
  'hypertension',
  'asthma',
  'kidney_condition',
  'other',
] as const;
export const familyConditions = [
  'unknown',
  'none_known',
  'diabetes',
  'hypertension',
  'breast_cancer',
  'other',
] as const;
export const assessmentSchema = z
  .object({
    region: z.enum(regions),
    environment: z.enum(environments),
    allergies: z.array(z.enum(allergies)).min(1).max(7).refine(noExclusiveMix),
    conditions: z.array(z.enum(conditions)).min(1).max(7).refine(noExclusiveMix),
    exposure: z.enum(['unknown', 'none', 'dust_smoke', 'mosquitoes', 'both']),
    family_condition: z.enum(familyConditions),
    relationship: z.enum(['unknown', 'parent', 'sibling', 'grandparent', 'aunt_uncle']),
    basis: z.enum(['unknown', 'biological', 'adoptive', 'social']),
    age_at_diagnosis: z.number().int().min(0).max(120).nullable(),
  })
  .strict()
  .refine(
    (v) => ['unknown', 'none_known'].includes(v.family_condition) || v.relationship !== 'unknown',
    { message: 'Choose a relationship for reported family history.' },
  );
function noExclusiveMix(values: string[]) {
  return (
    new Set(values).size === values.length &&
    !(values.length > 1 && values.some((v) => ['none_known', 'unknown'].includes(v)))
  );
}
export type Assessment = z.infer<typeof assessmentSchema>;
export function assessmentNotes(v: Assessment): string[] {
  const notes = [
    'These are your own reported answers, not verified diagnoses or an allergy test. No risk score is calculated.',
  ];
  if (v.region !== 'undisclosed')
    notes.push(
      'Your broad region is saved as context only. We have no live local surveillance feed and cannot infer current regional illness or personal risk.',
    );
  if (v.allergies.some((a) => !['unknown', 'none_known'].includes(a)))
    notes.push(
      'Keep the exact suspected trigger and reaction in your own records and discuss confirmation with your clinician. A questionnaire cannot confirm or rule out an allergy.',
    );
  if (['mosquitoes', 'both'].includes(v.exposure))
    notes.push(
      'For reported mosquito exposure: review general bite-prevention guidance. This does not mean dengue or malaria is present in your area or that you have either illness.',
    );
  if (['dust_smoke', 'both'].includes(v.exposure))
    notes.push(
      'You reported dust or smoke exposure. This is a discussion prompt for your clinician, not proof of an allergy or respiratory illness.',
    );
  if (!['none_known', 'unknown'].includes(v.family_condition))
    notes.push(
      v.basis === 'biological'
        ? 'Biological family history can inform a clinical conversation. It does not prove a genetic variant or predict that you will develop the condition.'
        : 'This family context is not classified as inherited biological risk. No relative records or permissions are created.',
    );
  return notes;
}
export function label(value: string) {
  return value.replaceAll('_', ' ').replace(/^./, (c) => c.toUpperCase());
}
