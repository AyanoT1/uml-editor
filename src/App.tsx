import { ReactFlowProvider } from '@xyflow/react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Canvas } from '@/components/Canvas'
import { Inspector, ShortcutList } from '@/components/Inspector'
import { Sidebar } from '@/components/Sidebar'
import { Toolbar } from '@/components/Toolbar'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useMediaQuery } from '@/hooks/use-media-query'
import { parseImport } from '@/lib/export'
import { useEditor } from '@/store'

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))
}

function useShortcuts(onHelp: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"]')) return
      const s = useEditor.getState()
      const mod = e.metaKey || e.ctrlKey
      const key = e.key.toLowerCase()
      if (mod && key === 'z') s[e.shiftKey ? 'redo' : 'undo']()
      else if (mod && key === 'y') s.redo()
      else if (mod && key === 'c') s.copySelected()
      else if (mod && key === 'v') s.paste()
      else if (mod && key === 'd') s.duplicateSelected()
      else if (mod && key === 'a') s.selectAll()
      else if (!mod && e.key === 'Escape') s.clearSelection()
      else if (!mod && e.key === '?') onHelp()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onHelp])
}

export default function App() {
  const ready = useEditor((s) => s.ready)
  const desktop = useMediaQuery('(min-width: 768px)')
  const wide = useMediaQuery('(min-width: 1024px)')
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 1280)
  const [mobileSidebar, setMobileSidebar] = useState(false)
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [mobileInspector, setMobileInspector] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    useEditor.getState().init()
  }, [])
  useShortcuts(() => setHelpOpen(true))

  const onImportFile = async (file: File) => {
    try {
      const diagrams = parseImport(await file.text())
      useEditor.getState().importDiagrams(diagrams)
      toast.success(`Imported ${diagrams.length} diagram${diagrams.length > 1 ? 's' : ''}`)
    } catch (err) {
      toast.error(`Import failed: ${err instanceof Error ? err.message : 'invalid file'}`)
    }
  }

  return (
    <TooltipProvider delayDuration={400}>
      <ReactFlowProvider>
        <div className="flex h-dvh flex-col overflow-hidden">
          <Toolbar
            onToggleSidebar={() => (desktop ? setSidebarOpen((v) => !v) : setMobileSidebar(true))}
            onToggleInspector={() => (wide ? setInspectorOpen((v) => !v) : setMobileInspector(true))}
            onImport={() => fileInput.current?.click()}
            onHelp={() => setHelpOpen(true)}
          />
          <div className="flex min-h-0 flex-1">
            {desktop && sidebarOpen && (
              <aside className="w-60 shrink-0 border-r bg-sidebar">
                <Sidebar />
              </aside>
            )}
            <main className="relative min-w-0 flex-1">{ready && <Canvas />}</main>
            {wide && inspectorOpen && (
              <aside className="w-80 shrink-0 border-l bg-background">
                <Inspector />
              </aside>
            )}
          </div>
        </div>

        <Sheet open={!desktop && mobileSidebar} onOpenChange={setMobileSidebar}>
          <SheetContent side="left" className="w-72 gap-0 p-0" showCloseButton={false}>
            <SheetTitle className="sr-only">Diagrams</SheetTitle>
            <SheetDescription className="sr-only">Open, create and manage diagrams</SheetDescription>
            <Sidebar onPick={() => setMobileSidebar(false)} />
          </SheetContent>
        </Sheet>
        <Sheet open={!wide && mobileInspector} onOpenChange={setMobileInspector}>
          <SheetContent side="right" className="w-80 gap-0 p-0">
            <SheetTitle className="sr-only">Properties</SheetTitle>
            <SheetDescription className="sr-only">Edit the selected element</SheetDescription>
            <div className="min-h-0 flex-1 pt-8">
              <Inspector />
            </div>
          </SheetContent>
        </Sheet>

        <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
          <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>UML class diagram editor</DialogTitle>
              <DialogDescription>
                Everything is stored in your browser’s localStorage — nothing is uploaded. Use Export → “Back up all
                diagrams” to move your work to another browser.
              </DialogDescription>
            </DialogHeader>
            <ShortcutList />
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">Members:</span> one per line. Visibility{' '}
                <code>+</code> public, <code>-</code> private, <code>#</code> protected, <code>~</code> package.
                Prefix with <code>static</code> (underlined) or <code>abstract</code> (italic).
              </p>
              <p>
                <span className="font-medium text-foreground">Relationships:</span> pick a type in the toolbar, then
                drag from the dots on a class’s border onto another class. Change the type, labels and multiplicities
                in the properties panel.
              </p>
            </div>
          </DialogContent>
        </Dialog>

        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onImportFile(file)
            e.target.value = ''
          }}
        />
        <Toaster position="bottom-center" />
      </ReactFlowProvider>
    </TooltipProvider>
  )
}
