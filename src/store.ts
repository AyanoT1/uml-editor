import {
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type Viewport,
  type XYPosition,
} from '@xyflow/react'
import { toast } from 'sonner'
import { create } from 'zustand'
import { exampleDiagram } from './lib/example'
import { readShareHash } from './lib/share'
import * as storage from './lib/storage'
import {
  fromStoredEdge,
  fromStoredNode,
  makeEdgeData,
  makeNodeData,
  newDiagram,
  NODE_KINDS,
  toStoredEdge,
  toStoredNode,
  uid,
  toSnakeCase,
  uniqueName,
  type Diagram,
  type DiagramMeta,
  type NodeKind,
  type Relation,
  type Routing,
  type StoredEdge,
  type StoredNode,
  type UmlEdge,
  type UmlEdgeData,
  type UmlNode,
  type UmlNodeData,
} from './lib/uml'

type EditorState = {
  ready: boolean
  diagramId: string
  name: string
  nodes: UmlNode[]
  edges: UmlEdge[]
  /** Viewport to restore when the canvas mounts for the open diagram. */
  initialViewport?: Viewport
  relation: Relation
  /** Line style for new relationships (also applied to the selected ones when changed). */
  routing: Routing
  diagrams: DiagramMeta[]
  editingNodeId: string | null
  canUndo: boolean
  canRedo: boolean

  init: () => Promise<void>
  onNodesChange: (changes: NodeChange<UmlNode>[]) => void
  onEdgesChange: (changes: EdgeChange<UmlEdge>[]) => void
  onConnect: (c: Connection) => void
  setRelation: (r: Relation) => void
  setRouting: (r: Routing) => void
  setViewport: (vp: Viewport) => void
  setEditing: (id: string | null) => void

  addNode: (kind: NodeKind, center: XYPosition) => void
  updateNodeData: (id: string, patch: Partial<UmlNodeData>) => void
  updateEdgeData: (id: string, patch: Partial<UmlEdgeData>) => void
  reverseEdge: (id: string) => void
  deleteSelected: () => void
  duplicateSelected: () => void
  copySelected: () => void
  paste: () => void
  selectAll: () => void
  clearSelection: () => void

  commit: () => void
  undo: () => void
  redo: () => void

  openDiagram: (id: string) => void
  createDiagram: (template?: Diagram) => void
  renameDiagram: (id: string, name: string) => void
  duplicateDiagram: (id: string) => void
  deleteDiagram: (id: string) => void
  importDiagrams: (diagrams: Diagram[]) => void
  refreshList: () => void
  currentDiagram: () => Diagram
  /** Commits pending edits and writes them to storage immediately. */
  flush: () => void
}

/* History, persistence and clipboard bookkeeping live outside React state. */
let past: string[] = []
let future: string[] = []
let lastSnapshot = ''
let commitTimer: ReturnType<typeof setTimeout> | undefined
let saveTimer: ReturnType<typeof setTimeout> | undefined
let createdAt = Date.now()
let updatedAt = Date.now()
let viewport: Viewport | undefined
let lastSavedContent = ''
let saveFailed = false
let clipboard: { nodes: StoredNode[]; edges: StoredEdge[] } | null = null
let pasteCount = 0

const HISTORY_LIMIT = 200
const ROUTING_KEY = 'uml-editor:routing'

function readRouting(): Routing {
  try {
    return localStorage.getItem(ROUTING_KEY) === 'orthogonal' ? 'orthogonal' : 'straight'
  } catch {
    return 'straight'
  }
}

const snapshotOf = (s: Pick<EditorState, 'nodes' | 'edges'>) =>
  JSON.stringify({ nodes: s.nodes.map(toStoredNode), edges: s.edges.map(toStoredEdge) })

export const useEditor = create<EditorState>()((set, get) => {
  function persist() {
    clearTimeout(saveTimer)
    saveTimer = undefined
    const s = get()
    if (!s.ready) return
    const content = JSON.stringify({ name: s.name, ...JSON.parse(snapshotOf(s)) })
    if (content !== lastSavedContent) updatedAt = Date.now()
    try {
      storage.saveDiagram(s.currentDiagram())
      lastSavedContent = content
      saveFailed = false
      set({ diagrams: storage.listDiagrams() })
    } catch {
      if (!saveFailed) toast.error('Could not save: browser storage is full or disabled.')
      saveFailed = true
    }
  }

  function scheduleSave() {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(persist, 300)
  }

  function flushSave() {
    if (saveTimer) persist()
  }

  function commitSoon() {
    clearTimeout(commitTimer)
    commitTimer = setTimeout(() => get().commit(), 700)
  }

  function flushCommit() {
    if (commitTimer) get().commit()
  }

  function resetHistory() {
    clearTimeout(commitTimer)
    commitTimer = undefined
    past = []
    future = []
    lastSnapshot = snapshotOf(get())
    set({ canUndo: false, canRedo: false })
  }

  function applySnapshot(snap: string) {
    const parsed = JSON.parse(snap) as { nodes: StoredNode[]; edges: StoredEdge[] }
    set({ nodes: parsed.nodes.map(fromStoredNode), edges: parsed.edges.map(fromStoredEdge), editingNodeId: null })
    scheduleSave()
  }

  function load(d: Diagram) {
    flushCommit()
    flushSave()
    createdAt = d.createdAt
    updatedAt = d.updatedAt
    viewport = d.viewport
    set({
      diagramId: d.id,
      name: d.name,
      nodes: d.nodes.map(fromStoredNode),
      edges: d.edges.map(fromStoredEdge),
      initialViewport: d.viewport,
      editingNodeId: null,
    })
    lastSavedContent = JSON.stringify({ name: d.name, ...JSON.parse(snapshotOf(get())) })
    storage.setCurrentId(d.id)
    resetHistory()
  }

  function saveNew(d: Diagram) {
    try {
      storage.saveDiagram(d)
    } catch {
      toast.error('Could not save: browser storage is full or disabled.')
    }
  }

  /** Inserts stored nodes/edges with fresh ids, offset, and selects them. */
  function insertCopies(src: { nodes: StoredNode[]; edges: StoredEdge[] }, offset: number) {
    const idMap = new Map<string, string>()
    const nodes = src.nodes.map((n) => {
      const id = uid()
      idMap.set(n.id, id)
      return { ...fromStoredNode(n), id, position: { x: n.position.x + offset, y: n.position.y + offset }, selected: true }
    })
    const edges = src.edges
      .filter((e) => idMap.has(e.source) && idMap.has(e.target))
      .map((e) => ({
        ...fromStoredEdge(e),
        id: uid(),
        source: idMap.get(e.source)!,
        target: idMap.get(e.target)!,
        selected: true,
      }))
    set((s) => ({
      nodes: [...s.nodes.map((n) => (n.selected ? { ...n, selected: false } : n)), ...nodes],
      edges: [...s.edges.map((e) => (e.selected ? { ...e, selected: false } : e)), ...edges],
    }))
    get().commit()
  }

  function selectionAsStored() {
    const s = get()
    const nodes = s.nodes.filter((n) => n.selected)
    const ids = new Set(nodes.map((n) => n.id))
    const edges = s.edges.filter((e) => ids.has(e.source) && ids.has(e.target))
    return { nodes: nodes.map(toStoredNode), edges: edges.map(toStoredEdge) }
  }

  return {
    ready: false,
    diagramId: '',
    name: '',
    nodes: [],
    edges: [],
    relation: 'association',
    routing: readRouting(),
    diagrams: [],
    editingNodeId: null,
    canUndo: false,
    canRedo: false,

    async init() {
      if (get().ready) return
      let shared: Diagram | null = null
      try {
        shared = await readShareHash()
      } catch {
        toast.error('The shared link is invalid or corrupted.')
      }
      const metas = storage.listDiagrams()
      let initial: Diagram | null = null
      if (shared) {
        initial = { ...shared, id: uid(), name: shared.name, createdAt: Date.now(), updatedAt: Date.now() }
        saveNew(initial)
        toast.success(`Imported shared diagram “${initial.name}”`)
      } else {
        const current = storage.getCurrentId()
        if (current) initial = storage.loadDiagram(current)
        if (!initial && metas.length) initial = storage.loadDiagram(metas[0].id)
        if (!initial) {
          initial = exampleDiagram()
          saveNew(initial)
        }
      }
      if (!storage.isStorageAvailable()) {
        toast.warning('Browser storage is unavailable — diagrams will not be saved.')
      }
      set({ ready: true })
      load(initial)
      set({ diagrams: storage.listDiagrams() })
    },

    onNodesChange(changes) {
      set((s) => ({ nodes: applyNodeChanges(changes, s.nodes) }))
      if (changes.some((c) => c.type !== 'select' && c.type !== 'dimensions')) scheduleSave()
    },

    onEdgesChange(changes) {
      set((s) => ({ edges: applyEdgeChanges(changes, s.edges) }))
      if (changes.some((c) => c.type !== 'select')) scheduleSave()
    },

    onConnect(c) {
      if (!c.source || !c.target) return
      const edge: UmlEdge = {
        id: uid(),
        type: 'uml',
        source: c.source,
        target: c.target,
        data: makeEdgeData(get().relation, get().routing),
        selected: true,
      }
      set((s) => ({
        nodes: s.nodes.map((n) => (n.selected ? { ...n, selected: false } : n)),
        edges: [...s.edges.map((e) => (e.selected ? { ...e, selected: false } : e)), edge],
      }))
      get().commit()
    },

    setRelation(relation) {
      set({ relation })
    },

    setRouting(routing) {
      try {
        localStorage.setItem(ROUTING_KEY, routing)
      } catch {
        /* storage unavailable */
      }
      const s = get()
      set({ routing })
      if (!s.edges.some((e) => e.selected && e.data?.routing !== routing)) return
      set({ edges: s.edges.map((e) => (e.selected && e.data ? { ...e, data: { ...e.data, routing } } : e)) })
      get().commit()
    },

    setViewport(vp) {
      viewport = vp
      scheduleSave()
    },

    setEditing(id) {
      set({ editingNodeId: id })
      if (id === null) flushCommit()
    },

    addNode(kind, center) {
      const s = get()
      const name = kind === 'note' ? undefined : uniqueName(NODE_KINDS[kind].base, s.nodes.map((n) => n.data.name))
      const position = { x: Math.round((center.x - 80) / 10) * 10, y: Math.round((center.y - 40) / 10) * 10 }
      while (s.nodes.some((n) => n.position.x === position.x && n.position.y === position.y)) {
        position.x += 20
        position.y += 20
      }
      const node: UmlNode = { id: uid(), type: 'uml', position, data: makeNodeData(kind, name), selected: true }
      set({
        nodes: [...s.nodes.map((n) => (n.selected ? { ...n, selected: false } : n)), node],
        edges: s.edges.map((e) => (e.selected ? { ...e, selected: false } : e)),
        editingNodeId: node.id,
      })
      get().commit()
    },

    updateNodeData(id, patch) {
      set((s) => ({
        nodes: s.nodes.map((n) => {
          if (n.id !== id) return n
          const next = { ...patch }
          // An entity's table name follows its name until it is edited by hand.
          if (
            next.name !== undefined &&
            next.subtitle === undefined &&
            n.data.kind === 'entity' &&
            n.data.subtitle === toSnakeCase(n.data.name)
          ) {
            next.subtitle = toSnakeCase(next.name)
          }
          return { ...n, data: { ...n.data, ...next } }
        }),
      }))
      scheduleSave()
      commitSoon()
    },

    updateEdgeData(id, patch) {
      set((s) => ({
        edges: s.edges.map((e) => (e.id === id ? { ...e, data: { ...makeEdgeData('association'), ...e.data, ...patch } } : e)),
      }))
      scheduleSave()
      commitSoon()
    },

    reverseEdge(id) {
      set((s) => ({
        edges: s.edges.map((e) => {
          if (e.id !== id || !e.data) return e
          return {
            ...e,
            source: e.target,
            target: e.source,
            data: { ...e.data, sourceLabel: e.data.targetLabel, targetLabel: e.data.sourceLabel },
          }
        }),
      }))
      get().commit()
    },

    deleteSelected() {
      const s = get()
      const removed = new Set(s.nodes.filter((n) => n.selected).map((n) => n.id))
      set({
        nodes: s.nodes.filter((n) => !n.selected),
        edges: s.edges.filter((e) => !e.selected && !removed.has(e.source) && !removed.has(e.target)),
        editingNodeId: null,
      })
      get().commit()
    },

    duplicateSelected() {
      const sel = selectionAsStored()
      if (sel.nodes.length) insertCopies(sel, 30)
    },

    copySelected() {
      const sel = selectionAsStored()
      if (!sel.nodes.length) return
      clipboard = sel
      pasteCount = 0
      toast(`Copied ${sel.nodes.length} element${sel.nodes.length > 1 ? 's' : ''}`)
    },

    paste() {
      if (!clipboard) return
      pasteCount++
      insertCopies(clipboard, 30 * pasteCount)
    },

    selectAll() {
      set((s) => ({
        nodes: s.nodes.map((n) => ({ ...n, selected: true })),
        edges: s.edges.map((e) => ({ ...e, selected: true })),
      }))
    },

    clearSelection() {
      set((s) => ({
        nodes: s.nodes.map((n) => (n.selected ? { ...n, selected: false } : n)),
        edges: s.edges.map((e) => (e.selected ? { ...e, selected: false } : e)),
        editingNodeId: null,
      }))
    },

    commit() {
      clearTimeout(commitTimer)
      commitTimer = undefined
      const snap = snapshotOf(get())
      if (snap === lastSnapshot) return
      past.push(lastSnapshot)
      if (past.length > HISTORY_LIMIT) past.shift()
      future = []
      lastSnapshot = snap
      set({ canUndo: true, canRedo: false })
      scheduleSave()
    },

    undo() {
      flushCommit()
      const prev = past.pop()
      if (prev === undefined) return
      future.push(lastSnapshot)
      lastSnapshot = prev
      applySnapshot(prev)
      set({ canUndo: past.length > 0, canRedo: true })
    },

    redo() {
      flushCommit()
      const next = future.pop()
      if (next === undefined) return
      past.push(lastSnapshot)
      lastSnapshot = next
      applySnapshot(next)
      set({ canUndo: true, canRedo: future.length > 0 })
    },

    openDiagram(id) {
      if (id === get().diagramId) return
      const d = storage.loadDiagram(id)
      if (!d) {
        toast.error('That diagram could not be loaded.')
        get().refreshList()
        return
      }
      load(d)
    },

    createDiagram(template) {
      const d = template ?? newDiagram(uniqueName('Diagram ', get().diagrams.map((m) => m.name)))
      saveNew(d)
      load(d)
      set({ diagrams: storage.listDiagrams() })
    },

    renameDiagram(id, name) {
      if (id === get().diagramId) {
        set({ name })
        scheduleSave()
        return
      }
      const d = storage.loadDiagram(id)
      if (!d) return
      d.name = name
      d.updatedAt = Date.now()
      saveNew(d)
      get().refreshList()
    },

    duplicateDiagram(id) {
      flushSave()
      const d = id === get().diagramId ? get().currentDiagram() : storage.loadDiagram(id)
      if (!d) return
      const now = Date.now()
      get().createDiagram({ ...structuredClone(d), id: uid(), name: `${d.name} (copy)`, createdAt: now, updatedAt: now })
    },

    deleteDiagram(id) {
      storage.deleteDiagram(id)
      const metas = storage.listDiagrams()
      set({ diagrams: metas })
      if (id !== get().diagramId) return
      clearTimeout(saveTimer)
      saveTimer = undefined
      const next = metas.map((m) => storage.loadDiagram(m.id)).find(Boolean)
      if (next) load(next)
      else get().createDiagram()
    },

    importDiagrams(diagrams) {
      if (!diagrams.length) return
      const existing = new Set(storage.listDiagrams().map((m) => m.id))
      let first: Diagram | null = null
      for (const d of diagrams) {
        const copy = existing.has(d.id) ? { ...d, id: uid() } : d
        saveNew(copy)
        first ??= copy
      }
      if (first) load(first)
      set({ diagrams: storage.listDiagrams() })
    },

    refreshList() {
      set({ diagrams: storage.listDiagrams() })
    },

    flush() {
      get().commit()
      if (saveTimer) persist()
    },

    currentDiagram() {
      const s = get()
      return {
        id: s.diagramId,
        name: s.name,
        createdAt,
        updatedAt,
        nodes: s.nodes.map(toStoredNode),
        edges: s.edges.map(toStoredEdge),
        viewport,
      }
    },
  }
})

// Keep the diagram list in sync when another tab edits storage.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key?.startsWith(storage.STORAGE_PREFIX)) useEditor.getState().refreshList()
  })
  window.addEventListener('pagehide', () => useEditor.getState().flush())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') useEditor.getState().flush()
  })
}
