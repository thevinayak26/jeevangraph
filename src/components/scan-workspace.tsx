'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { FileText, ScanLine, CheckCircle2, ArrowRight, UploadCloud } from 'lucide-react';
import { ReviewFields } from './review-fields';
import { scanDocument } from '@/lib/browser-scanner';
import { expandHistoryFiles } from '@/lib/history-archive';
import { batchIdentityWarnings, type ScanProposal } from '@/lib/scan-content';
import { importScannedDocument } from '@/app/secure/import/actions';
type Item = {
  id: string;
  file: File;
  status: 'waiting' | 'scanning' | 'review' | 'saved' | 'failed';
  proposal?: ScanProposal;
  message?: string;
  versionId?: string;
};
function OriginalSource({ file }: { file: File }) {
  const anchor = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    if (anchor.current) anchor.current.href = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return (
    <a ref={anchor} target="_blank" rel="noopener noreferrer">
      Open original for comparison
    </a>
  );
}
export function ScanWorkspace({ compact = false }: { compact?: boolean }) {
  const [items, setItems] = useState<Item[]>([]),
    [selected, setSelected] = useState<string | null>(null),
    [progress, setProgress] = useState(''),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(''),
    [batchConfirmed, setBatchConfirmed] = useState(false),
    [dragging, setDragging] = useState(false);
  const controller = useRef<AbortController | null>(null),
    lock = useRef(false);
  useEffect(
    () => () => {
      controller.current?.abort();
    },
    [],
  );
  const current = items.find((i) => i.id === selected),
    saved = items.filter((i) => i.status === 'saved').length;
  const identityWarnings = batchIdentityWarnings(
    items.flatMap((i) => (i.proposal ? [i.proposal] : [])),
  );
  const patch = (id: string, change: Partial<Item>) =>
    setItems((old) => old.map((i) => (i.id === id ? { ...i, ...change } : i)));
  async function loadFiles(files: File[]) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setNotice('Unpacking history on this device…');
    try {
      const reports = await expandHistoryFiles(files);
      const next = reports.map((file) => ({
        id: crypto.randomUUID(),
        file,
        status: 'waiting' as const,
      }));
      setItems(next);
      setSelected(next[0]?.id ?? null);
      setBatchConfirmed(false);
      setNotice('');
      lock.current = false;
      await scanAll(next);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not read this history pack.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function publishBatch() {
    if (lock.current || !batchConfirmed || identityWarnings.length) return;
    lock.current = true;
    setBusy(true);
    setNotice('');
    try {
      let completed = items.filter((i) => i.status === 'saved').length;
      for (const item of items.filter((i) => i.status === 'review' && i.proposal)) {
        const proposal = item.proposal!;
        if (!proposal.date || !proposal.facility) {
          setNotice('Review missing dates or facilities individually before adding this report.');
          setSelected(item.id);
          continue;
        }
        setProgress('Adding reviewed source: ' + item.file.name);
        const form = new FormData();
        form.set('file', item.file);
        form.set('title', proposal.title);
        form.set('facility', proposal.facility);
        form.set('kind', proposal.kind);
        form.set('date', proposal.date);
        form.set('content', JSON.stringify(proposal.content));
        form.set('confirmed', 'yes');
        const result = await importScannedDocument(form);
        if (result.ok) {
          completed++;
          patch(item.id, { status: 'saved', versionId: result.versionId });
          window.dispatchEvent(new Event('jeevangraph:records-updated'));
        } else {
          setNotice(result.message);
          break;
        }
      }
      if (completed === items.length)
        window.dispatchEvent(new Event('jeevangraph:import-complete'));
    } finally {
      lock.current = false;
      setBusy(false);
      setProgress('');
    }
  }
  async function scanAll(batch = items) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setNotice('');
    const run = new AbortController();
    controller.current = run;
    const timeout = setTimeout(() => run.abort(), 180000);
    try {
      let firstReady: string | null = null;
      for (const item of batch.filter((i) => ['waiting', 'failed'].includes(i.status))) {
        if (run.signal.aborted) break;
        patch(item.id, { status: 'scanning', message: undefined });
        setSelected(item.id);
        try {
          const proposal = await scanDocument(item.file, setProgress, run.signal);
          patch(item.id, { status: 'review', proposal });
          firstReady ??= item.id;
        } catch {
          patch(item.id, {
            status: 'failed',
            message:
              'Could not read this file. Try a clearer printed scan or use manual upload in Private records.',
          });
        }
      }
      if (firstReady) setSelected(firstReady);
    } finally {
      clearTimeout(timeout);
      lock.current = false;
      setBusy(false);
      setProgress('');
    }
  }
  return (
    <>
      {!compact && (
        <section className="scan-intro">
          <div>
            <ScanLine size={30} />
            <h1>Bring your history to life</h1>
            <p>
              Drop a history ZIP. Review its suggested fields. Watch your private history connect.
            </p>
            <p className="scan-fine">
              Printed-English scanning runs on this device. Files are saved privately only when you
              confirm a report. No report is sent to a cloud AI service.
            </p>
          </div>
          <div className="scan-steps">
            <span>1 · Scan</span>
            <ArrowRight size={16} />
            <span>2 · Review</span>
            <ArrowRight size={16} />
            <span>3 · Explore</span>
          </div>
        </section>
      )}
      <section
        className={`panel scan-picker ${dragging ? 'is-dragging' : ''}`}
        aria-label="Drop your history ZIP or reports"
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!busy) void loadFiles(Array.from(e.dataTransfer.files));
        }}
      >
        <UploadCloud size={30} />
        <a className="button secondary" href="/demo/JeevanGraph_Demo_History.zip" download>
          Download fictional demo history ZIP
        </a>
        <label htmlFor="scan-files">Drop your history ZIP here, or choose reports</label>
        <p>
          ZIP up to 10 MB. Up to 8 reports, 4 MB and 6 pages each, 20 MB unpacked total. PDF, PNG or
          JPEG. Synthetic documents only.
        </p>
        <input
          id="scan-files"
          type="file"
          multiple
          accept=".zip,application/zip,application/pdf,image/png,image/jpeg"
          disabled={busy}
          onChange={(e) => void loadFiles(Array.from(e.currentTarget.files ?? []))}
        />
        <button
          className="button primary"
          disabled={!items.some((i) => ['waiting', 'failed'].includes(i.status)) || busy}
          onClick={() => void scanAll()}
        >
          {busy ? 'Processing history…' : 'Scan selected files'}
        </button>
        {busy && items.some((i) => i.status === 'scanning') && (
          <button className="button secondary" onClick={() => controller.current?.abort()}>
            Cancel scan
          </button>
        )}
        <p role="status">{progress || notice}</p>
      </section>
      {!busy && items.some((i) => i.status === 'review') && (
        <section className="panel scan-batch-review">
          <h2>Text extraction complete. Your review is next.</h2>
          {identityWarnings.map((w) => (
            <p role="alert" key={w}>
              {w}
            </p>
          ))}
          <p>
            {items.filter((i) => i.status === 'review').length} reports are ready. Extracted
            numbers, dates and units are suggestions, not clinical verification. Expand any report
            below to correct it.
          </p>
          <label className="assessment-choice">
            <input
              type="checkbox"
              checked={batchConfirmed}
              onChange={(e) => setBatchConfirmed(e.target.checked)}
            />
            I reviewed this fictional history pack and its source dates, patient identity and
            measurements. Add the extracted reports to my account.
          </label>
          <button
            className="button primary"
            disabled={!batchConfirmed || busy || identityWarnings.length > 0}
            onClick={() => void publishBatch()}
          >
            Confirm reviewed pack &amp; build my history
          </button>
          <p>
            Prefer individual edits? Select a report in the tray and use its review form. Retry adds
            only unsaved reports.
          </p>
        </section>
      )}
      {!!items.length && saved === items.length && (
        <section className="panel scan-complete">
          <CheckCircle2 size={32} />
          <h2>Your history is connected</h2>
          <p>
            {saved} reviewed reports are saved privately. Explore the timeline, source-linked
            answers and 3D HealthGraph.
          </p>
          <Link className="button primary" href="/secure/intelligence">
            Open my living dashboard
          </Link>
          <Link className="button secondary" href="/secure/chat">
            Chat with my history
          </Link>
        </section>
      )}
      {!!items.length && (
        <div className="scan-layout">
          <aside className="scan-queue panel">
            <h2>Your import tray</h2>
            {items.map((item) => (
              <button
                className={`scan-queue-item ${selected === item.id ? 'selected' : ''}`}
                key={item.id}
                disabled={busy && item.status === 'scanning'}
                onClick={() => setSelected(item.id)}
                aria-pressed={selected === item.id}
              >
                {item.status === 'saved' ? <CheckCircle2 size={18} /> : <FileText size={18} />}
                <span>
                  {item.file.name}
                  <small>{item.status === 'review' ? 'Ready for your review' : item.status}</small>
                </span>
              </button>
            ))}
            <p>
              {saved} of {items.length} added to history
            </p>
            <Link href="/secure/intelligence" className="button secondary">
              Open my HealthGraph
            </Link>
            <Link href="/secure/chat" className="button secondary">
              Ask my history
            </Link>
          </aside>
          <section className="panel scan-review" aria-label="Selected report review">
            {!current ? (
              <p>Select a report.</p>
            ) : current.status === 'saved' ? (
              <>
                <CheckCircle2 size={32} />
                <h2>Added to your history</h2>
                <p>{current.file.name}</p>
                <p>The dashboard and source-linked assistant now include this reviewed report.</p>
                <Link href="/secure/intelligence" className="button primary">
                  See my dashboard
                </Link>
              </>
            ) : current.proposal ? (
              <form
                key={current.id}
                action={async (form) => {
                  if (lock.current) return;
                  lock.current = true;
                  setBusy(true);
                  form.set('file', current.file);
                  try {
                    const result = await importScannedDocument(form);
                    if (result.ok) {
                      window.dispatchEvent(new Event('jeevangraph:records-updated'));
                      patch(current.id, {
                        status: 'saved',
                        versionId: result.versionId,
                        message: result.message,
                      });
                    } else setNotice(result.message);
                  } finally {
                    lock.current = false;
                    setBusy(false);
                  }
                }}
              >
                <h2>Review before adding</h2>
                <p>{current.file.name}</p>
                <OriginalSource file={current.file} />
                <ul className="scan-warnings">
                  {current.proposal.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
                <div className="scan-meta">
                  <label>
                    Report title
                    <input
                      name="title"
                      onChange={(e) => {
                        patch(current.id, {
                          proposal: { ...current.proposal!, title: e.target.value },
                        });
                        setBatchConfirmed(false);
                      }}
                      defaultValue={current.proposal.title}
                      required
                      maxLength={160}
                    />
                  </label>
                  <label>
                    Facility
                    <input
                      name="facility"
                      onChange={(e) => {
                        patch(current.id, {
                          proposal: { ...current.proposal!, facility: e.target.value },
                        });
                        setBatchConfirmed(false);
                      }}
                      defaultValue={current.proposal.facility}
                      required
                      maxLength={160}
                    />
                  </label>
                  <label>
                    Report date
                    <input
                      type="date"
                      name="date"
                      defaultValue={current.proposal.date}
                      onChange={(e) => {
                        patch(current.id, {
                          proposal: { ...current.proposal!, date: e.target.value },
                        });
                        setBatchConfirmed(false);
                      }}
                    />
                  </label>
                  <label>
                    Record type
                    <select
                      name="kind"
                      defaultValue={current.proposal.kind}
                      onChange={(e) => {
                        patch(current.id, {
                          proposal: {
                            ...current.proposal!,
                            kind: e.target.value as ScanProposal['kind'],
                          },
                        });
                        setBatchConfirmed(false);
                      }}
                    >
                      {[
                        'lab_report',
                        'prescription',
                        'imaging_report',
                        'immunization',
                        'other',
                      ].map((v) => (
                        <option key={v} value={v}>
                          {v.replaceAll('_', ' ')}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <details>
                  <summary>Read extracted source pages</summary>
                  {current.proposal.pages.map((page) => (
                    <article key={page.page}>
                      <h3>
                        Page {page.page} · {page.method === 'pdf_text' ? 'PDF text' : 'Local OCR'}
                        {page.confidence !== null ? ` · engine confidence ${page.confidence}%` : ''}
                      </h3>
                      <pre className="scan-source">{page.text}</pre>
                    </article>
                  ))}
                </details>
                <ReviewFields
                  initial={current.proposal.content}
                  onContentChange={(content) => {
                    patch(current.id, { proposal: { ...current.proposal!, content } });
                    setBatchConfirmed(false);
                  }}
                />
                <label className="assessment-choice">
                  <input type="checkbox" name="confirmed" value="yes" required />I checked the
                  original, patient identity, date, numbers and units. Add this synthetic report to
                  my account.
                </label>
                <button className="button primary" disabled={busy}>
                  Confirm and add to my history
                </button>
                {notice && <p role="alert">{notice}</p>}
              </form>
            ) : (
              <>
                <h2>{current.status === 'scanning' ? 'Reading this report…' : 'Ready to scan'}</h2>
                <p>
                  {current.message ??
                    'Select Scan selected files to extract text and suggest fields. You can also use manual upload if scanning is unavailable.'}
                </p>
                <Link href="/secure">Open manual upload</Link>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
