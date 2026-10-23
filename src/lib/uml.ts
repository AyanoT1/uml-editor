import type { Edge, Node, Viewport } from '@xyflow/react'

export type NodeKind = 'class' | 'abstract' | 'interface' | 'enum' | 'entity' | 'note'

export type Relation =
  | 'association'
  | 'directed'
  | 'inheritance'
  | 'realization'
  | 'dependency'
  | 'aggregation'
  | 'composition'

export type ColorKey = 'default' | 'blue' | 'green' | 'yellow' | 'red' | 'purple'

export type HeadKind = 'none' | 'arrow' | 'triangle' | 'diamond' | 'filledDiamond'

export type Routing = 'straight' | 'orthogonal'

export type UmlNodeData = {
  kind: NodeKind
  name: string
  /** Secondary title shown under the name, e.g. the SQL table of an entity. */
  subtitle: string
  /** Custom stereotype; empty means the kind's default (e.g. «interface»). */
  stereotype: string
  /** One member per line. */
  attributes: string
  /** One member per line. */
  methods: string
  /** Body of a note. */
  text: string
  color: ColorKey
}

export type UmlEdgeData = {
  relation: Relation
  label: string
  sourceLabel: string
  targetLabel: string
  routing: Routing
  /** Shows a ▸ next to the label pointing in the direction the name is read (source → target). */
  readingArrow: boolean
  /** Derived at render time to spread parallel edges apart; never persisted. */
  parallelIndex?: number
  parallelCount?: number
}

export type UmlNode = Node<UmlNodeData, 'uml'>
export type UmlEdge = Edge<UmlEdgeData, 'uml'>

export type StoredNode = { id: string; position: { x: number; y: number }; data: UmlNodeData }
export type StoredEdge = {
  id: string
  source: string
  target: string
  data: Pick<UmlEdgeData, 'relation' | 'label' | 'sourceLabel' | 'targetLabel' | 'routing' | 'readingArrow'>
}

export type Diagram = {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  nodes: StoredNode[]
  edges: StoredEdge[]
  viewport?: Viewport
}

export type DiagramMeta = Pick<Diagram, 'id' | 'name' | 'updatedAt'>

export const NODE_KINDS: Record<NodeKind, { label: string; base: string; stereotype?: string }> = {
  class: { label: 'Class', base: 'Class' },
  abstract: { label: 'Abstract class', base: 'AbstractClass' },
  interface: { label: 'Interface', base: 'Interface', stereotype: 'interface' },
  enum: { label: 'Enumeration', base: 'Enum', stereotype: 'enumeration' },
  entity: { label: 'Entity (table)', base: 'Entity' },
  note: { label: 'Note', base: 'Note' },
}

export const RELATIONS: Record<Relation, { label: string; dashed: boolean; head: HeadKind; hint: string }> = {
  association: { label: 'Association', dashed: false, head: 'none', hint: 'Drag between two classes to link them' },
  directed: {
    label: 'Directed association',
    dashed: false,
    head: 'arrow',
    hint: 'Drag from the class holding the reference to the referenced class',
  },
  inheritance: { label: 'Inheritance', dashed: false, head: 'triangle', hint: 'Drag from the subclass to the superclass' },
  realization: {
    label: 'Realization',
    dashed: true,
    head: 'triangle',
    hint: 'Drag from the class to the interface it implements',
  },
  dependency: { label: 'Dependency', dashed: true, head: 'arrow', hint: 'Drag from the dependent class to the class it uses' },
  aggregation: { label: 'Aggregation', dashed: false, head: 'diamond', hint: 'Drag from the part to the whole' },
  composition: { label: 'Composition', dashed: false, head: 'filledDiamond', hint: 'Drag from the part to the whole that owns it' },
}

export const COLORS: Record<ColorKey, string> = {
  default: 'Default',
  blue: 'Blue',
  green: 'Green',
  yellow: 'Yellow',
  red: 'Red',
  purple: 'Purple',
}

export function uid() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID().slice(0, 13)
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-5)
}

export function makeNodeData(kind: NodeKind, name?: string): UmlNodeData {
  return {
    kind,
    name: kind === 'note' ? '' : (name ?? NODE_KINDS[kind].base),
    subtitle: kind === 'entity' ? toSnakeCase(name ?? NODE_KINDS[kind].base) : '',
    stereotype: '',
    attributes: '',
    methods: '',
    text: kind === 'note' ? 'Note' : '',
    color: 'default',
  }
}

export function makeEdgeData(relation: Relation, routing: Routing = 'straight'): UmlEdgeData {
  return { relation, label: '', sourceLabel: '', targetLabel: '', routing, readingArrow: true }
}

/** `InstallationPosition` → `installation_position` (default SQL table name for an entity). */
export function toSnakeCase(name: string) {
  return name
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^\w]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
}

export function newDiagram(name = 'Untitled diagram'): Diagram {
  const now = Date.now()
  return { id: uid(), name, createdAt: now, updatedAt: now, nodes: [], edges: [] }
}

export function toStoredNode(n: UmlNode): StoredNode {
  return { id: n.id, position: { x: n.position.x, y: n.position.y }, data: { ...n.data } }
}

export function toStoredEdge(e: UmlEdge): StoredEdge {
  const d = e.data ?? makeEdgeData('association')
  return {
    id: e.id,
    source: e.source,
    target: e.target,
    data: {
      relation: d.relation,
      label: d.label,
      sourceLabel: d.sourceLabel,
      targetLabel: d.targetLabel,
      routing: d.routing,
      readingArrow: d.readingArrow,
    },
  }
}

export function fromStoredNode(n: StoredNode): UmlNode {
  return { id: n.id, type: 'uml', position: { ...n.position }, data: { ...n.data } }
}

export function fromStoredEdge(e: StoredEdge): UmlEdge {
  return { id: e.id, type: 'uml', source: e.source, target: e.target, data: { ...e.data } }
}

/** Coerces anything diagram-shaped (stored, imported or shared) into a valid Diagram. */
export function normalizeDiagram(raw: unknown): Diagram {
  if (!raw || typeof raw !== 'object') throw new Error('Not a diagram')
  const r = raw as Record<string, unknown>
  if (!Array.isArray(r.nodes)) throw new Error('Diagram has no "nodes" array')
  const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v))
  const multiline = (v: unknown) => (Array.isArray(v) ? v.map(str).join('\n') : str(v))
  const num = (v: unknown, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d)

  const d = newDiagram(str(r.name) || 'Untitled diagram')
  if (typeof r.id === 'string' && r.id) d.id = r.id
  d.createdAt = num(r.createdAt, d.createdAt)
  d.updatedAt = num(r.updatedAt, d.updatedAt)

  const ids = new Set<string>()
  for (const item of r.nodes) {
    if (!item || typeof item !== 'object') continue
    const n = item as Record<string, unknown>
    const data = (n.data && typeof n.data === 'object' ? n.data : n) as Record<string, unknown>
    const pos = (n.position && typeof n.position === 'object' ? n.position : n) as Record<string, unknown>
    const kind = (data.kind as NodeKind) in NODE_KINDS ? (data.kind as NodeKind) : 'class'
    let id = typeof n.id === 'string' && n.id ? n.id : uid()
    if (ids.has(id)) id = uid()
    ids.add(id)
    d.nodes.push({
      id,
      position: { x: num(pos.x), y: num(pos.y) },
      data: {
        kind,
        name: str(data.name),
        subtitle: str(data.subtitle),
        stereotype: str(data.stereotype),
        attributes: multiline(data.attributes),
        methods: multiline(data.methods),
        text: str(data.text),
        color: (data.color as ColorKey) in COLORS ? (data.color as ColorKey) : 'default',
      },
    })
  }

  for (const item of Array.isArray(r.edges) ? r.edges : []) {
    if (!item || typeof item !== 'object') continue
    const e = item as Record<string, unknown>
    const source = str(e.source)
    const target = str(e.target)
    if (!ids.has(source) || !ids.has(target)) continue
    const data = (e.data && typeof e.data === 'object' ? e.data : e) as Record<string, unknown>
    const relation = ((data.relation ?? data.type) as Relation) in RELATIONS ? ((data.relation ?? data.type) as Relation) : 'association'
    d.edges.push({
      id: typeof e.id === 'string' && e.id ? e.id : uid(),
      source,
      target,
      data: {
        relation,
        label: str(data.label),
        sourceLabel: str(data.sourceLabel),
        targetLabel: str(data.targetLabel),
        routing: data.routing === 'orthogonal' ? 'orthogonal' : 'straight',
        readingArrow: data.readingArrow !== false,
      },
    })
  }

  const vp = r.viewport as Record<string, unknown> | undefined
  if (vp && typeof vp === 'object') {
    d.viewport = { x: num(vp.x), y: num(vp.y), zoom: Math.min(3, Math.max(0.1, num(vp.zoom, 1))) }
  }
  return d
}

/* ------------------------------ Member parsing ------------------------------ */

export type Member = { text: string; isStatic: boolean; isAbstract: boolean }

/**
 * Parses one member line. Supports PlantUML-style `{static}` / `{abstract}` modifiers and a
 * leading `static` / `abstract` keyword (optionally after the visibility symbol).
 */
export function parseMember(line: string): Member {
  let isStatic = false
  let isAbstract = false
  let text = line.trim().replace(/\{(static|classifier|abstract)\}\s*/gi, (_, k: string) => {
    if (k.toLowerCase() === 'abstract') isAbstract = true
    else isStatic = true
    return ''
  })
  const m = text.match(/^([+\-#~]\s*)?(static|abstract)\s+/i)
  if (m) {
    if (m[2].toLowerCase() === 'static') isStatic = true
    else isAbstract = true
    text = (m[1] ?? '') + text.slice(m[0].length)
  }
  return { text: text.trim(), isStatic, isAbstract }
}

export function memberLines(src: string): Member[] {
  return src
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map(parseMember)
}

export function cleanStereotype(s: string) {
  return s
    .trim()
    .replace(/^(«|<<)\s*/, '')
    .replace(/\s*(»|>>)$/, '')
}

export function stereotypeOf(data: UmlNodeData) {
  return cleanStereotype(data.stereotype) || NODE_KINDS[data.kind].stereotype || ''
}

export function uniqueName(base: string, taken: Iterable<string>) {
  const used = new Set(taken)
  for (let i = 1; ; i++) {
    const name = `${base}${i}`
    if (!used.has(name)) return name
  }
}
