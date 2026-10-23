import { headShape, polylinePath } from '@/lib/geometry'
import { RELATIONS, type Relation } from '@/lib/uml'

/** Miniature of a relationship's line style and end decoration. */
export function RelationIcon({ relation, className }: { relation: Relation; className?: string }) {
  const rel = RELATIONS[relation]
  const tip = { x: 27, y: 8 }
  const head = headShape(rel.head, tip, { x: 1, y: 0 }, 0.6)
  const end = head?.lineEnd ?? tip
  return (
    <svg viewBox="0 0 30 16" width={30} height={16} className={className} aria-hidden="true">
      <path
        d={polylinePath([{ x: 3, y: 8 }, end])}
        stroke="currentColor"
        strokeWidth={1.4}
        strokeDasharray={rel.dashed ? '3 2' : undefined}
        fill="none"
      />
      {head && (
        <path
          d={head.d}
          stroke="currentColor"
          strokeWidth={1.4}
          strokeLinejoin="round"
          fill={head.filled ? 'currentColor' : head.closed ? 'var(--background)' : 'none'}
        />
      )}
    </svg>
  )
}
