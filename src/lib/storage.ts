import { normalizeDiagram, type Diagram, type DiagramMeta } from './uml'

// Everything lives in localStorage so the app can stay a static site.
// Layout: an index of {id, name, updatedAt}, one key per diagram, and the id of the open diagram.
const PREFIX = 'uml-editor:'
const INDEX_KEY = PREFIX + 'index'
const CURRENT_KEY = PREFIX + 'current'
const diagramKey = (id: string) => PREFIX + 'diagram:' + id

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string) {
  localStorage.setItem(key, value)
}

function remove(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    /* storage unavailable */
  }
}

export function isStorageAvailable() {
  try {
    const k = PREFIX + 'probe'
    localStorage.setItem(k, '1')
    localStorage.removeItem(k)
    return true
  } catch {
    return false
  }
}

function rebuildIndex(): DiagramMeta[] {
  const metas: DiagramMeta[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith(PREFIX + 'diagram:')) continue
      try {
        const d = JSON.parse(localStorage.getItem(key) ?? '')
        metas.push({ id: d.id, name: d.name, updatedAt: d.updatedAt ?? 0 })
      } catch {
        /* skip corrupt entry */
      }
    }
    write(INDEX_KEY, JSON.stringify(metas))
  } catch {
    /* storage unavailable */
  }
  return metas
}

export function listDiagrams(): DiagramMeta[] {
  const raw = read(INDEX_KEY)
  let metas: DiagramMeta[]
  try {
    metas = raw ? JSON.parse(raw) : rebuildIndex()
    if (!Array.isArray(metas)) metas = rebuildIndex()
  } catch {
    metas = rebuildIndex()
  }
  return [...metas].sort((a, b) => b.updatedAt - a.updatedAt)
}

export function loadDiagram(id: string): Diagram | null {
  const raw = read(diagramKey(id))
  if (!raw) return null
  try {
    return normalizeDiagram(JSON.parse(raw))
  } catch {
    return null
  }
}

/** Throws when the browser refuses the write (quota exceeded, storage disabled). */
export function saveDiagram(d: Diagram) {
  write(diagramKey(d.id), JSON.stringify(d))
  const metas = listDiagrams().filter((m) => m.id !== d.id)
  metas.push({ id: d.id, name: d.name, updatedAt: d.updatedAt })
  write(INDEX_KEY, JSON.stringify(metas))
}

export function deleteDiagram(id: string) {
  remove(diagramKey(id))
  try {
    write(INDEX_KEY, JSON.stringify(listDiagrams().filter((m) => m.id !== id)))
  } catch {
    /* storage unavailable */
  }
}

export function getCurrentId() {
  return read(CURRENT_KEY)
}

export function setCurrentId(id: string) {
  try {
    write(CURRENT_KEY, id)
  } catch {
    /* storage unavailable */
  }
}

/** Approximate bytes used by this app (localStorage stores UTF-16). */
export function storageUsage() {
  let total = 0
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(PREFIX)) total += (key.length + (localStorage.getItem(key)?.length ?? 0)) * 2
    }
  } catch {
    /* storage unavailable */
  }
  return total
}

export const STORAGE_PREFIX = PREFIX
