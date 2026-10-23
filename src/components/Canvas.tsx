import {
  Background,
  BackgroundVariant,
  ConnectionLineType,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  SelectionMode,
  useConnection,
  useReactFlow,
  type EdgeTypes,
  type NodeTypes,
} from '@xyflow/react'
import { useMemo, type MouseEvent } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useMediaQuery } from '@/hooks/use-media-query'
import { useTheme } from '@/hooks/use-theme'
import { RELATIONS, type UmlEdge } from '@/lib/uml'
import { useEditor } from '@/store'
import { RelationIcon } from './RelationIcon'
import { UmlEdgeView } from './UmlEdgeView'
import { UmlNodeView } from './UmlNodeView'

const nodeTypes: NodeTypes = { uml: UmlNodeView }
const edgeTypes: EdgeTypes = { uml: UmlEdgeView }

/** Annotates edges with their position among parallel edges between the same two nodes. */
function withParallelInfo(edges: UmlEdge[]): UmlEdge[] {
  const groups = new Map<string, UmlEdge[]>()
  for (const e of edges) {
    const key = e.source < e.target ? `${e.source}|${e.target}` : `${e.target}|${e.source}`
    groups.set(key, [...(groups.get(key) ?? []), e])
  }
  return edges.map((e) => {
    const group = groups.get(e.source < e.target ? `${e.source}|${e.target}` : `${e.target}|${e.source}`)!
    if (group.length === 1) return e
    return { ...e, data: e.data && { ...e.data, parallelIndex: group.indexOf(e), parallelCount: group.length } }
  })
}

function ConnectHint() {
  const connecting = useConnection((c) => c.inProgress)
  const relation = useEditor((s) => s.relation)
  const empty = useEditor((s) => s.nodes.length === 0)
  if (!connecting && !empty) return null
  return (
    <Panel position="top-center" className="pointer-events-none">
      <div className="flex items-center gap-2 rounded-full border bg-popover/95 px-3 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur">
        {connecting ? (
          <>
            <RelationIcon relation={relation} className="text-foreground" />
            <span className="font-medium text-foreground">{RELATIONS[relation].label}</span>
            <span className="hidden sm:inline">· {RELATIONS[relation].hint}</span>
          </>
        ) : (
          'Double-click anywhere to add a class, or use the toolbar above'
        )}
      </div>
    </Panel>
  )
}

export function Canvas() {
  const { nodes, edges, diagramId, initialViewport } = useEditor(
    useShallow((s) => ({ nodes: s.nodes, edges: s.edges, diagramId: s.diagramId, initialViewport: s.initialViewport })),
  )
  const { onNodesChange, onEdgesChange, onConnect, commit, setViewport, setEditing, addNode } = useEditor.getState()
  const colorMode = useTheme((s) => s.resolved)
  const coarse = useMediaQuery('(pointer: coarse)')
  const { screenToFlowPosition } = useReactFlow()
  const displayEdges = useMemo(() => withParallelInfo(edges), [edges])

  const onDoubleClick = (e: MouseEvent) => {
    if (!(e.target as Element).classList.contains('react-flow__pane')) return
    addNode('class', screenToFlowPosition({ x: e.clientX, y: e.clientY }))
  }

  return (
    <div className="h-full w-full" onDoubleClick={onDoubleClick}>
      <ReactFlow
        key={diagramId}
        nodes={nodes}
        edges={displayEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDelete={commit}
        onNodeDragStop={commit}
        onNodeDoubleClick={(_, node) => setEditing(node.id)}
        onPaneClick={() => setEditing(null)}
        onMoveEnd={(_, vp) => setViewport(vp)}
        defaultViewport={initialViewport}
        fitView={!initialViewport}
        fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
        minZoom={0.1}
        maxZoom={3}
        snapToGrid
        snapGrid={[10, 10]}
        colorMode={colorMode}
        connectionLineType={ConnectionLineType.Straight}
        connectionDragThreshold={4}
        connectOnClick={false}
        deleteKeyCode={['Backspace', 'Delete']}
        multiSelectionKeyCode={['Shift', 'Meta', 'Control']}
        zoomOnDoubleClick={false}
        // Desktop: drag on empty canvas draws a selection box, scroll pans, ctrl/pinch zooms,
        // middle/right drag or space+drag pans. Touch: one-finger drag pans.
        selectionOnDrag={!coarse}
        panOnDrag={coarse ? true : [1, 2]}
        panOnScroll={!coarse}
        selectionMode={SelectionMode.Partial}
        elevateEdgesOnSelect
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable className="max-sm:hidden" />
        <ConnectHint />
      </ReactFlow>
    </div>
  )
}
