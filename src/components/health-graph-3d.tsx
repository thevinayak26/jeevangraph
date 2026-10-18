'use client';
import { useMemo, useRef, useState, useEffect } from 'react';
import ForceGraph3D, { type ForceGraphMethods } from 'react-force-graph-3d';
import SpriteText from 'three-spritetext';
import type { GraphNode, GraphLink } from '@/lib/evidence';
function escapeLabel(text: string) {
  return text.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}
const colors = {
  person: '#126b64',
  record: '#257c9c',
  facility: '#778b95',
  relative: '#ae7445',
  family: '#967296',
};
export default function HealthGraph3D({
  nodes,
  links,
  onSelect,
}: {
  nodes: GraphNode[];
  links: GraphLink[];
  onSelect: (id: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraphMethods<GraphNode, GraphLink> | undefined>(undefined);
  const [width, setWidth] = useState(600);
  const data = useMemo(
    () => ({ nodes: nodes.map((n) => ({ ...n })), links: links.map((l) => ({ ...l })) }),
    [nodes, links],
  );
  useEffect(() => {
    const target = container.current;
    if (!target) return;
    const observer = new ResizeObserver((entries) =>
      setWidth(Math.max(220, Math.floor(entries[0].contentRect.width))),
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);
  function resetView() {
    const graph = graphRef.current;
    if (!graph) return;
    const controls = graph.controls() as { minDistance: number; maxDistance: number };
    controls.minDistance = 180;
    controls.maxDistance = 2000;
    const distance = (300 + Math.sqrt(nodes.length) * 15) * Math.max(1, 500 / width);
    graph.cameraPosition({ x: 0, y: 0, z: distance }, { x: 0, y: 0, z: 0 }, 0);
  }
  return (
    <div
      ref={container}
      className="graph3d-stage"
      role="img"
      aria-label="Interactive 3D evidence graph. Use the accessible evidence list for keyboard navigation."
    >
      <button type="button" className="button secondary graph3d-reset" onClick={resetView}>
        Reset 3D view
      </button>
      <ForceGraph3D
        ref={graphRef}
        graphData={data}
        width={width}
        height={440}
        backgroundColor="#f4f8f7"
        nodeLabel={(n) => escapeLabel(n.label)}
        linkLabel={(l) => escapeLabel(l.label)}
        nodeColor={(n) => colors[n.kind]}
        nodeVal={(n) => (n.kind === 'person' ? 8 : 4)}
        nodeThreeObjectExtend
        nodeThreeObject={(n) => {
          const label = new SpriteText(
            n.label.length > 24 ? n.label.slice(0, 21) + '…' : n.label,
            8,
            '#213338',
          );
          label.backgroundColor = '#f4f8f7';
          label.padding = [1.5, 1];
          label.fontFace = 'Segoe UI, Arial, sans-serif';
          label.position.set(0, 14, 0);
          return label;
        }}
        onEngineStop={resetView}
        linkColor={() => '#8aa8a2'}
        linkWidth={1.2}
        nodeOpacity={0.96}
        cooldownTicks={45}
        showNavInfo={false}
        onNodeClick={(n) => onSelect(n.id)}
        enableNodeDrag={false}
      />
    </div>
  );
}
