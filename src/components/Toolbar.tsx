import { useReactFlow } from '@xyflow/react'
import {
  Box,
  CircleDot,
  CircleHelp,
  Download,
  FileCode,
  FileJson,
  ImageIcon,
  ListOrdered,
  CornerDownRight,
  MoveUpRight,
  Table2,
  Monitor,
  Moon,
  PanelLeft,
  PanelRight,
  Redo2,
  Share2,
  SquareDashed,
  StickyNote,
  Sun,
  Undo2,
  Upload,
  Archive,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTheme, type ThemeMode } from '@/hooks/use-theme'
import { downloadJson, exportImage, slug, toMermaid } from '@/lib/export'
import { MOD } from '@/lib/platform'
import { makeShareUrl } from '@/lib/share'
import { loadDiagram } from '@/lib/storage'
import { NODE_KINDS, RELATIONS, type NodeKind, type Relation } from '@/lib/uml'
import { useEditor } from '@/store'
import { RelationIcon } from './RelationIcon'

const KIND_ICONS: Record<NodeKind, ReactNode> = {
  class: <Box />,
  abstract: <SquareDashed />,
  interface: <CircleDot />,
  enum: <ListOrdered />,
  entity: <Table2 />,
  note: <StickyNote />,
}

// Tooltips overwrite Radix's data-state on the trigger, so style the checked state via aria-checked.
const TOGGLE_ITEM =
  'px-1 text-muted-foreground aria-checked:bg-accent aria-checked:text-foreground aria-checked:ring-1 aria-checked:ring-border'

function Tip({ label, shortcut, children }: { label: string; shortcut?: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>
        {label}
        {shortcut && <span className="ml-2 text-muted-foreground opacity-80">{shortcut}</span>}
      </TooltipContent>
    </Tooltip>
  )
}

async function copyText(text: string, success: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(success)
  } catch {
    toast.error('Clipboard access was blocked by the browser.')
  }
}

export function Toolbar({
  onToggleSidebar,
  onToggleInspector,
  onImport,
  onHelp,
}: {
  onToggleSidebar: () => void
  onToggleInspector: () => void
  onImport: () => void
  onHelp: () => void
}) {
  const name = useEditor((s) => s.name)
  const diagramId = useEditor((s) => s.diagramId)
  const relation = useEditor((s) => s.relation)
  const routing = useEditor((s) => s.routing)
  const canUndo = useEditor((s) => s.canUndo)
  const canRedo = useEditor((s) => s.canRedo)
  const { addNode, setRelation, setRouting, undo, redo, renameDiagram } = useEditor.getState()
  const { screenToFlowPosition, getNodes } = useReactFlow()
  const themeMode = useTheme((s) => s.mode)
  const setThemeMode = useTheme((s) => s.setMode)

  const addAtCenter = (kind: NodeKind) => {
    const pane = document.querySelector('.react-flow')?.getBoundingClientRect()
    if (!pane) return
    addNode(kind, screenToFlowPosition({ x: pane.left + pane.width / 2, y: pane.top + pane.height / 2 }))
  }

  const current = () => {
    useEditor.getState().flush()
    return useEditor.getState().currentDiagram()
  }

  const onExportImage = async (format: 'png' | 'svg') => {
    try {
      await exportImage(format, getNodes(), name)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed')
    }
  }

  const onBackup = () => {
    const all = useEditor
      .getState()
      .diagrams.map((m) => (m.id === diagramId ? current() : loadDiagram(m.id)))
      .filter(Boolean)
    downloadJson({ app: 'uml-editor', version: 1, exportedAt: new Date().toISOString(), diagrams: all }, `uml-editor-backup-${new Date().toISOString().slice(0, 10)}.json`)
  }

  return (
    <header className="flex min-h-12 shrink-0 flex-wrap items-center gap-1 border-b bg-background px-2 py-1.5 md:flex-nowrap md:py-0">
      <Tip label="Toggle diagrams">
        <Button variant="ghost" size="icon" onClick={onToggleSidebar} aria-label="Toggle diagram list">
          <PanelLeft />
        </Button>
      </Tip>
      <input
        className="h-8 min-w-0 flex-1 truncate md:flex-none rounded-md border border-transparent bg-transparent px-2 text-sm font-medium outline-none hover:border-border focus:border-ring focus:ring-3 focus:ring-ring/30 sm:w-48"
        value={name}
        aria-label="Diagram name"
        onChange={(e) => renameDiagram(diagramId, e.target.value)}
        onBlur={(e) => !e.target.value.trim() && renameDiagram(diagramId, 'Untitled diagram')}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />

      <div className="order-last flex w-full min-w-0 items-center gap-1 overflow-x-auto [scrollbar-width:none] md:order-none md:w-auto md:flex-1 md:px-1">
        <Separator orientation="vertical" className="mx-1 !h-6 max-md:hidden" />
        {(Object.keys(NODE_KINDS) as NodeKind[]).map((kind) => (
          <Tip key={kind} label={`Add ${NODE_KINDS[kind].label.toLowerCase()}`}>
            <Button variant="ghost" size="sm" onClick={() => addAtCenter(kind)} aria-label={`Add ${NODE_KINDS[kind].label}`}>
              {KIND_ICONS[kind]}
              <span className="hidden 2xl:inline">{NODE_KINDS[kind].label.replace(/ class| \(table\)/, '')}</span>
            </Button>
          </Tip>
        ))}
        <Separator orientation="vertical" className="mx-1 !h-6" />
        <ToggleGroup
          type="single"
          size="sm"
          value={relation}
          onValueChange={(v) => v && setRelation(v as Relation)}
          aria-label="Relationship type for new connections"
        >
          {(Object.keys(RELATIONS) as Relation[]).map((r) => (
            <Tip key={r} label={RELATIONS[r].label} shortcut={RELATIONS[r].hint}>
              <ToggleGroupItem
                value={r}
                aria-label={RELATIONS[r].label}
                className={TOGGLE_ITEM}
              >
                <RelationIcon relation={r} className="size-auto" />
              </ToggleGroupItem>
            </Tip>
          ))}
        </ToggleGroup>
        <Separator orientation="vertical" className="mx-1 !h-6" />
        <ToggleGroup
          type="single"
          size="sm"
          value={routing}
          aria-label="Line style"
        >
          {/* onClick rather than onValueChange: re-clicking the active style still applies it to the selection. */}
          <Tip label="Straight lines" shortcut="new + selected">
            <ToggleGroupItem value="straight" aria-label="Straight lines" className={TOGGLE_ITEM} onClick={() => setRouting('straight')}>
              <MoveUpRight />
            </ToggleGroupItem>
          </Tip>
          <Tip label="Right-angle lines" shortcut="new + selected">
            <ToggleGroupItem value="orthogonal" aria-label="Right-angle lines" className={TOGGLE_ITEM} onClick={() => setRouting('orthogonal')}>
              <CornerDownRight />
            </ToggleGroupItem>
          </Tip>
        </ToggleGroup>
        <Separator orientation="vertical" className="mx-1 !h-6" />
        <Tip label="Undo" shortcut={`${MOD}Z`}>
          <Button variant="ghost" size="icon" disabled={!canUndo} onClick={undo} aria-label="Undo">
            <Undo2 />
          </Button>
        </Tip>
        <Tip label="Redo" shortcut={`${MOD}Shift+Z`}>
          <Button variant="ghost" size="icon" disabled={!canRedo} onClick={redo} aria-label="Redo">
            <Redo2 />
          </Button>
        </Tip>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Download />
            <span className="hidden sm:inline">Export</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>This diagram</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => onExportImage('png')}>
            <ImageIcon /> PNG image
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onExportImage('svg')}>
            <ImageIcon /> SVG image
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => downloadJson(current(), `${slug(name)}.json`)}>
            <FileJson /> JSON file
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => copyText(toMermaid(current()), 'Mermaid code copied to clipboard')}>
            <FileCode /> Copy as Mermaid
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={async () => {
              try {
                await copyText(await makeShareUrl(current()), 'Share link copied — anyone opening it gets their own copy')
              } catch {
                toast.error('Could not create a share link in this browser.')
              }
            }}
          >
            <Share2 /> Copy share link
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>All diagrams</DropdownMenuLabel>
          <DropdownMenuItem onSelect={onImport}>
            <Upload /> Import JSON / backup…
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onBackup}>
            <Archive /> Back up all diagrams
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Theme">
            {themeMode === 'dark' ? <Moon /> : themeMode === 'light' ? <Sun /> : <Monitor />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuRadioGroup value={themeMode} onValueChange={(v) => setThemeMode(v as ThemeMode)}>
            <DropdownMenuRadioItem value="light">
              <Sun /> Light
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark">
              <Moon /> Dark
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="system">
              <Monitor /> System
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <Tip label="Help & shortcuts" shortcut="?">
        <Button variant="ghost" size="icon" onClick={onHelp} aria-label="Help">
          <CircleHelp />
        </Button>
      </Tip>
      <Tip label="Toggle properties">
        <Button variant="ghost" size="icon" onClick={onToggleInspector} aria-label="Toggle properties panel">
          <PanelRight />
        </Button>
      </Tip>
    </header>
  )
}
