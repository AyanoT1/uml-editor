import { getNodesBounds, type Node } from '@xyflow/react'
import { toPng, toSvg } from 'html-to-image'
import { memberLines, normalizeDiagram, RELATIONS, stereotypeOf, type Diagram, type StoredNode } from './uml'

export function slug(name: string) {
  return name.trim().replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'diagram'
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  a.click()
}

export function downloadJson(data: unknown, filename: string) {
  downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), filename)
}

/** Accepts a single diagram, an array of diagrams, or a backup file `{ diagrams: [...] }`. */
export function parseImport(text: string): Diagram[] {
  const data = JSON.parse(text)
  const list = Array.isArray(data) ? data : Array.isArray(data?.diagrams) ? data.diagrams : [data]
  return list.map(normalizeDiagram)
}

/** Renders the diagram (not the visible viewport) to an image via the React Flow viewport DOM. */
export async function exportImage(format: 'png' | 'svg', nodes: Node[], name: string) {
  const el = document.querySelector<HTMLElement>('.react-flow__viewport')
  if (!el || !nodes.length) throw new Error('Nothing to export')
  const bounds = getNodesBounds(nodes)
  const pad = 60 // room for self-loops and edge labels outside node bounds
  const width = Math.ceil(bounds.width + pad * 2)
  const height = Math.ceil(bounds.height + pad * 2)
  const background = getComputedStyle(document.querySelector('.react-flow') ?? document.body).getPropertyValue('--canvas-bg').trim()
  const options = {
    backgroundColor: background || '#ffffff',
    width,
    height,
    pixelRatio: 2,
    style: {
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(${pad - bounds.x}px, ${pad - bounds.y}px) scale(1)`,
    },
    filter: (n: HTMLElement) => !n.classList?.contains('react-flow__handle'),
  }
  const url = format === 'png' ? await toPng(el, options) : await toSvg(el, options)
  downloadDataUrl(url, `${slug(name)}.${format}`)
}

/* ------------------------------ Mermaid ------------------------------ */

function mermaidId(n: StoredNode, used: Map<string, string>) {
  if (used.has(n.id)) return used.get(n.id)!
  const base = (n.data.name || 'Class').replace(/[^\w]/g, '_').replace(/^(\d)/, '_$1') || 'Class'
  let id = base
  for (let i = 2; [...used.values()].includes(id); i++) id = `${base}${i}`
  used.set(n.id, id)
  return id
}

const quote = (s: string) => `"${s.replace(/"/g, "'")}"`

export function toMermaid(d: Diagram) {
  const lines = ['classDiagram']
  const ids = new Map<string, string>()
  const notes: string[] = []
  for (const n of d.nodes) {
    if (n.data.kind === 'note') {
      notes.push(`  note ${quote(n.data.text.replace(/\n/g, '<br>'))}`)
      continue
    }
    const id = mermaidId(n, ids)
    const label = id === n.data.name ? '' : `[${quote(n.data.name)}]`
    lines.push(`  class ${id}${label} {`)
    const stereo = stereotypeOf(n.data) || (n.data.kind === 'entity' ? n.data.subtitle.trim() : '')
    if (stereo) lines.push(`    <<${stereo}>>`)
    if (n.data.kind === 'abstract' && !stereo) lines.push('    <<abstract>>')
    for (const m of [...memberLines(n.data.attributes), ...memberLines(n.data.methods)]) {
      lines.push(`    ${m.text.replace(/^([+\-#~])\s+/, '$1')}${m.isStatic ? '$' : ''}${m.isAbstract ? '*' : ''}`)
    }
    lines.push('  }')
  }
  const byId = new Map(d.nodes.map((n) => [n.id, n]))
  for (const e of d.edges) {
    const s = byId.get(e.source)
    const t = byId.get(e.target)
    if (!s || !t || s.data.kind === 'note' || t.data.kind === 'note') continue
    const a = ids.get(s.id)!
    const b = ids.get(t.id)!
    const sl = e.data.sourceLabel ? ` ${quote(e.data.sourceLabel)}` : ''
    const tl = e.data.targetLabel ? `${quote(e.data.targetLabel)} ` : ''
    const label = e.data.label ? ` : ${e.data.label}` : ''
    // Mermaid draws decorations on the left operand for these, so write target first.
    const reversed: Partial<Record<string, string>> = { inheritance: '<|--', realization: '<|..', aggregation: 'o--', composition: '*--' }
    const forward: Record<string, string> = { association: '--', directed: '-->', dependency: '..>' }
    if (reversed[e.data.relation]) {
      const tlr = e.data.targetLabel ? ` ${quote(e.data.targetLabel)}` : ''
      const slr = e.data.sourceLabel ? `${quote(e.data.sourceLabel)} ` : ''
      lines.push(`  ${b}${tlr} ${reversed[e.data.relation]} ${slr}${a}${label}`)
    } else {
      lines.push(`  ${a}${sl} ${forward[e.data.relation] ?? '--'} ${tl}${b}${label}`)
    }
  }
  return [...lines, ...notes].join('\n') + '\n'
}

export const RELATION_ORDER = Object.keys(RELATIONS) as (keyof typeof RELATIONS)[]
