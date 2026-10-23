import { Copy, Download, Ellipsis, FileText, Pencil, Plus, Trash2 } from 'lucide-react'
import { cn } from 'cn'
import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { downloadJson, slug } from '@/lib/export'
import { loadDiagram, storageUsage } from '@/lib/storage'
import type { DiagramMeta } from '@/lib/uml'
import { useEditor } from '@/store'

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

function timeAgo(ts: number) {
  const s = (ts - Date.now()) / 1000
  if (Math.abs(s) < 60) return 'just now'
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['minute', 60],
    ['hour', 3600],
    ['day', 86400],
    ['week', 604800],
  ]
  for (let i = units.length - 1; i >= 0; i--) {
    const [unit, secs] = units[i]
    if (Math.abs(s) >= secs) return rtf.format(Math.round(s / secs), unit)
  }
  return rtf.format(Math.round(s / 60), 'minute')
}

function formatBytes(b: number) {
  return b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 / 1024).toFixed(2)} MB`
}

function DiagramItem({ meta, active, onPick }: { meta: DiagramMeta; active: boolean; onPick: () => void }) {
  const { openDiagram, renameDiagram, duplicateDiagram, deleteDiagram, flush, currentDiagram } = useEditor.getState()
  const [renaming, setRenaming] = useState(false)
  const [confirming, setConfirming] = useState(false)

  return (
    <li className="group relative">
      {renaming ? (
        <input
          autoFocus
          defaultValue={meta.name}
          className="h-12 w-full rounded-md border border-ring bg-background px-3 text-sm outline-none"
          onFocus={(e) => e.target.select()}
          onBlur={(e) => {
            renameDiagram(meta.id, e.target.value.trim() || 'Untitled diagram')
            setRenaming(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') setRenaming(false)
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            openDiagram(meta.id)
            onPick()
          }}
          onDoubleClick={() => setRenaming(true)}
          className={cn(
            'flex w-full items-start gap-2 rounded-md px-2.5 py-2 pr-9 text-left transition-colors hover:bg-muted',
            active && 'bg-muted',
          )}
        >
          <FileText className={cn('mt-0.5 size-4 shrink-0', active ? 'text-foreground' : 'text-muted-foreground')} />
          <span className="min-w-0">
            <span className={cn('block truncate text-sm', active && 'font-medium')}>{meta.name || 'Untitled diagram'}</span>
            <span className="block text-xs text-muted-foreground">{timeAgo(meta.updatedAt)}</span>
          </span>
        </button>
      )}
      {!renaming && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="absolute top-1.5 right-1 opacity-100 group-hover:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100 md:opacity-0"
              aria-label={`Actions for ${meta.name}`}
            >
              <Ellipsis />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={() => setRenaming(true)}>
              <Pencil /> Rename
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => duplicateDiagram(meta.id)}>
              <Copy /> Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                let d
                if (active) {
                  flush()
                  d = currentDiagram()
                } else d = loadDiagram(meta.id)
                if (d) downloadJson(d, `${slug(d.name)}.json`)
              }}
            >
              <Download /> Export JSON
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => setConfirming(true)}>
              <Trash2 /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{meta.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The diagram is removed from this browser’s storage. This can’t be undone — export it first if you might need it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => deleteDiagram(meta.id)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  )
}

export function Sidebar({ onPick = () => {} }: { onPick?: () => void }) {
  const diagrams = useEditor((s) => s.diagrams)
  const diagramId = useEditor((s) => s.diagramId)
  const createDiagram = useEditor((s) => s.createDiagram)

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 shrink-0 items-center justify-between border-b px-3">
        <h2 className="text-sm font-semibold">Diagrams</h2>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            createDiagram()
            onPick()
          }}
        >
          <Plus /> New
        </Button>
      </div>
      <ul className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {diagrams.map((m) => (
          <DiagramItem key={m.id} meta={m} active={m.id === diagramId} onPick={onPick} />
        ))}
      </ul>
      <p className="border-t px-3 py-2.5 text-xs text-muted-foreground">
        Saved in this browser · {formatBytes(storageUsage())}
      </p>
    </div>
  )
}
