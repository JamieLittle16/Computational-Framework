/**
 * Pure evaluation engine — no React deps, fully testable.
 * Used by useNodes.ts; exported here for unit tests.
 */
import * as math from 'mathjs';
import type { Connection, GraphNode, Settings } from '@/types';

export const SAFE_MATH_SCOPE: Record<string, unknown> = {
    abs: math.abs,
    ceil: math.ceil,
    floor: math.floor,
    round: math.round,
    sqrt: math.sqrt,
    cbrt: math.cbrt,
    exp: math.exp,
    log: math.log,
    log2: math.log2,
    log10: math.log10,
    pow: math.pow,
    sign: math.sign,
    min: math.min,
    max: math.max,
    mod: math.mod,
    sin: math.sin,
    cos: math.cos,
    tan: math.tan,
    asin: math.asin,
    acos: math.acos,
    atan: math.atan,
    atan2: math.atan2,
    pi: math.pi,
    e: math.e,
    phi: math.phi,
    tau: math.tau,
    true: true,
    false: false,
};

// ---------------------------------------------------------------------------
// Dependency regex
// ---------------------------------------------------------------------------
export function buildDependencyRegex(nodes: GraphNode[]): RegExp | null {
    if (nodes.length === 0) return null;
    const escaped = nodes
        .map((n) => n.name.replace(/ /g, '_'))
        .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return new RegExp(`\\b(${escaped.join('|')})\\b\\s*\\(`, 'g');
}

// ---------------------------------------------------------------------------
// Extract formula-call dependencies
// ---------------------------------------------------------------------------
export function extractNodeDependencies(
    formula: string,
    allNodes: GraphNode[],
    regex: RegExp | null,
): string[] {
    if (!regex) return [];
    const re = new RegExp(regex.source, regex.flags);
    const deps: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(formula)) !== null) deps.push(m[1]);
    return deps
        .map((name) => allNodes.find((n) => n.name.replace(/ /g, '_') === name)?.id)
        .filter((id): id is string => !!id);
}

// ---------------------------------------------------------------------------
// Topological sort (Kahn's algorithm) with cycle detection
// ---------------------------------------------------------------------------
export function buildSortedOrder(
    nodes: GraphNode[],
    connections: Connection[],
    regex: RegExp | null,
): { sorted: string[]; hasCycle: boolean } {
    const g = new Map<string, string[]>();
    const inDeg = new Map<string, number>();
    nodes.forEach((n) => {
        g.set(n.id, []);
        inDeg.set(n.id, 0);
    });
    connections.forEach((c) => {
        g.get(c.sourceId)?.push(c.targetId);
        inDeg.set(c.targetId, (inDeg.get(c.targetId) ?? 0) + 1);
    });
    nodes.forEach((n) => {
        extractNodeDependencies(n.formula, nodes, regex).forEach((depId) => {
            g.get(depId)?.push(n.id);
            inDeg.set(n.id, (inDeg.get(n.id) ?? 0) + 1);
        });
    });

    const queue: string[] = [];
    inDeg.forEach((d, id) => {
        if (d === 0) queue.push(id);
    });
    const sorted: string[] = [];
    while (queue.length) {
        const id = queue.shift()!;
        sorted.push(id);
        g.get(id)?.forEach((depId) => {
            const nd = (inDeg.get(depId) ?? 1) - 1;
            inDeg.set(depId, nd);
            if (nd === 0) queue.push(depId);
        });
    }
    const hasCycle = sorted.length !== nodes.length;
    if (hasCycle) {
        nodes.forEach((n) => {
            if (!sorted.includes(n.id)) sorted.push(n.id);
        });
    }
    return { sorted, hasCycle };
}

// ---------------------------------------------------------------------------
// Build evaluation scope for a single node
// ---------------------------------------------------------------------------
export function createEvaluationScope(
    node: GraphNode,
    allNodes: GraphNode[],
    conns: Connection[],
): Record<string, unknown> {
    const scope: Record<string, unknown> = { ...SAFE_MATH_SCOPE, q: node.q, Q: node.q };
    Object.entries(node.inputs).forEach(([name, input]) => {
        if (input.isConnected) {
            const c = conns.find((x) => x.targetId === node.id && x.inputName === name);
            scope[name] = c ? (allNodes.find((n) => n.id === c.sourceId)?.q ?? 0) : 0;
        } else {
            scope[name] = input.value;
        }
    });
    allNodes.forEach((n) => {
        scope[n.name.replace(/ /g, '_')] = () => allNodes.find((nn) => nn.id === n.id)?.q ?? 0;
    });
    return scope;
}

// ---------------------------------------------------------------------------
// Evaluate a single node's formula
// ---------------------------------------------------------------------------
export function evaluateNodeFormula(node: GraphNode, scope: Record<string, unknown>): number {
    let result: unknown;
    try {
        result = math.evaluate(node.formula, scope);
    } catch (e) {
        throw new Error(`Formula error: ${(e as Error).message}`);
    }
    if (typeof result !== 'number' || isNaN(result)) return 0;
    return result;
}

// ---------------------------------------------------------------------------
// Run one full evaluation pass across all nodes in sorted order
// ---------------------------------------------------------------------------
export function runEvaluationPass(
    nodes: GraphNode[],
    connections: Connection[],
    settings: Settings,
): GraphNode[] {
    const regex = buildDependencyRegex(nodes);
    const { sorted } = buildSortedOrder(nodes, connections, regex);
    const updated = nodes.map((n) => ({ ...n }));

    sorted.forEach((id) => {
        const node = updated.find((n) => n.id === id);
        if (!node) return;
        const scope = createEvaluationScope(node, updated, connections);
        let newQ: number;
        let error = '';
        try {
            newQ = evaluateNodeFormula(node, scope);
            if (node.useMod2) {
                newQ = ((newQ % settings.modBase) + settings.modBase) % settings.modBase;
            }
        } catch (e) {
            newQ = 0;
            error = (e as Error).message;
        }
        node.q = newQ;
        node.error = error;
    });

    return updated;
}
