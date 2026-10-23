import { Handle, Position, useConnection, type NodeProps } from '@xyflow/react'
import { cn } from 'cn'
import { memo, useEffect, useRef, type KeyboardEvent } from 'react'
import { memberLines, stereotypeOf, type Member, type UmlNode, type UmlNodeData } from '@/lib/uml'
import { useEditor } from '@/store'

const SIDES = [Position.Top, Position.Right, Position.Bottom, Position.Left]

/** Which compartments a classifier shows, following common UML conventions. */
function compartments(data: UmlNodeData): Member[][] {
  const attrs = memberLines(data.attributes)
  const methods = memberLines(data.methods)
  switch (data.kind) {
    case 'interface':
      return attrs.length ? [attrs, methods] : [methods]
    case 'enum':
      return methods.length ? [attrs, methods] : [attrs]
    case 'entity':
      // Columns are shown verbatim: no visibility/static/abstract parsing, no operations.
      return [
        data.attributes
          .split('\n')
          .filter((l) => l.trim() !== '')
          .map((l) => ({ text: l.trim(), isStatic: false, isAbstract: false })),
      ]
    default:
      return [attrs, methods]
  }
}

function rows(text: string) {
  return Math.max(1, text.split('\n').length)
}

function InlineEditor({ id, data }: { id: string; data: UmlNodeData }) {
  const update = useEditor((s) => s.updateNodeData)
  const setEditing = useEditor((s) => s.setEditing)
  const first = useRef<HTMLInputElement & HTMLTextAreaElement>(null)

  useEffect(() => {
    // React Flow keeps freshly added nodes hidden until measured, so focus may need a few frames.
    let frame = 0
    let tries = 0
    const tryFocus = () => {
      const el = first.current
      if (!el) return
      el.focus()
      if (document.activeElement === el) el.select()
      else if (tries++ < 20) frame = requestAnimationFrame(tryFocus)
    }
    tryFocus()
    return () => cancelAnimationFrame(frame)
  }, [])

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) {
      e.preventDefault()
      setEditing(null)
    }
  }
  const field = 'nodrag nopan nowheel uml-inline-field'
  const isEntity = data.kind === 'entity'

  return (
    <div
      className="flex flex-col"
      onKeyDown={onKeyDown}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setEditing(null)
      }}
    >
      {data.kind === 'note' ? (
        <textarea
          ref={first}
          className={cn(field, 'uml-note-text')}
          value={data.text}
          rows={rows(data.text)}
          placeholder="Note text"
          onChange={(e) => update(id, { text: e.target.value })}
        />
      ) : (
        <>
          <div className="uml-header">
            <input
              ref={first}
              className={cn(field, 'uml-name', !isEntity && 'text-center')}
              value={data.name}
              placeholder="Name"
              aria-label="Name"
              onChange={(e) => update(id, { name: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && !e.metaKey && !e.ctrlKey && (e.preventDefault(), setEditing(null))}
            />
            {isEntity && (
              <input
                className={cn(field, 'uml-subtitle')}
                value={data.subtitle}
                placeholder="table_name"
                aria-label="Table name"
                spellCheck={false}
                onChange={(e) => update(id, { subtitle: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && !e.metaKey && !e.ctrlKey && (e.preventDefault(), setEditing(null))}
              />
            )}
          </div>
          <div className="uml-section">
            <textarea
              className={cn(field, 'uml-member')}
              value={data.attributes}
              rows={rows(data.attributes)}
              placeholder={isEntity ? 'id uuid' : data.kind === 'enum' ? 'LITERAL' : '- attribute: Type'}
              aria-label={isEntity ? 'Columns' : data.kind === 'enum' ? 'Literals' : 'Attributes'}
              spellCheck={!isEntity}
              onChange={(e) => update(id, { attributes: e.target.value })}
            />
          </div>
          {!isEntity && (<div className="uml-section">
            <textarea
              className={cn(field, 'uml-member')}
              value={data.methods}
              rows={rows(data.methods)}
              placeholder="+ operation(arg: Type): Type"
              aria-label="Operations"
              onChange={(e) => update(id, { methods: e.target.value })}
            />
          </div>)}
        </>
      )}
    </div>
  )
}

function ClassBody({ data }: { data: UmlNodeData }) {
  const stereo = stereotypeOf(data)
  return (
    <>
      <div className="uml-header">
        {stereo && <div className="uml-stereo">«{stereo}»</div>}
        <div className={cn('uml-name', data.kind === 'abstract' && 'italic')}>{data.name || ' '}</div>
        {data.kind === 'entity' && data.subtitle && <div className="uml-subtitle">{data.subtitle}</div>}
      </div>
      {compartments(data).map((members, i) => (
        <div key={i} className="uml-section">
          {members.map((m, j) => (
            <div key={j} className={cn('uml-member', m.isStatic && 'underline', m.isAbstract && 'italic')}>
              {m.text}
            </div>
          ))}
        </div>
      ))}
    </>
  )
}

function UmlNodeViewImpl({ id, data, selected }: NodeProps<UmlNode>) {
  const editing = useEditor((s) => s.editingNodeId === id)
  const connecting = useConnection((c) => c.inProgress)

  return (
    <div
      className={cn('uml-node', data.kind === 'note' ? 'uml-note' : 'uml-class', data.kind === 'entity' && 'uml-entity', selected && 'is-selected', editing && 'is-editing')}
      data-color={data.color}
    >
      {editing ? (
        <InlineEditor id={id} data={data} />
      ) : data.kind === 'note' ? (
        <div className="uml-note-text">{data.text || ' '}</div>
      ) : (
        <ClassBody data={data} />
      )}
      {SIDES.map((side) => (
        <Handle key={side} id={side} type="source" position={side} className="uml-handle" title="Drag to connect" />
      ))}
      {/* Covers the whole node while a connection is being dragged so it can be dropped anywhere on it. */}
      <Handle
        id="target"
        type="target"
        position={Position.Top}
        isConnectableStart={false}
        className="uml-target-handle"
        style={{ pointerEvents: connecting ? 'all' : 'none' }}
      />
    </div>
  )
}

export const UmlNodeView = memo(UmlNodeViewImpl)
