# Computational Framework — Node-based arithmetic graphs with per-node modular arithmetic

This project provides an interactive, node-based system for composing mathematical operations into graphs. Nodes can be connected to form complex computations, including cyclic graphs (loops). A key concept is per-node modular arithmetic: each node can independently enable or disable modular reduction with its own modulus.

At a glance
- Node graph of arithmetic primitives (compose to build complex pipelines)
- Loops supported (cyclic graphs), not just DAGs
- Per-node modular arithmetic (enable/disable; choose modulus per node)
- Built as a TypeScript/Next.js app with Tailwind CSS for UI

Contents
- Overview
- Core concepts
- Modular arithmetic semantics
- Graph execution model
- Project structure
- Getting started
- Using the editor
- Extending the system (adding new nodes)
- Notes on technology
- FAQ
- License

Overview
--------

Computational Framework is a visual and programmatic way to describe arithmetic computations as a graph:

- Each node performs a small mathematical operation (e.g., constant, add, subtract, multiply, divide, modulo, and other arithmetic/utility operations).
- Nodes have access to all mathmatical operations included in mathjs.
- Edges connect node outputs to inputs, allowing you to build pipelines or feedback loops.
- Each node can optionally operate under modular arithmetic with its own modulus. Turning modular arithmetic off for a node makes it operate with standard integer arithmetic.

Core concepts
-------------

- Node
  - A unit of computation with typed inputs and outputs.
  - Has configuration, including a flag to enable modular arithmetic and, if enabled, the modulus value M.
- Ports
  - Inputs and outputs on nodes. Connections (edges) route values between ports.
- Edge
  - Connects an output port of one node to an input port of another.
- Graph
  - A collection of nodes and edges. May be acyclic (DAG) or contain cycles (loops).

Modular arithmetic semantics
----------------------------

- Per-node toggle
  - modEnabled=false: the node performs ordinary integer arithmetic.
  - modEnabled=true, modulus=M: the node reduces its computed value modulo M.
- Typical flow
  - Inputs arrive to a node. The node applies its operation to produce a result.
  - If modular arithmetic is enabled, the result is reduced modulo M before it’s emitted on outputs.
- Practical notes
  - If a node’s operation is not well-defined under a given modulus (e.g., division), the behavior depends on the node’s specific implementation. Common patterns include integer division when modular arithmetic is disabled, and modular inverse–based semantics if implemented for enabled modular arithmetic. Check the node’s configuration/editor hints for the precise rule used.

Graph execution model
---------------------

- Acyclic graphs (DAGs)
  - Evaluated in topological order; values flow from sources (e.g., constants) through edges to sinks.
- Cyclic graphs (loops)
  - Loops are permitted. In cyclic graphs, values typically evolve over “steps” or iterative updates.
  - If a node requires an initial value for a feedback path, provide it in the node configuration (or via dedicated state/memory-style nodes if available).
  - The UI may offer controls to step, run, or reset an execution so you can observe steady-state or time-evolving behavior.

Project structure
-----------------

Repository layout (key paths observed in this repository):

- src/app — Next.js application routes/pages and app bootstrap
- src/components — React components for the UI (node editor, panels, controls, forms)
- src/lib — Core logic and helpers for graph/nodes/execution
- src/utils — Utility functions shared across the app
- src/types.ts — Shared TypeScript types for nodes, edges, ports, configuration, and results
- public — Static assets (icons, images, etc.)
- next.config.ts — Next.js configuration
- tailwind.config.ts, postcss.config.mjs — Tailwind and PostCSS configuration
- package.json, package-lock.json — Project metadata and scripts
- eslint.config.mjs — Lint configuration
- .gitignore — Git ignore rules

Getting started
---------------

Prerequisites
- Node.js 18+ recommended
- npm (ships with Node) or an alternative package manager

Install and run
```bash
git clone https://github.com/JamieLittle16/Computational-Framework.git
cd Computational-Framework

# Install dependencies
npm install

# Start the development server
npm run dev
# Open the app in your browser (usually http://localhost:3000)
```

Build for production
```bash
npm run build
npm run start
```

Lint (if configured)
```bash
npm run lint
```

Using the editor
----------------

- Add nodes: Use the UI to place arithmetic nodes (e.g., constants, add, subtract) onto the canvas.
- Connect nodes: Drag from an output port to an input port to route values.
- Configure nodes:
  - Enable/disable modular arithmetic per node.
  - Set the modulus M when modular arithmetic is enabled.
  - Provide any node-specific parameters (e.g., constant values).
- Evaluate:
  - For DAGs, results propagate immediately based on connections.
  - For cyclic graphs, use step/run controls (if present) to iterate the computation. Configure initial values for feedback paths as needed.

Extending the system (adding new nodes)
---------------------------------------

A typical pattern to add a new node type:

1. Define the operation
   - Add the node’s core compute logic and metadata under src/lib (e.g., node kind, input/output arity, config schema).
   - Ensure the compute function respects per-node modular settings:
     - If modEnabled, reduce the result modulo M.
     - If modDisabled, perform standard integer arithmetic.

2. Define types
   - Add or extend TypeScript types in src/types.ts so the new node integrates with the graph system (ports, config, validation).

3. Add a UI component
   - Create a React component in src/components for the node’s visual representation and configuration form (e.g., toggles, sliders, inputs).

4. Register the node
   - Add the new node to whatever registry/factory the app uses to discover available node types so it appears in the editor’s palette.

5. Test
   - Create example graphs that include the new node (both with modular arithmetic on and off), and verify its behavior in DAGs and loops.

Notes on technology
-------------------

- Framework: Next.js (TypeScript) for the web application.
- Styling: Tailwind CSS (tailwind.config.ts present).
- UI primitives: The repository includes a components.json, which typically accompanies a modern React UI component pipeline.
- Types: Centralized in src/types.ts for nodes, edges, and configuration.
- Static assets: Served from public/.

FAQ
---

- How does modular arithmetic interact with inputs?
  - Nodes compute their result and then apply reduction modulo M if modular arithmetic is enabled for that node.

- Can I mix modular and non-modular nodes in the same graph?
  - Yes. Each node’s modular behavior is independent. You can connect nodes with modular arithmetic to nodes without it and vice versa.

- Are loops allowed?
  - Yes. Loops are supported. Use step/run controls and provide initial values where necessary to ensure well-defined behavior.

License
-------

MIT

Acknowledgements
----------------

Thanks to contributors and library authors whose tools make the node editor and modular arithmetic engine possible.
