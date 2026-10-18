'use client';

import Link from 'next/link';
import { useState, useRef, useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileImage,
  FilePlus2,
  FileText,
  FolderOpen,
  History,
  LayoutDashboard,
  Link2,
  LockKeyhole,
  Menu,
  Moon,
  Network,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  ShieldOff,
  Stethoscope,
  Sun,
  Upload,
  Users,
  X,
} from 'lucide-react';
import {
  formatRecordDate,
  getKidneySeries,
  searchRecords,
  type FamilyContext,
  type HealthRecord,
  type Role,
  type Section,
  type WorkspaceData,
} from '@/lib/domain';
import { TrendChart } from './trend-chart';
import { RecordDialog } from './record-dialog';

const roleLabels: Record<Role, string> = {
  patient: 'Patient',
  doctor: 'Doctor',
  facility: 'Facility admin',
  platform: 'Platform admin',
};
const nav = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'timeline', label: 'Health timeline', icon: History },
  { id: 'records', label: 'My records', icon: FolderOpen },
  { id: 'graph', label: 'HealthGraph', icon: Network },
  { id: 'family', label: 'Family history', icon: Users },
  { id: 'sharing', label: 'Sharing & consent', icon: ShieldCheck },
] as const;
const kindLabels: Record<string, string> = {
  lab_report: 'Lab report',
  prescription: 'Prescription',
  imaging_report: 'Imaging report',
  immunization: 'Immunization',
  birth_record: 'Birth record',
  encounter_note: 'Visit note',
};
const facilityColors: Record<string, string> = { ORG_A: 'teal', ORG_B: 'blue', ORG_C: 'violet' };
const prettyFacility = (name: string) => name.replace(' Demo ', ' ');

function Tag({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) {
  return <span className={`tag ${tone}`}>{children}</span>;
}
function SectionTitle({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-title">
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}
function SmallArrowLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link className="text-link" href={href}>
      {children}
      <ArrowRight size={15} />
    </Link>
  );
}

export function Workspace({ data, section }: { data: WorkspaceData; section: Section }) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [period, setPeriod] = useState('2026');
  const [kind, setKind] = useState('all');
  const [metric, setMetric] = useState<'creatinine' | 'egfr'>('creatinine');
  const [selected, setSelected] = useState<HealthRecord | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const isPatient = data.role === 'patient';
  const visibleRecords = searchRecords(
    data.records,
    query,
    kind,
    section === 'overview' || section === 'timeline' ? period : 'all',
  );
  const openRecord = (id: string) => setSelected(data.records.find((r) => r.id === id) ?? null);
  const base = `/${data.role}`;
  const pageLabel = nav.find((n) => n.id === section)?.label ?? 'Settings';
  const switchRole = (value: string) => router.push(`/${value}/overview`);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 6500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      {menuOpen && (
        <button
          className="nav-scrim"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside id="site-navigation" className={`sidebar ${menuOpen ? 'is-open' : ''}`}>
        <Link href={`${base}/overview`} className="brand" aria-label="JeevanGraph overview">
          <span className="brand-mark">
            <Activity size={23} strokeWidth={2.3} />
          </span>
          <span>
            JeevanGraph<span className="brand-dot">.</span>
          </span>
        </Link>
        <div className="workspace-label">Your health workspace</div>
        <Link href="/account" className="nav-item">
          Sign in to private records
        </Link>
        <nav aria-label="Main navigation">
          {(isPatient ? nav : nav.filter((n) => n.id === 'overview')).map((item) => (
            <Link
              key={item.id}
              href={`${base}/${item.id}`}
              className={`nav-item ${section === item.id ? 'active' : ''}`}
              onClick={() => setMenuOpen(false)}
            >
              <item.icon size={18} />
              <span>{isPatient ? item.label : `${roleLabels[data.role]} overview`}</span>
              {item.id === 'records' && <span className="nav-count">{data.records.length}</span>}
              {item.id === 'graph' && <span className="nav-new">Explore</span>}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-card">
            <span className="privacy-icon">
              <ShieldCheck size={20} />
            </span>
            <h3>
              Your history.
              <br />
              Your choice.
            </h3>
            <p>Decide what you share and who you share it with.</p>
            <Link href={isPatient ? '/patient/sharing' : '/doctor/overview'}>
              Explore sharing <ArrowUpRight size={14} />
            </Link>
          </div>
          <Link
            href={`${base}/settings`}
            className={`nav-item ${section === 'settings' ? 'active' : ''}`}
          >
            <Settings2 size={18} />
            <span>Settings</span>
          </Link>
          <button
            className="nav-item help-button"
            onClick={() =>
              setNotice(
                'This is a synthetic product preview. Records, people and facilities are fictional.',
              )
            }
          >
            <CircleHelp size={18} />
            <span>Help & information</span>
          </button>
          <div className="sidebar-user">
            <div className="avatar small">
              {isPatient ? 'AS' : data.role === 'doctor' ? 'MR' : 'JG'}
            </div>
            <div>
              <strong>
                {isPatient
                  ? 'Aarav Sen'
                  : data.role === 'doctor'
                    ? 'Dr Mira Rao'
                    : roleLabels[data.role]}
              </strong>
              <span>{isPatient ? 'Personal workspace' : 'Operations preview'}</span>
            </div>
            <ChevronDown size={14} />
          </div>
        </div>
      </aside>

      <div className="workspace-main">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              aria-expanded={menuOpen}
              aria-controls="site-navigation"
              onClick={() => setMenuOpen(true)}
            >
              <Menu size={22} />
            </button>
            <span className="breadcrumb">
              <span className="breadcrumb-root">Workspace</span>
              <ChevronRight size={13} />
              <strong>{pageLabel}</strong>
            </span>
          </div>
          <div className="topbar-right">
            <span className="preview-pill">
              <span /> Synthetic preview
            </span>
            <div className="role-select">
              <label className="sr-only" htmlFor="workspace-role">
                Preview role
              </label>
              <select
                id="workspace-role"
                value={data.role}
                onChange={(e) => switchRole(e.target.value)}
              >
                {Object.entries(roleLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label} preview
                  </option>
                ))}
              </select>
              <ChevronDown size={13} />
            </div>
            <button
              className="icon-button theme-toggle"
              aria-label="Toggle light and dark theme"
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            >
              <Sun size={18} className="theme-sun" />
              <Moon size={18} className="theme-moon" />
            </button>
            <button
              className="icon-button notification-button"
              aria-label="Notifications"
              onClick={() => setNotice('You have no new notifications in this preview.')}
            >
              <Bell size={18} />
            </button>
            <div className="avatar header-avatar">{isPatient ? 'AS' : 'JG'}</div>
          </div>
        </header>
        <div className="prototype-strip">
          <ShieldCheck size={13} />
          <span>
            Fictional data only. Role previews do not sign in to an account or grant medical access.
          </span>
          <span className="strip-label">Not for clinical use</span>
        </div>
        <main id="main-content" className="page-content">
          {section === 'settings' ? (
            <SettingsView />
          ) : !isPatient ? (
            <OperationsView data={data} onNotice={setNotice} />
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <div className="greeting">
                    <span className="tiny-line" />
                    {section === 'overview'
                      ? 'A clearer picture of your health'
                      : 'Your connected health history'}
                  </div>
                  <h1>
                    {section === 'overview' ? (
                      <>
                        Your health, <span>in perspective.</span>
                      </>
                    ) : (
                      pageLabel
                    )}
                  </h1>
                  <p>
                    {section === 'overview'
                      ? 'One place for your records, your story, and the people you trust.'
                      : descriptions[section]}
                  </p>
                </div>
                <button className="button primary" onClick={() => setUploadOpen(true)}>
                  <Plus size={17} /> Add a record
                </button>
              </div>
              {section === 'overview' && (
                <>
                  <div className="patient-strip">
                    <div className="patient-identity">
                      <div className="avatar patient-avatar">AS</div>
                      <div>
                        <h2>
                          Aarav Sen <Tag tone="teal">Personal record</Tag>
                        </h2>
                        <p>
                          {data.patient?.demoId} <span /> Born 14 Feb 1988
                        </p>
                      </div>
                    </div>
                    <div className="patient-strip-right">
                      <span>
                        <Building2 size={15} />3 care facilities
                      </span>
                      <span className="divider" />
                      <span>
                        <CalendarDays size={15} />
                        1988 to present
                      </span>
                    </div>
                  </div>
                  <div className="stats-grid">
                    <Stat
                      icon={<FolderOpen size={19} />}
                      value={data.records.length}
                      label="Health records"
                      detail="Across your lifetime"
                      tone="teal"
                    />
                    <Stat
                      icon={<Activity size={19} />}
                      value="4"
                      label="Lab reports"
                      detail="Ready to compare"
                      tone="blue"
                    />
                    <Stat
                      icon={<Users size={19} />}
                      value={data.family.filter((f) => f.condition).length}
                      label="Family history entries"
                      detail="Patient-reported context"
                      tone="violet"
                    />
                    <Stat
                      icon={<ShieldCheck size={19} />}
                      value="0"
                      label="Active shares"
                      detail="You control access"
                      tone="orange"
                    />
                  </div>
                  <div className="overview-grid">
                    <div className="overview-primary">
                      <section className="panel trend-panel">
                        <SectionTitle
                          title="A view over time"
                          description="Kidney-related measurements, connected across visits."
                          action={
                            <select
                              className="compact-select"
                              aria-label="Chart year"
                              value={period}
                              onChange={(e) => setPeriod(e.target.value)}
                            >
                              <option value="2026">2026</option>
                              <option value="all">All time</option>
                            </select>
                          }
                        />
                        <div className="metric-selector">
                          <div className="segmented-control">
                            <button
                              className={metric === 'creatinine' ? 'selected' : ''}
                              onClick={() => setMetric('creatinine')}
                            >
                              Creatinine
                            </button>
                            <button
                              className={metric === 'egfr' ? 'selected' : ''}
                              onClick={() => setMetric('egfr')}
                            >
                              Reported eGFR
                            </button>
                          </div>
                          <span className="source-count">
                            <Link2 size={13} />4 source reports
                          </span>
                        </div>
                        <div className="chart-summary">
                          <div>
                            <span className="chart-value">
                              {metric === 'creatinine' ? '1.60' : '57'}
                              <small>{metric === 'creatinine' ? 'mg/dL' : 'mL/min/1.73m²'}</small>
                            </span>
                            <p>Latest reported · 9 Sep 2026</p>
                          </div>
                          <Tag tone="orange">
                            <BookOpen size={12} /> Review with clinician
                          </Tag>
                        </div>
                        <TrendChart records={data.records} metric={metric} onSelect={openRecord} />
                        <div className="chart-source-legend">
                          {data.facilities.map((f, i) => (
                            <span key={f.id}>
                              <i className={`dot ${['teal', 'blue', 'violet'][i]}`} />
                              {prettyFacility(f.name)
                                .replace(' Hospital', '')
                                .replace(' Diagnostics', '')}
                            </span>
                          ))}
                        </div>
                        <p className="chart-footnote">
                          Measurements are shown as reported. Laboratory methods may differ.
                        </p>
                        <details className="chart-data">
                          <summary>
                            View values and source reports <ChevronDown size={14} />
                          </summary>
                          <MeasurementTable records={data.records} onSelect={openRecord} />
                        </details>
                      </section>
                      <section className="panel timeline-panel">
                        <SectionTitle
                          title="Recent care, connected"
                          description="Every report has a place in your story."
                          action={
                            <SmallArrowLink href="/patient/timeline">Full timeline</SmallArrowLink>
                          }
                        />
                        <Timeline records={data.records.slice(0, 4)} onSelect={openRecord} />
                      </section>
                    </div>
                    <div className="overview-secondary">
                      <section className="graph-teaser">
                        <div className="teaser-heading">
                          <span>
                            <Network size={17} /> HealthGraph
                          </span>
                          <span className="live-label">Evidence map</span>
                        </div>
                        <MiniGraph />
                        <h2>See the connections.</h2>
                        <p>Explore how your visits, reports, and measurements fit together.</p>
                        <Link href="/patient/graph" className="graph-link">
                          Explore your HealthGraph <ArrowUpRight size={16} />
                        </Link>
                      </section>
                      <section className="panel family-preview">
                        <SectionTitle
                          title="Your family context"
                          action={
                            <span className="soft-icon violet">
                              <Users size={17} />
                            </span>
                          }
                        />
                        <p className="card-intro">A shared history. Individual choices.</p>
                        <div className="family-avatar-row">
                          <span className="mini-avatar lavender">M</span>
                          <span className="mini-avatar blue">F</span>
                          <span className="mini-avatar peach">G</span>
                          <span className="family-count">+3 relationships</span>
                        </div>
                        <div className="family-preview-item">
                          <div>
                            <strong>Biological mother</strong>
                            <span>Breast cancer · reported at 44</span>
                          </div>
                          <Tag>First degree</Tag>
                        </div>
                        <div className="family-preview-item">
                          <div>
                            <strong>Biological father</strong>
                            <span>Type 2 diabetes · reported at 48</span>
                          </div>
                          <Tag>First degree</Tag>
                        </div>
                        <p className="context-note">
                          Family history is context, not genetic proof.
                        </p>
                        <SmallArrowLink href="/patient/family">View family history</SmallArrowLink>
                      </section>
                      <section className="sharing-note">
                        <span className="soft-icon teal">
                          <LockKeyhole size={18} />
                        </span>
                        <div>
                          <h3>Sharing starts with you.</h3>
                          <p>No records are being shared in this preview.</p>
                          <Link href="/patient/sharing">
                            Review sharing <ArrowRight size={13} />
                          </Link>
                        </div>
                      </section>
                    </div>
                  </div>
                </>
              )}
              {section === 'timeline' && (
                <>
                  <Filters
                    query={query}
                    onQuery={setQuery}
                    kind={kind}
                    onKind={setKind}
                    period={period}
                    onPeriod={setPeriod}
                  />
                  <section className="panel full-timeline">
                    <SectionTitle
                      title="Your health timeline"
                      description={`${visibleRecords.length} documented ${visibleRecords.length === 1 ? 'event' : 'events'} · missing periods do not mean care did not happen.`}
                    />
                    <Timeline records={visibleRecords} onSelect={openRecord} showYear />
                  </section>
                </>
              )}
              {section === 'records' && (
                <>
                  <Filters query={query} onQuery={setQuery} kind={kind} onKind={setKind} />
                  <div className="library-summary">
                    <span>
                      {visibleRecords.length} {visibleRecords.length === 1 ? 'record' : 'records'}
                    </span>
                    <span>
                      <ShieldCheck size={14} />
                      Fictional specimens with source details
                    </span>
                  </div>
                  <div className="record-grid">
                    {visibleRecords.map((record) => (
                      <button
                        className="record-card"
                        key={record.id}
                        onClick={() => setSelected(record)}
                      >
                        <div className="record-card-top">
                          <span
                            className={`file-icon ${record.kind === 'imaging_report' ? 'violet' : ''}`}
                          >
                            {record.kind === 'imaging_report' ? (
                              <FileImage size={24} />
                            ) : (
                              <FileText size={24} />
                            )}
                          </span>
                          <ArrowUpRight size={17} />
                        </div>
                        <Tag>{kindLabels[record.kind]}</Tag>
                        <h2>{record.title}</h2>
                        <p>{prettyFacility(record.facility)}</p>
                        <div className="record-card-bottom">
                          <span>{formatRecordDate(record)}</span>
                          <ChevronRight size={15} />
                        </div>
                      </button>
                    ))}
                  </div>
                  {visibleRecords.length === 0 && (
                    <Empty
                      title="No matching records"
                      description="Try a different title, facility or document type."
                    />
                  )}
                </>
              )}
              {section === 'family' && <FamilyView family={data.family} onNotice={setNotice} />}
              {section === 'graph' && <GraphView records={data.records} onSelect={openRecord} />}
              {section === 'sharing' && <SharingView onNotice={setNotice} />}
            </>
          )}
          <footer className="page-footer">
            <span>
              <Activity size={12} /> JeevanGraph
            </span>
            <span>Connected history. Considered care.</span>
            <span>Synthetic prototype</span>
          </footer>
        </main>
      </div>
      {selected && (
        <RecordDialog key={selected.id} record={selected} onClose={() => setSelected(null)} />
      )}
      {uploadOpen && <UploadDialog onClose={() => setUploadOpen(false)} />}
      {notice && (
        <div className="toast" role="status">
          <CircleHelp size={18} />
          <p>{notice}</p>
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setNotice('')}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

const descriptions: Record<Section, string> = {
  overview: '',
  timeline: 'From your earliest records to your most recent care.',
  records: 'Original reports and prescriptions, easy to find and revisit.',
  family: 'Understand your family context while respecting every person’s privacy.',
  graph: 'A map of the evidence behind your health history.',
  sharing: 'Specific records. The right people. For as long as you choose.',
  settings: '',
};

function Stat({
  icon,
  value,
  label,
  detail,
  tone,
}: {
  icon: ReactNode;
  value: string | number;
  label: string;
  detail: string;
  tone: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span className={`soft-icon ${tone}`}>{icon}</span>
        <span className="stat-label">{label}</span>
      </div>
      <div className="stat-bottom">
        <strong>{value}</strong>
        <span>{detail}</span>
      </div>
    </div>
  );
}

function Filters({
  query,
  onQuery,
  kind,
  onKind,
  period,
  onPeriod,
}: {
  query: string;
  onQuery: (v: string) => void;
  kind: string;
  onKind: (v: string) => void;
  period?: string;
  onPeriod?: (v: string) => void;
}) {
  return (
    <div className="filters">
      <label className="search-field">
        <Search size={18} />
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search records or facilities"
          aria-label="Search records or facilities"
        />
        {query && (
          <button className="icon-button" aria-label="Clear search" onClick={() => onQuery('')}>
            <X size={14} />
          </button>
        )}
      </label>
      <select value={kind} onChange={(e) => onKind(e.target.value)} aria-label="Document type">
        <option value="all">All document types</option>
        {Object.entries(kindLabels).map(([key, value]) => (
          <option key={key} value={key}>
            {value}
          </option>
        ))}
      </select>
      {onPeriod && (
        <select
          value={period}
          onChange={(e) => onPeriod(e.target.value)}
          aria-label="Timeline period"
        >
          <option value="2026">2026</option>
          <option value="all">All time</option>
          <option value="1988">1988</option>
          <option value="1994">1994</option>
        </select>
      )}
    </div>
  );
}

function Timeline({
  records,
  onSelect,
  showYear = false,
}: {
  records: HealthRecord[];
  onSelect: (id: string) => void;
  showYear?: boolean;
}) {
  if (!records.length)
    return (
      <Empty title="No events in this view" description="Choose another period or document type." />
    );
  return (
    <div className="timeline-list">
      {records.map((record, i) => (
        <div className="timeline-row" key={record.id}>
          <div className="timeline-date">
            <strong>
              {record.clinicalDate
                ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', timeZone: 'UTC' }).format(
                    new Date(record.clinicalDate + 'T12:00:00Z'),
                  )
                : '?'}
            </strong>
            <span>
              {record.clinicalDate
                ? new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' }).format(
                    new Date(record.clinicalDate + 'T12:00:00Z'),
                  )
                : record.clinicalYear}
              {showYear && record.clinicalDate ? ` ${record.clinicalDate.slice(0, 4)}` : ''}
            </span>
          </div>
          <div className="timeline-track">
            <span className={facilityColors[record.facilityAlias]} />
            {i < records.length - 1 && <i />}
          </div>
          <button className="timeline-event" onClick={() => onSelect(record.id)}>
            <div>
              <span className="event-kind">{kindLabels[record.kind]}</span>
              <h3>{record.title}</h3>
              <p>
                <Building2 size={12} />
                {prettyFacility(record.facility)}
              </p>
              {!record.clinicalDate && (
                <span className="date-precision">Exact date unknown; displayed by year only.</span>
              )}
            </div>
            <ChevronRight size={17} />
          </button>
        </div>
      ))}
    </div>
  );
}

function MeasurementTable({
  records,
  onSelect,
}: {
  records: HealthRecord[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className="table-scroll">
      <table className="data-table">
        <caption className="sr-only">
          Source-linked fictional kidney-related laboratory measurements
        </caption>
        <thead>
          <tr>
            <th>Date</th>
            <th>Creatinine</th>
            <th>Reported eGFR</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {getKidneySeries(records).map((p) => (
            <tr key={p.recordId}>
              <td>
                {new Date(p.timestamp).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  timeZone: 'UTC',
                })}
              </td>
              <td>{p.creatinine?.toFixed(2)} mg/dL</td>
              <td>{p.egfr} mL/min/1.73m²</td>
              <td>
                <button className="text-link" onClick={() => onSelect(p.recordId)}>
                  Open report <ArrowUpRight size={13} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MiniGraph() {
  return (
    <svg
      className="mini-graph"
      viewBox="0 0 320 174"
      role="img"
      aria-label="Illustrative links between the patient, source records and laboratory measurements"
    >
      <defs>
        <radialGradient id="graph-glow">
          <stop offset="0" stopColor="#33dbca" stopOpacity=".18" />
          <stop offset="1" stopColor="#33dbca" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="158" cy="92" rx="135" ry="82" fill="url(#graph-glow)" />
      {[
        [62, 52, 154, 88],
        [62, 52, 91, 131],
        [154, 88, 91, 131],
        [154, 88, 220, 39],
        [154, 88, 244, 108],
        [154, 88, 208, 150],
        [220, 39, 276, 59],
        [244, 108, 276, 59],
        [244, 108, 208, 150],
        [91, 131, 38, 112],
        [62, 52, 122, 21],
      ].map((v, i) => (
        <line
          key={i}
          x1={v[0]}
          y1={v[1]}
          x2={v[2]}
          y2={v[3]}
          stroke="#3c7779"
          strokeWidth="1"
          opacity=".65"
        />
      ))}
      {[
        [62, 52, 7, '#a1a6ef'],
        [91, 131, 6, '#6aa6e7'],
        [220, 39, 7, '#40c6ba'],
        [244, 108, 8, '#5ec5ca'],
        [208, 150, 5, '#aaa3dc'],
        [276, 59, 4, '#5faea9'],
        [38, 112, 4, '#4f919d'],
        [122, 21, 4, '#5d9fae'],
      ].map((v, i) => (
        <g key={i}>
          <circle cx={v[0]} cy={v[1]} r={Number(v[2]) + 5} fill={String(v[3])} opacity=".1" />
          <circle cx={v[0]} cy={v[1]} r={v[2]} fill={String(v[3])} />
        </g>
      ))}
      <circle cx="154" cy="88" r="23" fill="#153f47" stroke="#317b7d" />
      <circle cx="154" cy="88" r="16" fill="#187a77" />
      <path
        d="M144 88h6l3-6 4 13 3-7h5"
        stroke="#a5f0e7"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FamilyView({
  family,
  onNotice,
}: {
  family: FamilyContext[];
  onNotice: (v: string) => void;
}) {
  return (
    <>
      <div className="family-explainer">
        <span className="soft-icon violet">
          <Users size={21} />
        </span>
        <div>
          <h2>Connected family. Separate permissions.</h2>
          <p>
            These entries are reported by the patient. A biological relationship is not genetic
            proof, and a family link does not share anyone’s medical records.
          </p>
        </div>
      </div>
      <div className="family-toolbar">
        <span>
          {family.length} relationships · {family.filter((f) => f.condition).length} reported
          history entries
        </span>
        <button
          className="button secondary"
          onClick={() =>
            onNotice(
              'Relative invitations will require a signed-in account and separate approval. No invitation was created or sent.',
            )
          }
        >
          <Plus size={16} />
          Invite a relative
        </button>
      </div>
      <div className="family-grid">
        {family.map((f, i) => (
          <section className="panel family-card" key={f.id}>
            <div className="family-card-top">
              <span className={`mini-avatar ${['lavender', 'blue', 'peach'][i % 3]}`}>
                {f.label[0]}
              </span>
              <Tag tone={f.basis === 'biological' ? 'teal' : 'neutral'}>
                {f.basis === 'biological'
                  ? 'Biological'
                  : f.basis === 'adoptive'
                    ? 'Adoptive'
                    : 'Lineage unknown'}
              </Tag>
            </div>
            <h2>{f.label}</h2>
            <p>
              {f.degree === 'first'
                ? 'First-degree relative'
                : f.degree === 'second'
                  ? 'Second-degree relative'
                  : f.degree === 'not_applicable'
                    ? 'Social family relationship'
                    : 'Biological degree not known'}
            </p>
            <div className="family-condition">
              <span>Patient-reported history</span>
              <strong>{f.condition ?? 'No condition reported'}</strong>
              <p>
                {f.condition
                  ? f.diagnosisAge
                    ? `Reported diagnosis at ${f.agePrecision === 'approximate' ? 'approximately ' : ''}age ${f.diagnosisAge}`
                    : 'Age at diagnosis unknown'
                  : 'Missing information is not evidence of no disease.'}
              </p>
            </div>
            <div className="family-privacy">
              <LockKeyhole size={13} />
              <span>Relative records are not linked or shared</span>
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

function GraphView({
  records,
  onSelect,
}: {
  records: HealthRecord[];
  onSelect: (id: string) => void;
}) {
  const labs = records
    .filter((r) => r.kind === 'lab_report')
    .sort((a, b) => a.clinicalDate!.localeCompare(b.clinicalDate!));
  return (
    <>
      <section className="graph-canvas-panel">
        <div className="graph-canvas-heading">
          <div>
            <h2>Your evidence map</h2>
            <p>Source relationships, not a diagnostic model.</p>
          </div>
          <Tag>2D view</Tag>
        </div>
        <div className="evidence-map">
          <svg viewBox="0 0 900 360" preserveAspectRatio="none" aria-hidden="true">
            <path
              d="M450 180L170 90M450 180L720 75M450 180L160 275M450 180L720 280"
              stroke="#2c636c"
              strokeWidth="1.5"
              fill="none"
            />
          </svg>
          <div className="map-patient">
            <span className="avatar">AS</span>
            <strong>Aarav Sen</strong>
            <span>Patient context</span>
          </div>
          {labs.map((r, i) => (
            <button
              key={r.id}
              className={`map-record map-position-${i}`}
              onClick={() => onSelect(r.id)}
            >
              <span className={`map-record-icon ${facilityColors[r.facilityAlias]}`}>
                <FileText size={18} />
              </span>
              <span>
                <strong>{formatRecordDate(r)}</strong>
                <small>
                  {prettyFacility(r.facility).replace(' Hospital', '').replace(' Diagnostics', '')}
                </small>
                <em>
                  {r.observations.find((o) => o.analyteKey === 'creatinine')?.rawValue} mg/dL
                  creatinine
                </em>
              </span>
              <ArrowUpRight size={14} />
            </button>
          ))}
        </div>
        <div className="graph-legend">
          <span>
            <i className="dot teal" />
            Reviewed source report
          </span>
          <span>
            <i className="dot violet" />
            Patient context
          </span>
          <span>Choose a report to inspect its source</span>
        </div>
      </section>
      <section className="panel graph-source-table">
        <SectionTitle
          title="The evidence behind the connections"
          description="The same four source reports, in an accessible table."
        />
        <MeasurementTable records={records} onSelect={onSelect} />
      </section>
    </>
  );
}

function SharingView({ onNotice }: { onNotice: (v: string) => void }) {
  return (
    <>
      <div className="sharing-principles">
        <div>
          <ShieldCheck size={20} />
          <strong>Specific records</strong>
          <p>Choose exactly what can be seen.</p>
        </div>
        <div>
          <Users size={20} />
          <strong>A named recipient</strong>
          <p>Know who receives access.</p>
        </div>
        <div>
          <Clock3 size={20} />
          <strong>A limited time</strong>
          <p>Set an expiry and revoke access.</p>
        </div>
      </div>
      <section className="panel">
        <SectionTitle title="Active shares" action={<Tag tone="teal">None active</Tag>} />
        <Empty
          icon={<ShieldCheck size={34} />}
          title="Sharing starts with your permission"
          description="There are no active grants in this preview. Connecting accounts and secure storage is required before medical records can be shared."
          action={
            <button
              className="button secondary"
              onClick={() =>
                onNotice(
                  'A real consent grant requires authenticated patient and doctor accounts. No access was granted.',
                )
              }
            >
              <CircleHelp size={15} />
              How sharing works
            </button>
          }
        />
      </section>
      <section className="panel consent-preview">
        <SectionTitle
          title="What you will review before sharing"
          description="A clear consent receipt, not a blanket terms-and-conditions checkbox."
        />
        <div className="consent-preview-grid">
          {[
            ['Recipient', 'Named doctor and facility'],
            ['Purpose', 'Care review'],
            ['Records', 'Exact selected report versions'],
            ['Actions', 'Read and/or analyze'],
            ['Expiry', 'A time you choose'],
            ['Control', 'Revoke future access'],
          ].map(([a, b]) => (
            <div key={a}>
              <span>{a}</span>
              <strong>{b}</strong>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function OperationsView({
  data,
  onNotice,
}: {
  data: WorkspaceData;
  onNotice: (v: string) => void;
}) {
  if (data.role === 'doctor')
    return (
      <>
        <div className="page-heading">
          <div>
            <div className="greeting">
              <Stethoscope size={15} />
              Clinician workspace
            </div>
            <h1>
              Care starts with <span>context.</span>
            </h1>
            <p>Review a patient’s history when they choose to share it with you.</p>
          </div>
          <Tag tone="teal">Dr Mira Rao · Preview</Tag>
        </div>
        <div className="stats-grid three">
          <Stat
            icon={<Users size={18} />}
            value="0"
            label="Authorized patients"
            detail="No active grants"
            tone="teal"
          />
          <Stat
            icon={<Clock3 size={18} />}
            value="0"
            label="Pending requests"
            detail="No requests sent"
            tone="blue"
          />
          <Stat
            icon={<ShieldCheck size={18} />}
            value="0"
            label="Active permissions"
            detail="Patient-controlled scope"
            tone="violet"
          />
        </div>
        <section className="panel doctor-empty">
          <Empty
            icon={<LockKeyhole size={37} />}
            title="No patient history is available"
            description="A patient must approve a named, time-limited request before their records or family context appear here."
            action={
              <button
                className="button primary"
                onClick={() =>
                  onNotice(
                    'Connect clinician and patient accounts before creating a real access request. No request was sent.',
                  )
                }
              >
                <Plus size={16} />
                Request patient access
              </button>
            }
          />
        </section>
        <div className="callout">
          <ShieldCheck size={20} />
          <p>
            A professional role does not grant access to every patient. Family records need
            independent permission.
          </p>
        </div>
      </>
    );
  const platform = data.role === 'platform';
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="greeting">
            <Building2 size={15} />
            {platform ? 'Platform operations' : 'Facility operations'}
          </div>
          <h1>{platform ? 'A connected network.' : 'A clearer delivery flow.'}</h1>
          <p>
            {platform
              ? 'Manage organizations and service readiness without reading patient charts.'
              : 'Manage your facility’s staff and scoped record deliveries.'}
          </p>
        </div>
        <Tag>Operations preview</Tag>
      </div>
      <div className="stats-grid three">
        <Stat
          icon={<Building2 size={18} />}
          value={data.facilities.length}
          label={platform ? 'Demo facilities' : 'Your facility'}
          detail="Synthetic organization data"
          tone="teal"
        />
        <Stat
          icon={<FilePlus2 size={18} />}
          value="0"
          label="Pending deliveries"
          detail="No hospital connection"
          tone="blue"
        />
        <Stat
          icon={<ShieldOff size={18} />}
          value="0"
          label="Clinical grants"
          detail="No default chart access"
          tone="violet"
        />
      </div>
      <section className="panel">
        <SectionTitle
          title={platform ? 'Organizations' : 'Your organization'}
          description="All facilities in this prototype are fictional."
        />
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Organization</th>
                <th>Type</th>
                <th>Status</th>
                <th>Verification</th>
              </tr>
            </thead>
            <tbody>
              {data.facilities.map((f) => (
                <tr key={f.id}>
                  <td>
                    <strong>{f.name}</strong>
                  </td>
                  <td>{f.kind}</td>
                  <td>
                    <Tag tone="teal">{f.status}</Tag>
                  </td>
                  <td>Simulated</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel operational-panel">
        <span className="soft-icon blue">
          <Upload size={23} />
        </span>
        <h2>{platform ? 'Service readiness' : 'Facility ingestion'}</h2>
        <p>
          {platform
            ? 'Account administration, access audit and organization approvals are connected in the secure-data phase.'
            : 'A record delivery will require a patient-issued, single-use authorization. No live hospital integration is configured.'}
        </p>
        <button
          className="button secondary"
          onClick={() =>
            onNotice(
              platform
                ? 'Live organization administration is not connected in this preview. No status changed.'
                : 'The ingestion simulator requires authenticated staff and a patient delivery authorization. No record was delivered.',
            )
          }
        >
          {platform ? 'Review readiness' : 'Inspect delivery workflow'}
          <ArrowRight size={15} />
        </button>
      </section>
    </>
  );
}

function SettingsView() {
  const { setTheme } = useTheme();
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="greeting">Workspace preferences</div>
          <h1>
            Make it <span>yours.</span>
          </h1>
          <p>Appearance and connection status for this prototype.</p>
        </div>
      </div>
      <section className="panel settings-panel">
        <SectionTitle
          title="Appearance"
          description="Choose a comfortable view. Your preference stays on this device."
        />
        <div className="theme-options">
          <button className="button secondary" onClick={() => setTheme('light')}>
            <Sun size={18} />
            Light
          </button>
          <button className="button secondary" onClick={() => setTheme('dark')}>
            <Moon size={18} />
            Dark
          </button>
          <button className="button secondary" onClick={() => setTheme('system')}>
            Use system setting
          </button>
        </div>
      </section>
      <section className="panel settings-panel">
        <SectionTitle title="Connection status" />
        <div className="setting-row">
          <div>
            <strong>Patient data</strong>
            <p>
              Fictional fixtures only. No account authentication or private storage is connected.
            </p>
          </div>
          <Tag>Preview</Tag>
        </div>
        <div className="setting-row">
          <div>
            <strong>Explanations</strong>
            <p>
              Gemini 3.5 Flash-Lite is selected for the later synthetic-only explanation feature. No
              API call is made in this release.
            </p>
          </div>
          <Tag>Not connected</Tag>
        </div>
      </section>
    </>
  );
}

function Empty({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      {icon && <span className="empty-icon">{icon}</span>}
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </div>
  );
}

function UploadDialog({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  function chooseFile(next: File | undefined) {
    setFile(null);
    setError('');
    if (!next) return;
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(next.type)) {
      setError('Choose a PDF, PNG or JPEG file.');
      return;
    }
    if (next.size > 4_000_000) {
      setError('Choose a file no larger than 4 MB.');
      return;
    }
    setFile(next);
  }
  return (
    <dialog
      ref={ref}
      className="upload-dialog"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
      aria-labelledby="upload-title"
    >
      <div className="dialog-head">
        <span className="file-icon">
          <Upload size={23} />
        </span>
        <button
          className="icon-button"
          aria-label="Close upload preview"
          onClick={() => ref.current?.close()}
        >
          <X size={20} />
        </button>
      </div>
      <h2 id="upload-title">Add to your health story</h2>
      <p className="dialog-description">
        Preview file selection. Secure storage is not connected yet.
      </p>
      <label className="upload-zone">
        <FilePlus2 size={30} />
        <strong>{file ? file.name : 'Choose a fictional report'}</strong>
        <span>
          {file
            ? `${(file.size / 1024).toFixed(0)} KB · selected on this device`
            : 'PDF, PNG or JPEG · up to 5 MiB'}
        </span>
        <input
          type="file"
          accept="application/pdf,image/png,image/jpeg"
          onChange={(e) => chooseFile(e.target.files?.[0])}
        />
        <span className="button secondary">{file ? 'Choose another file' : 'Browse files'}</span>
      </label>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <div className="document-notice">
        <LockKeyhole size={15} />
        This preview does not upload, store or extract your file. Use fictional test documents only.
      </div>
      <button className="button primary full-width" onClick={() => ref.current?.close()}>
        <Check size={16} />
        Done
      </button>
    </dialog>
  );
}
