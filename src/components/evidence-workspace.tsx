'use client';
import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import type { EvidenceProjection } from '@/lib/evidence';
import { HealthGraph } from './health-graph';
export function EvidenceWorkspace() {
  const [data, setData] = useState<EvidenceProjection | null>(null);
  const [error, setError] = useState('');
  const [checked, setChecked] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    let sequence = 0;
    let active: AbortController | null = null;
    async function load() {
      if (document.hidden) return;
      const current = ++sequence;
      active?.abort();
      active = new AbortController();
      const controller = active;
      const timer = setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetch('/api/evidence', {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('Unavailable');
        const next = (await response.json()) as EvidenceProjection;
        if (alive && current === sequence) {
          setData((old) => (old?.revision === next.revision ? old : next));
          setError('');
          setChecked(new Date().toLocaleTimeString());
        }
      } catch {
        if (alive && current === sequence) {
          setData(null);
          setError(
            'Evidence could not be refreshed. Sign in again or check the connection. Previous results have been cleared.',
          );
        }
      } finally {
        clearTimeout(timer);
      }
    }
    const visibility = () => {
      if (document.hidden) {
        ++sequence;
        active?.abort();
        setData(null);
      } else void load();
    };
    void load();
    const interval = setInterval(() => void load(), 10000);
    window.addEventListener('focus', load);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      alive = false;
      ++sequence;
      active?.abort();
      clearInterval(interval);
      window.removeEventListener('focus', load);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
  if (error)
    return (
      <p role="alert" className="phase3-notice">
        {error}
      </p>
    );
  if (!data) return <p role="status">Checking current evidence permissions…</p>;
  return (
    <>
      <p className="phase3-refresh">
        Permissions checked {checked ?? 'just now'}. Refreshes every 10 seconds and when you return
        to this tab. Already viewed information cannot be retracted. This prototype includes up to
        500 authorized versions per refresh.
      </p>
      {!data.trends.length && (
        <section className="panel">
          <h2>Start with a reviewed measurement</h2>
          <p>
            No supported dated measurements are available. Upload a synthetic report, review its
            fields, or ask the patient for an exact-version grant.
          </p>
        </section>
      )}
      {data.trends.map((trend, i) => (
        <section className="panel" key={trend.subjectId}>
          <h2>
            {data.trends.length === 1
              ? 'Creatinine across available reports'
              : `Patient record group ${i + 1}`}
          </h2>
          <p className="phase3-summary">{trend.summary}</p>
          <p>
            Supported units are normalized to mg/dL. Laboratory method comparability is not
            established. This is a numerical observation, not a diagnosis.
          </p>
          {trend.points.length > 0 && (
            <div
              className="phase3-chart"
              role="img"
              aria-label="Reported creatinine measurements. Exact values and source links are in the table."
            >
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <LineChart
                  data={trend.points}
                  margin={{ top: 20, right: 20, left: 0, bottom: 15 }}
                  accessibilityLayer
                >
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 4" />
                  <XAxis
                    dataKey="timestamp"
                    type="number"
                    domain={['dataMin', 'dataMax']}
                    ticks={
                      trend.points.length <= 8 ? trend.points.map((p) => p.timestamp) : undefined
                    }
                    tickFormatter={(n) =>
                      new Date(n).toLocaleDateString('en-GB', {
                        month: 'short',
                        day: 'numeric',
                        timeZone: 'UTC',
                      })
                    }
                  />
                  <YAxis domain={['auto', 'auto']} />
                  <Tooltip
                    labelFormatter={(n) => new Date(Number(n)).toISOString().slice(0, 10)}
                    formatter={(v) => [`${v} mg/dL`, 'Reported creatinine']}
                  />
                  <Line
                    type="linear"
                    dataKey="value"
                    stroke="#087e76"
                    strokeWidth={3}
                    dot={{ r: 5 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="phase3-table-wrap">
            <table>
              <caption>Reviewed measurements and supporting source versions</caption>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Creatinine (mg/dL)</th>
                  <th>As written</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {trend.points.map((p) => (
                  <tr key={p.id}>
                    <td>{p.date}</td>
                    <td>
                      {Number(p.value.toFixed(3))}
                      {p.converted ? ' (converted)' : ''}
                    </td>
                    <td>
                      {p.rawValue} {p.rawUnit}
                    </td>
                    <td>
                      <a href={`/api/private-source/${encodeURIComponent(p.versionId)}`}>
                        {p.title}
                      </a>
                      <details>
                        <summary>Supporting excerpt</summary>
                        <p>
                          Page {p.sourcePage}: {p.sourceExcerpt}
                        </p>
                        <p>{p.facility}</p>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {trend.reportedEgfr.length > 0 && (
            <details>
              <summary>Reported eGFR values ({trend.reportedEgfr.length})</summary>
              <p>
                Methods unspecified. Values are displayed as reported; no recalculation, staging or
                comparative interpretation is performed.
              </p>
              <ul>
                {trend.reportedEgfr.map((p) => (
                  <li key={p.id}>
                    {p.date}: {p.rawValue} {p.rawUnit} ·{' '}
                    <a href={`/api/private-source/${encodeURIComponent(p.versionId)}`}>{p.title}</a>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      ))}
      {data.exclusions.length > 0 && (
        <section className="panel">
          <h2>Excluded from numerical comparison</h2>
          <p>These records remain evidence, but are not silently forced into a trend.</p>
          <ul>
            {data.exclusions.map((e, i) => (
              <li key={`${e.versionId}:${i}`}>
                <strong>{e.title}</strong>: {e.reason}
              </li>
            ))}
          </ul>
        </section>
      )}
      <HealthGraph graph={data.graph} />
      <section className="panel">
        <h2>Your visible family context</h2>
        <p>
          Only your reported history and conditions explicitly shared with your account appear here.
          A doctor’s record grant does not include a patient’s family context.
        </p>
        {data.family.length ? (
          <ul>
            {data.family.map((f) => (
              <li key={f.id}>
                <strong>
                  {f.label}: {f.condition}
                </strong>
                <p>
                  {f.basis} relationship
                  {f.degree ? `; ${f.degree === 1 ? 'first' : 'second'} degree` : ''}. Age at
                  diagnosis: {f.age ?? 'unknown'}. {f.source}.
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p>No family history has been reported or independently shared with you.</p>
        )}
      </section>
    </>
  );
}
