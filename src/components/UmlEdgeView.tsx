import { BaseEdge, EdgeLabelRenderer, useInternalNode, type EdgeProps, type InternalNode } from '@xyflow/react'
import { cn } from 'cn'
import { memo, type CSSProperties } from 'react'
import { headShape, midpoint, polylinePath, routeEdge, unit, type Point, type Rect } from '@/lib/geometry'
import { RELATIONS, type UmlEdge } from '@/lib/uml'
import { useEditor } from '@/store'

function rectOf(n: InternalNode): Rect {
  return {
    x: n.internals.positionAbsolute.x,
    y: n.internals.positionAbsolute.y,
    w: n.measured.width ?? 0,
    h: n.measured.height ?? 0,
  }
}

/** Places an end label (multiplicity / role) beside the line, `back` px from the end. */
function endLabelStyle(end: Point, other: Point, back: number): CSSProperties {
  const d = unit(end, other)
  const nx = -d.y
  const ny = d.x
  const x = end.x + d.x * back + nx * 10
  const y = end.y + d.y * back + ny * 10
  const tx = Math.abs(nx) > 0.6 ? (nx > 0 ? '0%' : '-100%') : '-50%'
  const ty = Math.abs(ny) > 0.6 ? (ny > 0 ? '0%' : '-100%') : '-50%'
  return { transform: `translate(${x}px, ${y}px) translate(${tx}, ${ty})` }
}

function selectOnly(id: string) {
  useEditor.setState((s) => ({
    nodes: s.nodes.map((n) => (n.selected ? { ...n, selected: false } : n)),
    edges: s.edges.map((e) => (e.selected === (e.id === id) ? e : { ...e, selected: e.id === id })),
  }))
}

function UmlEdgeViewImpl({ id, source, target, data, selected }: EdgeProps<UmlEdge>) {
  const s = useInternalNode(source)
  const t = useInternalNode(target)
  if (!s || !t || !data) return null

  const rel = RELATIONS[data.relation]
  const pts = routeEdge(rectOf(s), rectOf(t), source === target, data.parallelIndex ?? 0, data.parallelCount ?? 1, source < target)
  const n = pts.length
  const head = headShape(rel.head, pts[n - 1], unit(pts[n - 2], pts[n - 1]))
  const line = head ? [...pts.slice(0, -1), head.lineEnd] : pts
  const mid = midpoint(pts)

  return (
    <>
      <BaseEdge id={id} path={polylinePath(line)} className={cn('uml-edge', rel.dashed && 'is-dashed')} interactionWidth={18} />
      {head && <path d={head.d} className={cn('uml-edge-head', head.filled && 'is-filled', !head.closed && 'is-open')} />}
      <EdgeLabelRenderer>
        {data.label && (
          <div
            className={cn('uml-edge-label is-center nodrag nopan', selected && 'is-selected')}
            style={{ transform: `translate(${mid.x}px, ${mid.y}px) translate(-50%, -50%)` }}
            onClick={() => selectOnly(id)}
          >
            {data.label}
          </div>
        )}
        {data.sourceLabel && (
          <div className={cn('uml-edge-label', selected && 'is-selected')} style={endLabelStyle(pts[0], pts[1], 14)}>
            {data.sourceLabel}
          </div>
        )}
        {data.targetLabel && (
          <div className={cn('uml-edge-label', selected && 'is-selected')} style={endLabelStyle(pts[n - 1], pts[n - 2], head ? 26 : 14)}>
            {data.targetLabel}
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  )
}

export const UmlEdgeView = memo(UmlEdgeViewImpl)
