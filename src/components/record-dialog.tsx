'use client';

import { useEffect, useRef } from 'react';
import { FileText, X, ExternalLink, ShieldCheck } from 'lucide-react';
import { formatRecordDate, type HealthRecord } from '@/lib/domain';

export function RecordDialog({ record, onClose }: { record: HealthRecord; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="record-dialog"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) ref.current?.close();
      }}
      aria-labelledby="record-dialog-title"
    >
      <div className="dialog-head">
        <span className="file-icon">
          <FileText size={22} />
        </span>
        <button
          aria-label="Close record"
          className="icon-button"
          onClick={() => ref.current?.close()}
        >
          <X size={20} />
        </button>
      </div>
      <h2 id="record-dialog-title">{record.title}</h2>
      <p className="dialog-description">
        {record.facility} · {formatRecordDate(record)}
      </p>
      <div className="document-notice">
        Fictional test document. Not valid for medical care or dispensing.
      </div>
      <div className="record-detail-meta">
        <span>{record.sourceRecordId}</span>
        <span>
          <ShieldCheck size={14} /> Transcription checked in sample
        </span>
      </div>
      {record.observations.length > 0 && (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Reported test</th>
                <th>Result</th>
                <th>Unit</th>
              </tr>
            </thead>
            <tbody>
              {record.observations.map((o) => (
                <tr key={o.id}>
                  <td>{o.rawLabel}</td>
                  <td className="numeric">{o.rawValue}</td>
                  <td>{o.rawUnit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {record.sections.map((section) => (
        <section className="source-section" key={section.heading}>
          <h3>{section.heading}</h3>
          {section.lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </section>
      ))}
      {record.previewImage && (
        <a
          className="button secondary"
          href={record.previewImage}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open specimen image <ExternalLink size={15} />
        </a>
      )}
      <p className="fineprint">
        A saved report is evidence of what was documented, not proof of a current diagnosis or
        medication use.
      </p>
    </dialog>
  );
}
