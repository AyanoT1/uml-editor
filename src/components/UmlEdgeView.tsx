import { BaseEdge, EdgeLabelRenderer, useInternalNode, type EdgeProps, type InternalNode } from '@xyflow/react'
import { cn } from 'cn'
import { memo, type CSSProperties } from 'react'
import { headShape, polylinePath, routeEdge, routeOrthogonal, unit, type Point, type Rect } from '@/lib/geometry'
import { RELATIONS, type UmlEdge } from '@/lib/uml'
import { useShallow } from 'zustand/react/shallow'
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

/**
 * The name label sits beside the middle segment: above a horizontal run, right of a vertical one,
 * and on top of a diagonal line (with a background so the line doesn't cross the text).
 */
function centerLabel(pts: Point[]) {
  const i = Math.floor((pts.length - 1) / 2)
  const a = pts[i]
  const b = pts[i + 1] ?? a
  const d = unit(a, b)
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  const angle = (Math.atan2(d.y, d.x) * 180) / Math.PI
  let style: CSSProperties
  let onLine = false
  if (Math.abs(d.x) > 0.97) style = { transform: `translate(${mid.x}px, ${mid.y - 3}px) translate(-50%, -100%)` }
  else if (Math.abs(d.y) > 0.97) style = { transform: `translate(${mid.x + 6}px, ${mid.y}px) translate(0, -50%)` }
  else {
    style = { transform: `translate(${mid.x}px, ${mid.y}px) translate(-50%, -50%)` }
    onLine = true
  }
  return { style, angle, onLine }
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
  const orthogonal = data?.routing === 'orthogonal'
  // Other nodes, so right-angle routes can pick the bend that avoids them.
  const obstacles = useEditor(
    useShallow((st) =>
      orthogonal
        ? st.nodes
            .filter((n) => n.id !== source && n.id !== target && n.measured?.width)
            .map((n) => `${n.position.x},${n.position.y},${n.measured!.width},${n.measured!.height}`)
        : [],
    ),
  )
  if (!s || !t || !data) return null

  const rel = RELATIONS[data.relation]
  const args = [rectOf(s), rectOf(t), source === target, data.parallelIndex ?? 0, data.parallelCount ?? 1, source < target] as const
  const pts = orthogonal
    ? routeOrthogonal(...args, obstacles.map((o) => {
        const [x, y, w, h] = o.split(',').map(Number)
        return { x, y, w, h }
      }))
    : routeEdge(...args)
  const n = pts.length
  const head = headShape(rel.head, pts[n - 1], unit(pts[n - 2], pts[n - 1]))
  const line = head ? [...pts.slice(0, -1), head.lineEnd] : pts
  const label = data.label ? centerLabel(pts) : null

  return (
    <>
      <BaseEdge id={id} path={polylinePath(line)} className={cn('uml-edge', rel.dashed && 'is-dashed')} interactionWidth={18} />
      {head && <path d={head.d} className={cn('uml-edge-head', head.filled && 'is-filled', !head.closed && 'is-open')} />}
      <EdgeLabelRenderer>
        {label && (
          <div
            className={cn('uml-edge-label is-center nodrag nopan', label.onLine && 'is-on-line', selected && 'is-selected')}
            style={label.style}
            onClick={(e) => {
              // Keep React Flow's pane handler from clearing the selection again.
              e.stopPropagation()
              selectOnly(id)
            }}
          >
            {data.label}
            {data.readingArrow && (
              <span className="uml-reading-arrow" style={{ transform: `rotate(${label.angle}deg)` }} aria-hidden="true">
                ▶
              </span>
            )}
          </div>
        )}
        {data.sourceLabel && (
          <div className={cn('uml-edge-label is-end', selected && 'is-selected')} style={endLabelStyle(pts[0], pts[1], 14)}>
            {data.sourceLabel}
          </div>
        )}
        {data.targetLabel && (
          <div className={cn('uml-edge-label is-end', selected && 'is-selected')} style={endLabelStyle(pts[n - 1], pts[n - 2], head ? 26 : 14)}>
            {data.targetLabel}
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  )
}

export const UmlEdgeView = memo(UmlEdgeViewImpl)
