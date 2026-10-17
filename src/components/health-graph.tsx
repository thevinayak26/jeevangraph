'use client';
import dynamic from 'next/dynamic';
import { Component, useState, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import type { GraphNode, GraphLink } from '@/lib/evidence';
const ThreeGraph = dynamic(() => import('./health-graph-3d'), {
  ssr: false,
  loading: () => <p>Loading the 3D viewer. The evidence list remains available below.</p>,
});
function subscribeMotion(change: () => void) {
  const q = matchMedia('(prefers-reduced-motion: reduce)');
  q.addEventListener('change', change);
  return () => q.removeEventListener('change', change);
}
function motionSnapshot() {
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}
class GraphBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <p role="status">3D is unavailable on this device. Use the 2D view or evidence list.</p>
    ) : (
      this.props.children
    );
  }
}
export function HealthGraph({ graph }: { graph: { nodes: GraphNode[]; links: GraphLink[] } }) {
  const reduced = useSyncExternalStore(subscribeMotion, motionSnapshot, () => true);
  const [mode, setMode] = useState<'2d' | '3d' | 'list'>('2d');
  const [selection, setSelection] = useState<string | null>(null);
  const effective = reduced ? 'list' : mode;
  const graphNodes = useMemo(
    () => graph.nodes.slice(0, effective === '3d' ? 120 : 60),
    [graph.nodes, effective],
  );
  const graphLinks = useMemo(() => {
    const ids = new Set(graphNodes.map((n) => n.id));
    return graph.links.filter((l) => ids.has(l.source) && ids.has(l.target));
  }, [graph.links, graphNodes]);
  const selected = graph.nodes.find((n) => n.id === selection);
  const layout = useMemo(() => {
    const counts = [0, 0, 0];
    const positions = new Map<string, { x: number; y: number }>();
    for (const n of graphNodes) {
      const column = n.kind === 'person' ? 0 : ['record', 'relative'].includes(n.kind) ? 1 : 2;
      positions.set(n.id, { x: 110 + column * 350, y: 65 + counts[column]++ * 90 });
    }
    return { positions, height: Math.max(300, ...counts.map((n) => n * 90 + 50)) };
  }, [graphNodes]);
  return (
    <section className="panel phase3-graph">
      <div className="phase3-section-heading">
        <div>
          <h2>HealthGraph</h2>
          <p>Explore connections between authorized records, facilities and your family context.</p>
        </div>
        <div className="phase3-tabs" role="group" aria-label="Evidence graph view">
          {(['2d', '3d', 'list'] as const).map((m) => (
            <button
              key={m}
              className={`button ${effective === m ? 'primary' : 'secondary'}`}
              disabled={reduced && m !== 'list'}
              onClick={() => setMode(m)}
              aria-pressed={effective === m}
            >
              {m === 'list' ? 'Evidence list' : m.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <ul className="phase3-graph-legend" aria-label="Graph node colors">
        {[
          ['person', 'Patient'],
          ['record', 'Report'],
          ['facility', 'Facility'],
          ['relative', 'Relative'],
          ['family', 'Family context'],
        ].map(([kind, label]) => (
          <li key={kind}>
            <span className={`legend-${kind}`} aria-hidden="true" />
            {label}
          </li>
        ))}
      </ul>
      {effective === '3d' && (
        <p>
          Drag to rotate, scroll to zoom, and select a node for its evidence. Abbreviated labels
          have full names in the evidence list.
        </p>
      )}
      {reduced && <p>Reduced motion is enabled. The accessible evidence list is shown.</p>}
      {effective !== 'list' && graphNodes.length < graph.nodes.length && (
        <p>
          Showing {graphNodes.length} connections in this view. The complete authorized list is
          below.
        </p>
      )}
      {!graph.nodes.length ? (
        <p>
          No authorized evidence to display. Add a reviewed report or explicitly shared family
          context.
        </p>
      ) : effective === '3d' ? (
        <GraphBoundary>
          <ThreeGraph nodes={graphNodes} links={graphLinks} onSelect={setSelection} />
        </GraphBoundary>
      ) : effective === '2d' ? (
        <div className="graph2d-stage">
          <svg
            viewBox={`0 0 960 ${layout.height}`}
            role="img"
            aria-label="2D map of authorized evidence. Each node can be selected; an equivalent list follows."
          >
            {graphLinks.map((l, i) => {
              const a = layout.positions.get(l.source)!,
                b = layout.positions.get(l.target)!;
              return (
                <line
                  key={i}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="#a7c2bb"
                  strokeWidth={2}
                  strokeDasharray={l.basis && l.basis !== 'biological' ? '6 5' : undefined}
                />
              );
            })}
            {graphNodes.map((n) => {
              const p = layout.positions.get(n.id)!;
              return (
                <g
                  key={n.id}
                  transform={`translate(${p.x},${p.y})`}
                  role="button"
                  tabIndex={0}
                  aria-label={`${n.kind}: ${n.label}`}
                  onClick={() => setSelection(n.id)}
                  onKeyDown={(e) => {
                    if (['Enter', ' '].includes(e.key)) {
                      e.preventDefault();
                      setSelection(n.id);
                    }
                  }}
                >
                  <title>{n.label}</title>
                  <circle r={n.kind === 'person' ? 23 : 17} className={`graph-node-${n.kind}`} />
                  <text y={38} textAnchor="middle">
                    {n.label.length > 30 ? n.label.slice(0, 27) + '…' : n.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      ) : null}
      {selected && (
        <aside className="phase3-source" aria-live="polite">
          <h3>{selected.label}</h3>
          <p>{selected.detail}</p>
          {selected.versionId && selected.sourceAvailable && (
            <a href={`/api/private-source/${encodeURIComponent(selected.versionId)}`}>
              Open original source
            </a>
          )}
          <button className="button secondary" onClick={() => setSelection(null)}>
            Close detail
          </button>
        </aside>
      )}
      <details open={effective === 'list'}>
        <summary>Accessible evidence list ({graph.nodes.length})</summary>
        <ul className="phase3-evidence-list">
          {graph.nodes.map((n) => (
            <li key={n.id}>
              <button onClick={() => setSelection(n.id)}>{n.label}</button>
              <span>{n.kind.replaceAll('_', ' ')}</span>
            </li>
          ))}
        </ul>
      </details>
      <p className="phase3-notice">
        Family history is not genetic proof. Dashed relationship lines distinguish non-biological or
        unknown relationships. No hidden relative reports are inferred or loaded.
      </p>
    </section>
  );
}
