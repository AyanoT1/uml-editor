import type { HeadKind } from './uml'

export type Point = { x: number; y: number }
export type Rect = { x: number; y: number; w: number; h: number }

const center = (r: Rect): Point => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 })

function clampIn(p: Point, r: Rect, inset = 6): Point {
  return {
    x: Math.min(r.x + r.w - inset, Math.max(r.x + inset, p.x)),
    y: Math.min(r.y + r.h - inset, Math.max(r.y + inset, p.y)),
  }
}

/** Point where the segment from `from` (inside r) towards `toward` leaves rectangle r. */
function exitPoint(from: Point, toward: Point, r: Rect): Point {
  const dx = toward.x - from.x
  const dy = toward.y - from.y
  if (!dx && !dy) return { ...from }
  const tx = dx > 0 ? (r.x + r.w - from.x) / dx : dx < 0 ? (r.x - from.x) / dx : Infinity
  const ty = dy > 0 ? (r.y + r.h - from.y) / dy : dy < 0 ? (r.y - from.y) / dy : Infinity
  const t = Math.min(tx, ty)
  return { x: from.x + dx * t, y: from.y + dy * t }
}

/**
 * Polyline for an edge between two node rectangles ("floating" edge: it attaches wherever the
 * line between the centres crosses the borders). Parallel edges between the same pair are offset
 * perpendicular to each other; `canonical` tells whether source/target are in canonical order so
 * A→B and B→A edges of the same pair spread to different sides. Self-loops wrap the top-right corner.
 */
export function routeEdge(a: Rect, b: Rect, selfLoop: boolean, index: number, count: number, canonical: boolean): Point[] {
  if (selfLoop) {
    const s = 28 + index * 16
    const x0 = a.x + a.w
    const y0 = a.y + Math.min(22 + index * 10, a.h / 2)
    const x1 = a.x + a.w - Math.min(32 + index * 12, a.w / 2)
    return [
      { x: x0, y: y0 },
      { x: x0 + s, y: y0 },
      { x: x0 + s, y: a.y - s },
      { x: x1, y: a.y - s },
      { x: x1, y: a.y },
    ]
  }
  const [p, q] = canonical ? [a, b] : [b, a]
  const cp = center(p)
  const cq = center(q)
  const len = Math.hypot(cq.x - cp.x, cq.y - cp.y) || 1
  const off = (index - (count - 1) / 2) * 20
  const nx = (-(cq.y - cp.y) / len) * off
  const ny = ((cq.x - cp.x) / len) * off
  const ca = center(a)
  const cb = center(b)
  const pa = clampIn({ x: ca.x + nx, y: ca.y + ny }, a)
  const pb = clampIn({ x: cb.x + nx, y: cb.y + ny }, b)
  return [exitPoint(pa, pb, a), exitPoint(pb, pa, b)]
}

/**
 * Right-angled route between two node rectangles: a straight horizontal/vertical run when the
 * boxes face each other, an L when they are diagonal, a Z when they only barely overlap on one
 * axis. Falls back to the straight route when the rectangles overlap.
 */
export function routeOrthogonal(
  a: Rect,
  b: Rect,
  selfLoop: boolean,
  index: number,
  count: number,
  canonical: boolean,
  obstacles: Rect[] = [],
): Point[] {
  if (selfLoop) return routeEdge(a, b, true, index, count, canonical)
  const off = (index - (count - 1) / 2) * 16 * (canonical ? 1 : -1)
  const ca = center(a)
  const cb = center(b)
  const right = b.x > a.x + a.w // b entirely to the right of a
  const left = b.x + b.w < a.x
  const below = b.y > a.y + a.h
  const above = b.y + b.h < a.y
  const yLo = Math.max(a.y, b.y)
  const yHi = Math.min(a.y + a.h, b.y + b.h)
  const xLo = Math.max(a.x, b.x)
  const xHi = Math.min(a.x + a.w, b.x + b.w)
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi - 6, Math.max(lo + 6, v))
  const MIN_OVERLAP = 24

  if ((right || left) && yHi - yLo >= MIN_OVERLAP) {
    const y = clamp((yLo + yHi) / 2 + off, yLo, yHi)
    return right ? [{ x: a.x + a.w, y }, { x: b.x, y }] : [{ x: a.x, y }, { x: b.x + b.w, y }]
  }
  if ((above || below) && xHi - xLo >= MIN_OVERLAP) {
    const x = clamp((xLo + xHi) / 2 + off, xLo, xHi)
    return below ? [{ x, y: a.y + a.h }, { x, y: b.y }] : [{ x, y: a.y }, { x, y: b.y + b.h }]
  }
  if ((right || left) && (above || below)) {
    // L: either leave sideways and enter from the top/bottom, or the reverse. Prefer the one
    // that crosses fewer other nodes (sideways-first on a tie).
    const ya = clamp(ca.y + off, a.y, a.y + a.h)
    const xb = clamp(cb.x + off, b.x, b.x + b.w)
    const sideways = [
      { x: right ? a.x + a.w : a.x, y: ya },
      { x: xb, y: ya },
      { x: xb, y: below ? b.y : b.y + b.h },
    ]
    const xa = clamp(ca.x + off, a.x, a.x + a.w)
    const yb = clamp(cb.y + off, b.y, b.y + b.h)
    const vertical = [
      { x: xa, y: below ? a.y + a.h : a.y },
      { x: xa, y: yb },
      { x: right ? b.x : b.x + b.w, y: yb },
    ]
    return crossings(vertical, obstacles) < crossings(sideways, obstacles) ? vertical : sideways
  }
  if (right || left) {
    const ya = clamp(ca.y + off, a.y, a.y + a.h)
    const yb = clamp(cb.y + off, b.y, b.y + b.h)
    const x0 = right ? a.x + a.w : a.x
    const x1 = right ? b.x : b.x + b.w
    const mx = (x0 + x1) / 2
    return [{ x: x0, y: ya }, { x: mx, y: ya }, { x: mx, y: yb }, { x: x1, y: yb }]
  }
  if (above || below) {
    const xa = clamp(ca.x + off, a.x, a.x + a.w)
    const xb = clamp(cb.x + off, b.x, b.x + b.w)
    const y0 = below ? a.y + a.h : a.y
    const y1 = below ? b.y : b.y + b.h
    const my = (y0 + y1) / 2
    return [{ x: xa, y: y0 }, { x: xa, y: my }, { x: xb, y: my }, { x: xb, y: y1 }]
  }
  return routeEdge(a, b, false, index, count, canonical)
}

function segmentHitsRect(p: Point, q: Point, r: Rect) {
  // Segments here are axis-aligned, so an interval overlap test is exact.
  const x0 = Math.min(p.x, q.x)
  const x1 = Math.max(p.x, q.x)
  const y0 = Math.min(p.y, q.y)
  const y1 = Math.max(p.y, q.y)
  return x1 > r.x && x0 < r.x + r.w && y1 > r.y && y0 < r.y + r.h
}

function crossings(pts: Point[], obstacles: Rect[]) {
  let n = 0
  for (const r of obstacles) if (pts.some((p, i) => i > 0 && segmentHitsRect(pts[i - 1], p, r))) n++
  return n
}

export function unit(from: Point, to: Point): Point {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.hypot(dx, dy) || 1
  return { x: dx / len, y: dy / len }
}

export type Head = { d: string; closed: boolean; filled: boolean; lineEnd: Point }

/** Decoration at `tip`, where `dir` is the unit direction of travel into the tip. */
export function headShape(kind: HeadKind, tip: Point, dir: Point, scale = 1): Head | null {
  const nx = -dir.y
  const ny = dir.x
  const at = (back: number, side: number) => ({
    x: tip.x - dir.x * back * scale + nx * side * scale,
    y: tip.y - dir.y * back * scale + ny * side * scale,
  })
  const path = (pts: Point[], close: boolean) =>
    pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ') + (close ? ' Z' : '')
  switch (kind) {
    case 'triangle':
      return { d: path([tip, at(16, 8), at(16, -8)], true), closed: true, filled: false, lineEnd: at(16, 0) }
    case 'arrow':
      return { d: path([at(13, 7), tip, at(13, -7)], false), closed: false, filled: false, lineEnd: tip }
    case 'diamond':
    case 'filledDiamond':
      return {
        d: path([tip, at(10, 6), at(20, 0), at(10, -6)], true),
        closed: true,
        filled: kind === 'filledDiamond',
        lineEnd: at(20, 0),
      }
    default:
      return null
  }
}

export function polylinePath(pts: Point[]) {
  return pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')
}

/** Midpoint of the middle segment of a polyline (where the edge's label sits). */
export function midpoint(pts: Point[]): Point {
  const i = Math.floor((pts.length - 1) / 2)
  const a = pts[i]
  const b = pts[i + 1] ?? a
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}
