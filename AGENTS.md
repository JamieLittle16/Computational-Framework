# AGENTS.md

## Commands

```bash
npm install          # install deps
npm run dev          # Next.js dev server on localhost:3000 (uses Turbopack)
npm run build        # production build
npm run lint         # ESLint (next/core-web-vitals + next/typescript)
npm test             # Vitest unit tests (26 tests, run once)
npm run test:watch   # Vitest in watch mode
```

No typecheck script — use `tsc --noEmit` to check types.

Recommended verification order before committing: `lint → tsc --noEmit → test → build`

## Architecture

Single-page Next.js 15 app. State is managed through 5 custom hooks in `src/hooks/`, composed by `ComputationalFramework.tsx`:

```
src/hooks/
├── useNodes.ts         ← node state, CRUD, selection, evaluation (delegates to evaluationEngine.ts)
├── useConnections.ts   ← connection state, CRUD, selection
├── useCanvas.ts        ← panning, zoom, dragging, marquee selection
├── useKeyboard.ts      ← Ctrl+C/V, Delete, Ctrl+Z/Y keybindings
└── useUndoRedo.ts      ← auto-capture snapshot stack (50 max)
```

```
src/lib/
├── evaluationEngine.ts  ← pure eval logic (buildSortedOrder, runEvaluationPass etc.) — no React, testable
├── nodeRegistry.ts      ← NodeType descriptors + default inputs
└── demoGraph.ts         ← half-adder demo loaded on first visit
```

```
ComputationalFramework.tsx  ← composes hooks + renders UI
├── ComputationalNode.tsx   ← thin wrapper around BaseNode (Q value, formula, mod toggle)
├── BaseNode.tsx            ← shared card (header, inputs, drag, selection overlay)
├── LoggerNode.tsx          ← clock-triggered logger (node.type === 'logger')
├── AIHelper.tsx            ← modal; calls /api/ai server-side proxy
├── NodePalette.tsx         ← typed node creation Sheet (closes on selection)
├── ShortcutsPanel.tsx      ← keyboard shortcuts reference Sheet
├── Minimap.tsx             ← bottom-right birds-eye overlay
├── SettingsPanel.tsx       ← settings sheet
└── basePrompt.ts           ← AI system prompt
```

**Cross-hook wiring:** `useNodes` ↔ `useConnections` have circular deps — solved with ref bridging. The framework creates `MutableRefObject`s as noops, calls both hooks, then populates `.current`. Safe because refs are only read at runtime, not during hook construction.

`src/utils/colourUtils.ts` — HSV→RGB conversion.  
`src/types.ts` — all shared types, imported everywhere.  
`src/lib/utils.ts` — shadcn `cn()` helper.  
`src/app/api/ai/route.ts` — server-side AI proxy (POST).

## Tests

```
src/__tests__/evaluationEngine.test.ts  ← 26 unit tests
```
Covers: `buildDependencyRegex`, topological sort (`buildSortedOrder`), cycle detection, `createEvaluationScope`, `evaluateNodeFormula`, `runEvaluationPass` (XOR, AND, half-adder, modular reduction, formula errors).

## Known Architectural Issues (tracked for refactor)

- `ComputationalNode.tsx` now renders through `BaseNode.tsx` (Phase 5 refactor). The duplication has been resolved. `LoggerNode.tsx` also renders through `BaseNode`.

## Toolchain Quirks

- **`tsconfig.json`** includes a non-existent path: `"src/components/computational-framework.jsx"` — harmless but incorrect; don't replicate this pattern.
- **shadcn/ui** components are in `src/components/ui/`. The `components.json` config uses `"rsc": true` but all pages use `'use client'` — shadcn RSC setting is effectively unused.
- **`math.evaluate()`** from mathjs runs user-supplied formulas against a whitelisted scope (`SAFE_MATH_SCOPE` in `ComputationalFramework.jsx`). Do not expand this scope with `...math` — it was a prior security gap that has been fixed.
- **AI API keys** are resolved server-side in `src/app/api/ai/route.ts`. `AIHelper.jsx` sends requests to `/api/ai` — the client never calls provider APIs directly. Keys can be pre-configured via env vars (`OPENAI_API_KEY`, `GEMINI_API_KEY`, `DEEPSEEK_API_KEY` — see `.env.local.example`). Users may also supply their own key in the AI Helper panel; it is forwarded to the server, not to the AI provider directly.

## Dependencies to Know

- `sonner` — toast notifications (used). `sooner` and `toast` are also in `package.json` — typo/leftovers, not used.
- `@google/generative-ai` — in `package.json` but unused; raw `fetch` is used for all AI calls instead.
- `mathjs` — formula evaluation engine for nodes.
- `lodash` (`isEqual`) — used only in `src/hooks/useNodes.ts` for the evaluation engine's deep-equality check before committing updated nodes to state. Components no longer use it for memoization.

## Style Conventions

- shadcn/ui components via Radix primitives; Tailwind CSS for all styling.
- CSS Modules (`*.module.css`) exist for `ComputationalFramework` and `ComputationalNode`/`SettingsPanel` — the latter two are intentionally empty.
- **Prettier** is configured (`.prettierrc`): 4-space tabs, single quotes, trailing commas, 100 char width. Run `npx prettier --write "src/**/*.{ts,tsx}"` before committing.
- The `ComputationalFramework.module.css` is imported for the `.selectedNode` and `.overlay` classes only.
