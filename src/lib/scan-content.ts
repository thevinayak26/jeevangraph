export type ScannedPage = {
  page: number;
  text: string;
  method: 'pdf_text' | 'local_ocr';
  confidence: number | null;
};
export type ScanProposal = {
  title: string;
  facility: string;
  date: string;
  kind: 'lab_report' | 'prescription' | 'imaging_report' | 'immunization' | 'other';
  content: {
    notes: string;
    observations: {
      label: string;
      value: string;
      unit: string;
      sourceExcerpt: string;
      sourcePage: number;
    }[];
  };
  warnings: string[];
  pages: ScannedPage[];
};
const kindMap: Record<string, ScanProposal['kind']> = {
  'laboratory report': 'lab_report',
  'lab report': 'lab_report',
  prescription: 'prescription',
  'imaging report': 'imaging_report',
  immunization: 'immunization',
};
export function proposeScan(pages: ScannedPage[], filename: string): ScanProposal {
  const full = pages.map((p) => p.text).join('\n');
  const lines = full
    .split(/\r?\n/)
    .map((v) => v.trim())
    .filter(Boolean);
  const warnings = [
    'Suggestions are unverified. Compare dates, units, numbers and patient identity with the original before confirming.',
  ];
  const dates = [
    ...new Set(
      [
        ...full.matchAll(
          /(?:report\s*date|collection\s*date|date\s*of\s*report)\s*:\s*(\d{4}-\d{2}-\d{2})/gi,
        ),
      ].map((m) => m[1]),
    ),
  ].filter((date) => {
    const t = new Date(date + 'T00:00:00Z');
    return Number.isFinite(t.getTime()) && t.toISOString().slice(0, 10) === date;
  });
  const date = dates.length === 1 ? dates[0] : '';
  if (!date)
    warnings.push(
      'Report date not confidently identified. Enter the source date or leave it unknown.',
    );
  const facility = (
    lines.find((v) => /^facility\s*:/i.test(v))?.replace(/^facility\s*:\s*/i, '') ?? ''
  ).slice(0, 160);
  if (!facility) warnings.push('Facility not identified. Enter it from the source.');
  const kindText = lines
    .find((v) => /^record\s*type\s*:/i.test(v))
    ?.replace(/^record\s*type\s*:\s*/i, '')
    .toLowerCase();
  const kind =
    kindMap[kindText ?? ''] ??
    (/\bprescription\b/i.test(full)
      ? 'prescription'
      : /\b(creatinine|hemoglobin|glucose)\b/i.test(full)
        ? 'lab_report'
        : 'other');
  const observations: ScanProposal['content']['observations'] = [];
  for (const p of pages)
    for (const line of p.text.split(/\r?\n/)) {
      const m = line
        .trim()
        .match(
          /^(serum\s+creatinine|creatinine|reported\s+eGFR|eGFR|fasting\s+glucose|blood\s+glucose|hemoglobin|haemoglobin|HbA1c)\s*[:=]\s*([<>≤≥]?\s*\d+(?:[.,]\d+)?)\s+(mg\/dL|[uµμ]mol\/L|mL\/min\/1\.73\s*m(?:2|²)|g\/dL|%)(?=\s|\||$)/i,
        );
      if (m)
        observations.push({
          label: m[1].replace(/^serum\s+/i, '').replace(/^reported\s+/i, ''),
          value: m[2].trim(),
          unit: m[3],
          sourceExcerpt: line.trim().slice(0, 1000),
          sourcePage: p.page,
        });
    }
  if (!observations.length)
    warnings.push(
      'No supported structured measurements found. Keep the readable source text in notes or enter measurements manually.',
    );
  if (pages.some((p) => p.method === 'local_ocr'))
    warnings.push(
      'Printed-English OCR can misread decimals, units and medicine names. OCR confidence is not clinical accuracy.',
    );
  const notes = pages
    .map(
      (p) =>
        `[Source page ${p.page}; ${p.method === 'pdf_text' ? 'PDF text extraction' : 'local printed-English OCR'}]\n${p.text}`,
    )
    .join('\n\n');
  if (notes.length > 9500)
    warnings.push(
      'Source text exceeds the notes limit. Review retained text and keep the original for the remaining content.',
    );
  return {
    title: (kind === 'other'
      ? filename.replace(/\.[^.]+$/, '')
      : kind.replaceAll('_', ' ') + (date ? ' · ' + date : '')
    ).slice(0, 160),
    facility,
    date,
    kind,
    content: { notes: notes.slice(0, 9500), observations: observations.slice(0, 100) },
    warnings,
    pages,
  };
}

export function batchIdentityWarnings(proposals: ScanProposal[]) {
  const ids = new Set<string>(),
    birthDates = new Set<string>();
  for (const p of proposals) {
    const text = p.pages.map((v) => v.text).join('\n');
    for (const m of text.matchAll(/patient\s*id\s*:\s*([^|\n]+)/gi))
      ids.add(m[1].trim().toLowerCase());
    for (const m of text.matchAll(/\bDOB\s*:\s*(\d{4}-\d{2}-\d{2})/gi)) birthDates.add(m[1]);
  }
  const warnings = [];
  if (ids.size > 1 || birthDates.size > 1)
    warnings.push(
      'Different patient identifiers or dates of birth were found. Review and import the correct patient reports individually.',
    );
  return warnings;
}
