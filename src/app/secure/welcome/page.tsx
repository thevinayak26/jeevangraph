import { AssessmentChoices } from '@/components/assessment-choices';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isConnected, sessionClient } from '@/lib/supabase/server';
import {
  assessmentSchema,
  assessmentNotes,
  regions,
  environments,
  allergies,
  conditions,
  familyConditions,
  label,
} from '@/lib/assessment';
import { saveAssessment } from './actions';
export const dynamic = 'force-dynamic';
export default async function Welcome({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  if (!isConnected()) redirect('/account');
  const db = await sessionClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect('/account');
  const { data, error } = await db
    .from('welcome_assessments')
    .select('status,answers')
    .eq('owner_id', user.id)
    .maybeSingle();
  const raw = data?.answers;
  const parsed = assessmentSchema.safeParse(
    raw
      ? Object.fromEntries(Object.entries(raw).filter(([key]) => key !== 'schema_version'))
      : null,
  );
  const answers = parsed.success ? parsed.data : null;
  const { status } = await searchParams;
  return (
    <main className="secure-shell assessment-shell">
      <nav className="phase3-nav" aria-label="Private workspace">
        <Link href="/secure">Private records</Link>
        <Link href="/secure/intelligence">HealthGraph</Link>
        <Link href="/secure/family">Family history</Link>
      </nav>
      <p className="assessment-eyebrow">JeevanGraph · A little context, better conversations</p>
      <h1>Your health, in your words</h1>
      <p>
        An optional first-visit questionnaire. Choose what you know, or skip. Synthetic answers only
        in this prototype.
      </p>
      <p>
        No diagnosis, allergy testing, validated screening, live outbreak feed or genetic
        prediction. No exact location is collected. These answers are private to you and are not
        included in doctor grants, family sharing or external AI requests.
      </p>
      {status && (
        <p role="status">
          {status === 'saved'
            ? 'Your reported context is saved. Review your notes below.'
            : status === 'cleared'
              ? 'Your saved answers have been cleared.'
              : 'Could not save. Choose at least one option in each checkbox group; do not combine unknown or none known with another answer. Check your connection and try again.'}
        </p>
      )}
      {error && (
        <p role="alert">
          The questionnaire is temporarily unavailable. You can continue to your records and try
          again later.
        </p>
      )}
      {answers && (
        <section className="panel" aria-label="Your educational summary">
          <h2>Your conversation starters</h2>
          <ul>
            {assessmentNotes(answers).map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
          <p>
            Reported region: {label(answers.region)}. Reported family context:{' '}
            {label(answers.family_condition)}
            {!['unknown', 'none_known'].includes(answers.family_condition) &&
              `, ${label(answers.relationship)}, ${label(answers.basis)}, age ${answers.age_at_diagnosis ?? 'unknown'}`}
            .
          </p>
          <p>
            Add more detailed, patient-reported entries in{' '}
            <Link href="/secure/family">Family history</Link>. Relative-confirmed sharing requires
            its own invitation and consent.
          </p>
          <p>
            General education:{' '}
            <a
              href="https://www.who.int/news-room/fact-sheets/detail/dengue-and-severe-dengue"
              target="_blank"
              rel="noreferrer"
            >
              WHO mosquito-bite prevention
            </a>
            . This link is general guidance, not evidence of a local outbreak.
          </p>
        </section>
      )}
      <form action={saveAssessment} className="panel assessment-form">
        <input type="hidden" name="intent" value="save" />
        <h2>{answers ? 'Update your answers' : 'A few quick questions'}</h2>
        <label>
          1. Broad region (optional)
          <select name="region" defaultValue={answers?.region ?? 'undisclosed'}>
            {regions.map((v) => (
              <option key={v} value={v}>
                {v === 'undisclosed' ? 'Prefer not to say' : label(v)}
              </option>
            ))}
          </select>
        </label>
        <label>
          2. Your usual surroundings
          <select name="environment" defaultValue={answers?.environment ?? 'unknown'}>
            {environments.map((v) => (
              <option key={v} value={v}>
                {label(v)}
              </option>
            ))}
          </select>
        </label>
        <fieldset>
          <legend>3. Known or suspected allergies you want to record</legend>
          <p>Choose all that apply. Choose unknown or none known on its own.</p>
          <AssessmentChoices
            name="allergies"
            options={allergies}
            initial={answers?.allergies ?? ['unknown']}
          />
        </fieldset>
        <fieldset>
          <legend>4. Conditions you have previously been told you have</legend>
          <p>Self-reported, not confirmed here. Choose unknown or none known on its own.</p>
          <AssessmentChoices
            name="conditions"
            options={conditions}
            initial={answers?.conditions ?? ['unknown']}
          />
        </fieldset>
        <label>
          5. Environmental exposure you have noticed
          <select name="exposure" defaultValue={answers?.exposure ?? 'unknown'}>
            {['unknown', 'none', 'dust_smoke', 'mosquitoes', 'both'].map((v) => (
              <option key={v} value={v}>
                {label(v)}
              </option>
            ))}
          </select>
        </label>
        <fieldset>
          <legend>6. One family-history detail (optional)</legend>
          <p>No relative names or records. Add additional entries later in Family history.</p>
          <label>
            Condition reported in your family
            <select name="family_condition" defaultValue={answers?.family_condition ?? 'unknown'}>
              {familyConditions.map((v) => (
                <option key={v} value={v}>
                  {label(v)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Relationship to you
            <select name="relationship" defaultValue={answers?.relationship ?? 'unknown'}>
              {['unknown', 'parent', 'sibling', 'grandparent', 'aunt_uncle'].map((v) => (
                <option key={v} value={v}>
                  {label(v)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Relationship type
            <select name="basis" defaultValue={answers?.basis ?? 'unknown'}>
              {['unknown', 'biological', 'adoptive', 'social'].map((v) => (
                <option key={v} value={v}>
                  {label(v)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Age at diagnosis, if known
            <input
              name="age_at_diagnosis"
              type="number"
              min="0"
              max="120"
              step="1"
              defaultValue={answers?.age_at_diagnosis ?? ''}
            />
          </label>
        </fieldset>
        <label className="assessment-choice">
          <input type="checkbox" name="consent" value="yes" required />I choose to save these
          synthetic, patient-reported answers privately in my account. They do not grant access to
          anyone else.
        </label>
        <button className="button primary" disabled={Boolean(error)}>
          Save and view my notes
        </button>
      </form>
      <div className="assessment-controls">
        <form action={saveAssessment}>
          <input type="hidden" name="intent" value="skip" />
          <button className="button secondary">Skip questionnaire and clear saved answers</button>
        </form>
        <form action={saveAssessment}>
          <input type="hidden" name="intent" value="clear" />
          <button className="button secondary">Clear my answers</button>
        </form>
        {data ? (
          <Link className="button secondary" href="/secure">
            Continue to my records
          </Link>
        ) : (
          <form action={saveAssessment}>
            <input type="hidden" name="intent" value="skip" />
            <button className="button secondary">Continue without questionnaire</button>
          </form>
        )}
      </div>
    </main>
  );
}
