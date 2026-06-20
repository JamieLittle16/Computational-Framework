# Computational Framework

> An interactive node-based editor for composing mathematical operations into computation graphs, with per-node modular arithmetic and AI-assisted node generation.

**[Live Demo](https://computational-framework.vercel.app)** · [Report a bug](https://github.com/JamieLittle16/Computational-Framework/issues)

---

## Features

| Feature | Description |
|---------|-------------|
| **Visual node editor** | Drag-and-drop canvas with pan (middle-click / alt-drag) and zoom (Ctrl+scroll) |
| **Arithmetic formulas** | Each node evaluates any [mathjs](https://mathjs.org) expression — `a + b`, `floor(sqrt(q))`, etc. |
| **Per-node modular arithmetic** | Toggle modulo reduction per node with a configurable base (default: mod 2) |
| **Cyclic graphs** | Loops are supported; the `q` variable exposes each node's own previous value for feedback |
| **Animated connections** | Wires show animated flow direction with arrowheads |
| **Undo / Redo** | Full undo/redo stack (Ctrl+Z / Ctrl+Shift+Z) with 50-snapshot history |
| **Dark mode** | One-click toggle; persists via `localStorage` |
| **Node palette** | Create Computational or Logger nodes from a typed palette |
| **Logger node** | Clock-triggered input logger — records values on every rising edge |
| **AI node generator** | Describe a computation in plain English; GPT-4, Gemini, or DeepSeek generates the graph |
| **Save / Load** | Export and re-import graphs as JSON |
| **Minimap** | Birds-eye view of the graph in the bottom-right corner |
| **Demo graph** | A half-adder circuit loads automatically on first visit |

---

## Getting started

### Prerequisites

- **Node.js 18+**
- npm (included with Node) or an alternative package manager

### Install and run

```bash
git clone https://github.com/JamieLittle16/Computational-Framework.git
cd Computational-Framework
npm install
npm run dev          # → http://localhost:3000
```

### Production build

```bash
npm run build
npm start
```

### Run tests

```bash
npm test             # run once
npm run test:watch   # watch mode
npm run test:coverage
```

---

## AI Helper setup

The AI node generator calls AI providers **server-side** — your API keys are never sent from the browser to the AI providers directly.

To use a pre-configured key (e.g. for a live demo), set environment variables:

```bash
# .env.local  (see .env.local.example for the full template)
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AIza...
DEEPSEEK_API_KEY=sk-...
```

Users can also enter their own key in the AI Helper panel; it will be forwarded to the server proxy and used for that request only.

---

## Using the editor

### Canvas navigation

| Action | Gesture |
|--------|---------|
| Pan | Middle-click drag · Alt + left-drag |
| Zoom | Ctrl/⌘ + scroll wheel |
| Select node | Click |
| Multi-select | Shift+click · Drag marquee |
| Select connection | Click wire |

### Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+C / Ctrl+V | Copy / Paste selected nodes |
| Delete / Backspace | Delete selected nodes or connections |
| Ctrl+Z | Undo |
| Ctrl+Shift+Z / Ctrl+Y | Redo |

### Creating nodes

- **Add Node** — places a default Computational node at the canvas centre
- **Node Types** — opens the palette to choose between Computational and Logger nodes
- **AI Helper** — describe what you want in natural language

### Writing formulas

Formulas are evaluated by [mathjs](https://mathjs.org). Available in scope:

- All standard inputs by name: `a`, `b`, `x`, etc.
- `q` / `Q` — current node value (enables feedback loops)
- Any other node by name: `Node_A()`, `Sum()`
- Math built-ins: `abs`, `sqrt`, `floor`, `sin`, `pi`, `e`, …

**Boolean / logic (mod 2):**

```
+  →  XOR   (addition mod 2)
*  →  AND   (multiplication mod 2)
```

Example — D flip-flop:
```
a * (q + b) + q
```

---

## Architecture

```
src/
├── app/
│   ├── page.tsx                    ← root page (wraps in ErrorBoundary)
│   └── api/ai/route.ts             ← server-side AI proxy
├── components/
│   ├── ErrorBoundary.tsx
│   └── computational-framework/
│       ├── ComputationalFramework.tsx   ← canvas + hook composition (~225 LOC)
│       ├── ComputationalNode.tsx        ← thin wrapper around BaseNode
│       ├── BaseNode.tsx                 ← shared node card (header, inputs, drag)
│       ├── LoggerNode.tsx               ← clock-triggered logger
│       ├── AIHelper.tsx                 ← AI generation modal
│       ├── NodePalette.tsx              ← node type picker sidebar
│       ├── ShortcutsPanel.tsx           ← keyboard shortcuts reference
│       ├── Minimap.tsx                  ← birds-eye canvas view
│       └── SettingsPanel.tsx            ← framework settings sheet
├── hooks/
│   ├── useNodes.ts          ← node state, CRUD, evaluation
│   ├── useConnections.ts    ← connection state & CRUD
│   ├── useCanvas.ts         ← pan, zoom, drag, selection
│   ├── useKeyboard.ts       ← keyboard shortcuts
│   └── useUndoRedo.ts       ← undo/redo snapshot stack
└── lib/
    ├── evaluationEngine.ts  ← pure evaluation logic (testable)
    ├── nodeRegistry.ts      ← node type descriptors
    └── demoGraph.ts         ← first-visit half-adder demo
```

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router, Turbopack) |
| Language | TypeScript 5 (strict) |
| Styling | Tailwind CSS + shadcn/ui (Radix primitives) |
| Math engine | mathjs |
| Testing | Vitest (26 unit tests) |
| Toasts | Sonner |
| State | React hooks (no external state library) |

---

## License

MIT — see [LICENSE](./LICENSE).
