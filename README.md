# UML Class Diagram Editor

A UML class diagram editor that runs entirely in the browser. Diagrams are saved to `localStorage`, so the
site is fully static and is deployed to GitHub Pages.

**Live:** https://ayanot1.github.io/uml-editor/

## Features

- Classes, abstract classes, interfaces, enumerations and notes on an infinite, zoomable canvas
- All seven class-diagram relationships: association, directed association, inheritance, realization,
  dependency, aggregation and composition — with labels and multiplicities at both ends
- Inline editing (double-click), plus a properties panel; members support visibility (`+ - # ~`),
  `static` (underlined) and `abstract` (italic)
- Multiple diagrams, autosaved to `localStorage`; undo/redo, copy/paste, duplicate, multi-select
- Export to PNG, SVG, JSON and Mermaid; import JSON; back up / restore all diagrams in one file
- Share links that carry the whole diagram in the URL hash (nothing is uploaded anywhere)
- Light/dark theme, works on touch devices

## Development

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # outputs dist/
npm run lint
```

Built with Vite, React, TypeScript, [React Flow](https://reactflow.dev) (`@xyflow/react`), Tailwind CSS,
shadcn/ui and zustand.

## Deployment

`.github/workflows/deploy.yml` builds on every push and publishes `dist/` to GitHub Pages from the
repository's default branch. In the repository settings, **Pages → Build and deployment → Source** must be
set to **GitHub Actions**.

## Data

Everything lives in this browser's `localStorage` under `uml-editor:*` keys. Clearing site data deletes
your diagrams — use **Export → Back up all diagrams** to keep a copy or move to another browser.
