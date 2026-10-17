'use client';
import { useState } from 'react';
type Entry = {
  label: string;
  value: string;
  unit: string;
  sourceExcerpt: string;
  sourcePage: number;
};
const empty: Entry = { label: '', value: '', unit: '', sourceExcerpt: '', sourcePage: 1 };
export function ReviewFields({
  initial,
}: {
  initial?: { notes?: string; observations?: Entry[] };
}) {
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [observations, setObservations] = useState<Entry[]>(initial?.observations ?? []);
  function update(i: number, patch: Partial<Entry>) {
    setObservations((rows) => rows.map((r, n) => (n === i ? { ...r, ...patch } : r)));
  }
  return (
    <>
      <input type="hidden" name="content" value={JSON.stringify({ notes, observations })} />
      <label>
        Notes and uncertain information
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={10000}
          rows={3}
        />
      </label>
      {observations.map((o, i) => (
        <fieldset key={i}>
          <legend>Measurement {i + 1}</legend>
          <label>
            Test or measurement
            <input
              value={o.label}
              onChange={(e) => update(i, { label: e.target.value })}
              maxLength={100}
              required
            />
          </label>
          <label>
            Value as written
            <input
              value={o.value}
              onChange={(e) => update(i, { value: e.target.value })}
              maxLength={100}
              required
            />
          </label>
          <label>
            Unit as written
            <input
              value={o.unit}
              onChange={(e) => update(i, { unit: e.target.value })}
              maxLength={60}
            />
          </label>
          <label>
            Exact supporting text
            <textarea
              value={o.sourceExcerpt}
              onChange={(e) => update(i, { sourceExcerpt: e.target.value })}
              maxLength={1000}
              required
            />
          </label>
          <label>
            Source page
            <input
              type="number"
              min={1}
              max={9999}
              value={o.sourcePage}
              onChange={(e) => update(i, { sourcePage: Number(e.target.value) })}
              required
            />
          </label>
          <button
            className="button secondary"
            type="button"
            onClick={() => setObservations((rows) => rows.filter((_, n) => n !== i))}
          >
            Remove measurement
          </button>
        </fieldset>
      ))}
      <button
        className="button secondary"
        type="button"
        disabled={observations.length >= 100}
        onClick={() => setObservations((rows) => [...rows, { ...empty }])}
      >
        Add measurement
      </button>
    </>
  );
}
