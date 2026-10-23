import { ArrowLeftRight, Copy, CornerDownRight, MoveUpRight, Trash2 } from 'lucide-react'
import { cn } from 'cn'
import type { ReactNode } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  COLORS,
  NODE_KINDS,
  RELATIONS,
  toSnakeCase,
  type ColorKey,
  type NodeKind,
  type Relation,
  type Routing,
  type UmlEdge,
  type UmlNode,
} from '@/lib/uml'
import { useEditor } from '@/store'
import { RelationIcon } from './RelationIcon'
import { MOD } from '@/lib/platform'

function Field({ label, htmlFor, children, hint }: { label: string; htmlFor?: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={htmlFor} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-4 border-b p-4 last:border-b-0">
      <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h2>
      {children}
    </section>
  )
}

function ColorPicker({ value, onChange }: { value?: ColorKey; onChange: (c: ColorKey) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Color">
      {(Object.keys(COLORS) as ColorKey[]).map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          title={COLORS[c]}
          data-color={c}
          onClick={() => onChange(c)}
          className={cn(
            'uml-swatch size-7 rounded-full border-2 transition-transform hover:scale-110',
            value === c ? 'ring-2 ring-ring ring-offset-2 ring-offset-background' : '',
          )}
        />
      ))}
    </div>
  )
}

function Actions() {
  const { duplicateSelected, deleteSelected } = useEditor.getState()
  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" className="flex-1" onClick={duplicateSelected}>
        <Copy /> Duplicate
      </Button>
      <Button variant="destructive" size="sm" className="flex-1" onClick={deleteSelected}>
        <Trash2 /> Delete
      </Button>
    </div>
  )
}

const MEMBER_HINT = (
  <>
    One per line, e.g. <code>- name: String</code> or <code>+ get(id: int): T</code>. Prefix with{' '}
    <code>static</code> to underline, <code>abstract</code> for italics.
  </>
)

function NodeInspector({ node }: { node: UmlNode }) {
  const update = useEditor((s) => s.updateNodeData)
  const commit = useEditor((s) => s.commit)
  const d = node.data
  const set = (patch: Partial<typeof d>) => update(node.id, patch)
  const isNote = d.kind === 'note'
  const isEntity = d.kind === 'entity'

  return (
    <>
      <Section title={NODE_KINDS[d.kind].label}>
        <Field label="Type" htmlFor="node-kind">
          <Select
            value={d.kind}
            onValueChange={(v) => {
              set({
                kind: v as NodeKind,
                ...(v === 'note' && !d.text ? { text: d.name } : {}),
                ...(v === 'entity' && !d.subtitle ? { subtitle: toSnakeCase(d.name) } : {}),
              })
              commit()
            }}
          >
            <SelectTrigger id="node-kind" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(NODE_KINDS) as NodeKind[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {NODE_KINDS[k].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {isNote ? (
          <Field label="Text" htmlFor="node-text">
            <Textarea id="node-text" value={d.text} onChange={(e) => set({ text: e.target.value })} className="min-h-24" />
          </Field>
        ) : (
          <>
            <Field label="Name" htmlFor="node-name">
              <Input id="node-name" value={d.name} onChange={(e) => set({ name: e.target.value })} />
            </Field>
            {isEntity ? (
              <Field label="Table name" htmlFor="node-subtitle" hint="Shown under the name. Follows the name until you edit it.">
                <Input
                  id="node-subtitle"
                  value={d.subtitle}
                  placeholder="table_name"
                  className="font-mono"
                  spellCheck={false}
                  onChange={(e) => set({ subtitle: e.target.value })}
                />
              </Field>
            ) : (
              <Field label="Stereotype" htmlFor="node-stereo">
                <Input
                  id="node-stereo"
                  value={d.stereotype}
                  placeholder={NODE_KINDS[d.kind].stereotype ?? 'e.g. entity, service'}
                  onChange={(e) => set({ stereotype: e.target.value })}
                />
              </Field>
            )}
            <Field
              label={isEntity ? 'Columns' : d.kind === 'enum' ? 'Literals' : 'Attributes'}
              htmlFor="node-attrs"
              hint={isEntity ? 'One per line, shown as written, e.g. id uuid v7.' : d.kind === 'enum' ? undefined : MEMBER_HINT}
            >
              <Textarea
                id="node-attrs"
                value={d.attributes}
                placeholder={isEntity ? 'id uuid\nclient_id\ncreated_at' : d.kind === 'enum' ? 'RED\nGREEN' : '- id: int\n- name: String'}
                onChange={(e) => set({ attributes: e.target.value })}
                className={cn('font-mono text-xs', isEntity ? 'min-h-32' : 'min-h-20')}
                spellCheck={false}
              />
            </Field>
            {!isEntity && (<Field label="Operations" htmlFor="node-methods">
              <Textarea
                id="node-methods"
                value={d.methods}
                placeholder={'+ getId(): int\n+ setName(name: String): void'}
                onChange={(e) => set({ methods: e.target.value })}
                className="min-h-20 font-mono text-xs"
                spellCheck={false}
              />
            </Field>)}
          </>
        )}
        <Field label="Color">
          <ColorPicker
            value={d.color}
            onChange={(color) => {
              set({ color })
              commit()
            }}
          />
        </Field>
      </Section>
      <Section title="Actions">
        <Actions />
      </Section>
    </>
  )
}

const MULTIPLICITIES = ['1', '0..1', '*', '0..*', '1..*']

function EdgeInspector({ edge }: { edge: UmlEdge }) {
  const update = useEditor((s) => s.updateEdgeData)
  const { commit, reverseEdge, deleteSelected } = useEditor.getState()
  const names = useEditor(
    useShallow((s) => {
      const name = (id: string) => {
        const n = s.nodes.find((x) => x.id === id)
        return n ? n.data.name || (n.data.kind === 'note' ? 'Note' : 'Unnamed') : '?'
      }
      return [name(edge.source), name(edge.target)] as const
    }),
  )
  const d = edge.data!
  const set = (patch: Partial<typeof d>) => update(edge.id, patch)

  return (
    <>
      <Section title="Relationship">
        <Field label="Type" htmlFor="edge-type" hint={RELATIONS[d.relation].hint + '.'}>
          <Select
            value={d.relation}
            onValueChange={(v) => {
              set({ relation: v as Relation })
              commit()
            }}
          >
            <SelectTrigger id="edge-type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(RELATIONS) as Relation[]).map((r) => (
                <SelectItem key={r} value={r}>
                  <RelationIcon relation={r} /> {RELATIONS[r].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-2 text-sm">
          <span className="min-w-0 flex-1 truncate font-medium" title={names[0]}>
            {names[0]}
          </span>
          <RelationIcon relation={d.relation} className="shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-right font-medium" title={names[1]}>
            {names[1]}
          </span>
          <Button variant="ghost" size="icon-sm" onClick={() => reverseEdge(edge.id)} title="Reverse direction" aria-label="Reverse direction">
            <ArrowLeftRight />
          </Button>
        </div>
        <Field label="Line">
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={d.routing}
            onValueChange={(v) => {
              if (!v) return
              set({ routing: v as Routing })
              commit()
            }}
            className="w-full"
          >
            <ToggleGroupItem value="straight" className="flex-1">
              <MoveUpRight /> Straight
            </ToggleGroupItem>
            <ToggleGroupItem value="orthogonal" className="flex-1">
              <CornerDownRight /> Right angles
            </ToggleGroupItem>
          </ToggleGroup>
        </Field>
        <Field label="Label" htmlFor="edge-label">
          <Input id="edge-label" value={d.label} placeholder="e.g. owns" onChange={(e) => set({ label: e.target.value })} />
        </Field>
        <Label className="flex items-center gap-2 text-sm font-normal">
          <Checkbox
            checked={d.readingArrow}
            onCheckedChange={(v) => {
              set({ readingArrow: v === true })
              commit()
            }}
          />
          Show reading direction (▸) after the label
        </Label>
        <div className="grid grid-cols-2 gap-3">
          <Field label={`At ${names[0]}`} htmlFor="edge-src">
            <Input id="edge-src" list="multiplicities" value={d.sourceLabel} placeholder="0..*" onChange={(e) => set({ sourceLabel: e.target.value })} />
          </Field>
          <Field label={`At ${names[1]}`} htmlFor="edge-tgt">
            <Input id="edge-tgt" list="multiplicities" value={d.targetLabel} placeholder="1" onChange={(e) => set({ targetLabel: e.target.value })} />
          </Field>
        </div>
        <datalist id="multiplicities">
          {MULTIPLICITIES.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </Section>
      <Section title="Actions">
        <Button variant="destructive" size="sm" onClick={deleteSelected}>
          <Trash2 /> Delete relationship
        </Button>
      </Section>
    </>
  )
}

function MultiInspector({ nodes, edges }: { nodes: UmlNode[]; edges: UmlEdge[] }) {
  const { updateNodeData, commit } = useEditor.getState()
  const parts = [nodes.length && `${nodes.length} element${nodes.length > 1 ? 's' : ''}`, edges.length && `${edges.length} relationship${edges.length > 1 ? 's' : ''}`]
  return (
    <>
      <Section title="Selection">
        <p className="text-sm">{parts.filter(Boolean).join(', ')} selected</p>
        {nodes.length > 0 && (
          <Field label="Color">
            <ColorPicker
              value={nodes.every((n) => n.data.color === nodes[0].data.color) ? nodes[0].data.color : undefined}
              onChange={(color) => {
                for (const n of nodes) updateNodeData(n.id, { color })
                commit()
              }}
            />
          </Field>
        )}
      </Section>
      <Section title="Actions">
        <Actions />
      </Section>
    </>
  )
}

function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">{children}</kbd>
}

export function ShortcutList() {
  const rows: { k: string; v: ReactNode }[] = [
    { k: 'Add class', v: 'Double-click canvas' },
    { k: 'Edit element inline', v: 'Double-click it' },
    { k: 'Connect', v: 'Drag from a border dot' },
    { k: 'Select several', v: <><Kbd>Shift</Kbd> + click / drag box</> },
    { k: 'Pan', v: <>Scroll, <Kbd>Space</Kbd> + drag</> },
    { k: 'Zoom', v: <><Kbd>{MOD.replace('+', '')}</Kbd> + scroll / pinch</> },
    { k: 'Delete', v: <Kbd>Del</Kbd> },
    { k: 'Undo / redo', v: <><Kbd>{MOD}Z</Kbd> <Kbd>{MOD}Shift+Z</Kbd></> },
    { k: 'Copy / paste', v: <><Kbd>{MOD}C</Kbd> <Kbd>{MOD}V</Kbd></> },
    { k: 'Duplicate', v: <Kbd>{MOD}D</Kbd> },
    { k: 'Select all', v: <Kbd>{MOD}A</Kbd> },
    { k: 'Finish editing', v: <><Kbd>Esc</Kbd> or <Kbd>{MOD}Enter</Kbd></> },
  ]
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
      {rows.map(({ k, v }) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="text-right">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

function DiagramInspector() {
  const { name, diagramId, nodeCount, edgeCount } = useEditor(
    useShallow((s) => ({ name: s.name, diagramId: s.diagramId, nodeCount: s.nodes.length, edgeCount: s.edges.length })),
  )
  const renameDiagram = useEditor((s) => s.renameDiagram)
  return (
    <>
      <Section title="Diagram">
        <Field label="Name" htmlFor="diagram-name">
          <Input id="diagram-name" value={name} onChange={(e) => renameDiagram(diagramId, e.target.value)} />
        </Field>
        <p className="text-sm text-muted-foreground">
          {nodeCount} element{nodeCount === 1 ? '' : 's'} · {edgeCount} relationship{edgeCount === 1 ? '' : 's'}
        </p>
        <p className="text-sm text-muted-foreground">Select an element or relationship to edit its properties.</p>
      </Section>
      <Section title="Shortcuts">
        <ShortcutList />
      </Section>
    </>
  )
}

export function Inspector() {
  const nodes = useEditor(useShallow((s) => s.nodes.filter((n) => n.selected)))
  const edges = useEditor(useShallow((s) => s.edges.filter((e) => e.selected)))
  let body: ReactNode
  if (nodes.length === 1 && edges.length === 0) body = <NodeInspector key={nodes[0].id} node={nodes[0]} />
  else if (edges.length === 1 && nodes.length === 0) body = <EdgeInspector key={edges[0].id} edge={edges[0]} />
  else if (nodes.length || edges.length) body = <MultiInspector nodes={nodes} edges={edges} />
  else body = <DiagramInspector />
  return <div className="h-full overflow-y-auto">{body}</div>
}
