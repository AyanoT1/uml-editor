import { newDiagram, uid, type Diagram, type NodeKind, type Relation, type StoredNode, type UmlNodeData } from './uml'

/** The diagram shown on first launch, demonstrating every element type. */
export function exampleDiagram(): Diagram {
  const d = newDiagram('Example: Pets')
  const node = (kind: NodeKind, x: number, y: number, data: Partial<UmlNodeData>): StoredNode => {
    const n: StoredNode = {
      id: uid(),
      position: { x, y },
      data: { kind, name: '', subtitle: '', stereotype: '', attributes: '', methods: '', text: '', color: 'default', ...data },
    }
    d.nodes.push(n)
    return n
  }
  const edge = (relation: Relation, source: StoredNode, target: StoredNode, labels: Partial<Record<'label' | 'sourceLabel' | 'targetLabel', string>> = {}) => {
    d.edges.push({
      id: uid(),
      source: source.id,
      target: target.id,
      data: { relation, label: '', sourceLabel: '', targetLabel: '', routing: 'straight', readingArrow: true, ...labels },
    })
  }

  const animal = node('abstract', 0, 0, {
    name: 'Animal',
    attributes: '# name: String\n# birthDate: Date',
    methods: '+ getName(): String\n+ getAge(): int\n+ {abstract} makeSound(): String',
    color: 'blue',
  })
  const pet = node('interface', 380, 0, {
    name: 'Pet',
    methods: '+ play(): void\n+ getOwner(): Owner',
    color: 'green',
  })
  const dog = node('class', -120, 300, {
    name: 'Dog',
    attributes: '- breed: String\n- size: Size',
    methods: '+ makeSound(): String\n+ play(): void\n+ getOwner(): Owner',
  })
  const cat = node('class', 170, 300, {
    name: 'Cat',
    attributes: '- indoor: boolean',
    methods: '+ makeSound(): String\n+ play(): void\n+ getOwner(): Owner',
  })
  const owner = node('class', 560, 300, {
    name: 'Owner',
    attributes: '- name: String\n- {static} count: int',
    methods: '+ adopt(pet: Pet): void',
    color: 'yellow',
  })
  const size = node('enum', -120, 560, { name: 'Size', attributes: 'SMALL\nMEDIUM\nLARGE', color: 'purple' })
  const clinic = node('class', 560, 560, { name: 'Clinic', attributes: '- address: String', methods: '+ treat(pet: Pet): void' })
  node('note', 170, 560, {
    text: 'Double-click a class to edit it inline.\nDrag from the dots on its border to connect.\nPick the relationship type in the toolbar.',
  })

  edge('inheritance', dog, animal)
  edge('inheritance', cat, animal)
  edge('realization', dog, pet)
  edge('realization', cat, pet)
  edge('aggregation', pet, owner, { label: 'owns', sourceLabel: '0..*', targetLabel: '1' })
  edge('dependency', dog, size)
  edge('directed', clinic, owner, { label: 'bills', targetLabel: '*' })
  return d
}
