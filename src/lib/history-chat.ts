import type { EvidenceVersion, EvidenceProjection } from './evidence';
export const chatTopics = [
  'summary',
  'creatinine',
  'medicines',
  'allergies',
  'family',
  'timeline',
  'vaccines',
  'imaging',
  'unknown',
] as const;
export type ChatTopic = (typeof chatTopics)[number];
export type HistoryAnswer = {
  intro: string;
  cards: {
    text: string;
    citations: {
      versionId: string;
      title: string;
      date: string | null;
      page: number | null;
      excerpt: string;
    }[];
  }[];
  notice: string;
  mode: 'local_evidence' | 'gemini_topic_router';
  revision: string;
};
export function restrictedQuestion(question: string) {
  return /\b(diagnos\w*|treatment|cure|should i (?:take|stop|start|change)|can i (?:take|stop|start|change)|what (?:dose|dosage)|which medicine should|do i have|am i (?:sick|ill)|prescribe|stage [1-5])\b/i.test(
    question,
  );
}
export function localTopic(question: string): ChatTopic {
  if (/creatinine|egfr|kidney|renal|trend|blood test|lab results?|lab reports?/i.test(question))
    return 'creatinine';
  if (/vaccine|immuni|injection|teeka/i.test(question)) return 'vaccines';
  if (/imaging|ultrasound|scan result|x.?ray/i.test(question)) return 'imaging';
  if (/allerg|reaction/i.test(question)) return 'allergies';
  if (/medicine|medication|prescription|drug|dawai|dawa\b/i.test(question)) return 'medicines';
  if (/family|mother|father|parent|heredit|genetic/i.test(question)) return 'family';
  if (/timeline|hospital|facility|date|when|visit/i.test(question)) return 'timeline';
  if (/summary|summari[sz]e|history|overview|reports?|records?|health/i.test(question))
    return 'summary';
  return 'unknown';
}
function quoteLines(records: EvidenceVersion[], pattern: RegExp) {
  const result: HistoryAnswer['cards'] = [];
  for (const record of records) {
    let page: number | null = null;
    for (const raw of record.content.notes.split(/\r?\n/)) {
      const marker = raw.match(/^\[Source page (\d+);/);
      if (marker) {
        page = Number(marker[1]);
        continue;
      }
      const line = raw.trim();
      if (pattern.test(line))
        result.push({
          text: 'Recorded source text: “' + line.slice(0, 700) + '”',
          citations: [
            {
              versionId: record.id,
              title: record.title,
              date: record.clinical_date,
              page,
              excerpt: line.slice(0, 1000),
            },
          ],
        });
    }
  }
  return result.slice(0, 12);
}
export function answerHistory(
  question: string,
  records: EvidenceVersion[],
  projection: EvidenceProjection,
  topic = localTopic(question),
): HistoryAnswer {
  const current = records.filter((v) => !v.superseded_at),
    cards: HistoryAnswer['cards'] = [];
  const result: HistoryAnswer = {
    intro: '',
    cards,
    mode: 'local_evidence',
    revision: projection.revision,
    notice:
      'Patient-reviewed source history, not verified clinical advice. A recorded prescription may be historical and is not proof of current use. No diagnosis, treatment or genetic prediction is made.',
  };
  if (restrictedQuestion(question)) {
    result.intro =
      'I can help you locate and compare your recorded history, but cannot diagnose you or tell you to start, stop or change treatment. Take the original reports to a qualified clinician.';
    return result;
  }
  if (!current.length) {
    result.intro =
      'Your account has no reviewed reports yet. Scan a synthetic document, check the source fields and confirm it. Then I can answer from your own history.';
    return result;
  }
  if (topic === 'creatinine') {
    result.intro = 'Here is the numerical history supported by your current reviewed reports.';
    for (const trend of projection.trends) {
      if (trend.points.length)
        cards.push({
          text: trend.summary,
          citations: trend.points.map((p) => ({
            versionId: p.versionId,
            title: p.title,
            date: p.date,
            page: p.sourcePage,
            excerpt: p.sourceExcerpt,
          })),
        });
      if (trend.reportedEgfr.length)
        cards.push({
          text: 'Reported eGFR values are retained as printed. Their calculation methods and comparability are not established; no eGFR is recomputed or disease stage assigned.',
          citations: trend.reportedEgfr.map((p) => ({
            versionId: p.versionId,
            title: p.title,
            date: p.date,
            page: p.sourcePage,
            excerpt: p.sourceExcerpt,
          })),
        });
    }
    if (!cards.length)
      result.intro =
        'No supported, unambiguous dated creatinine measurements are available in your reviewed sources. Review the dashboard exclusions and original reports.';
  } else if (
    topic === 'medicines' ||
    topic === 'allergies' ||
    topic === 'family' ||
    topic === 'vaccines' ||
    topic === 'imaging'
  ) {
    const pattern =
      topic === 'medicines'
        ? /^(?:medications?|medicines?|prior medication history|rx)\s*:/i
        : topic === 'allergies'
          ? /^allerg(?:y|ies)(?:\s+history)?\s*:/i
          : topic === 'vaccines'
            ? /^(?:vaccine recorded|administration date recorded|adverse reaction recorded)\s*:/i
            : topic === 'imaging'
              ? /^(?:study|finding|impression recorded|limit)\s*:/i
              : /^family history\s*:/i;
    cards.push(...quoteLines(current, pattern));
    result.intro = cards.length
      ? 'These are quoted historical entries from your reviewed sources.'
      : 'I could not find clearly labelled entries for that topic. Absence in these reports does not establish that the condition, allergy or medication is absent.';
    if (topic === 'family') {
      result.notice +=
        ' Family text in a report is patient-reported context. It does not verify a relative, establish a genetic variant or grant access to relatives’ records.';
    }
  } else if (topic === 'summary' || topic === 'timeline') {
    result.intro = `Your current reviewed history includes ${current.length} report${current.length === 1 ? '' : 's'} from ${new Set(current.map((v) => v.facility)).size} recorded facilities. Here are the latest available entries.`;
    for (const record of [...current]
      .sort((a, b) => (b.clinical_date ?? '').localeCompare(a.clinical_date ?? ''))
      .slice(0, 10))
      cards.push({
        text: `${record.clinical_date ?? 'Date unknown'} · ${record.title} · ${record.facility}`,
        citations: [
          {
            versionId: record.id,
            title: record.title,
            date: record.clinical_date,
            page: null,
            excerpt: 'Patient-reviewed report metadata. Open the original source for its content.',
          },
        ],
      });
  } else
    result.intro =
      'Try asking: “Summarize my history”, “How has my creatinine changed?”, “Which medicines were recorded?”, “What allergies are documented?” or “Show my timeline”. I only answer supported history questions.';
  return result;
}
