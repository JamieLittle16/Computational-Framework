import { describe, it, expect } from 'vitest';
import {
    buildDependencyRegex,
    buildSortedOrder,
    createEvaluationScope,
    evaluateNodeFormula,
    runEvaluationPass,
} from '../lib/evaluationEngine';
import type { GraphNode, Connection, Settings } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNode(
    id: string,
    name: string,
    formula: string,
    inputs: Record<string, { value: number; isConnected: boolean }> = {},
    q = 0,
    useMod2 = false,
): GraphNode {
    return { id, name, type: 'computational', position: { x: 0, y: 0 }, inputs, formula, useMod2, q, error: '' };
}

function makeConn(sourceId: string, targetId: string, inputName: string): Connection {
    return { sourceId, targetId, inputName };
}

const BASE_SETTINGS: Settings = {
    initialQ: 0, modBase: 2, maxEvalDepth: 100, delay: 100, selectionTintStrength: 0.15, colorMode: false,
};

// ---------------------------------------------------------------------------
// buildDependencyRegex
// ---------------------------------------------------------------------------

describe('buildDependencyRegex', () => {
    it('returns null when no nodes', () => {
        expect(buildDependencyRegex([])).toBeNull();
    });

    it('builds a regex that matches node name function calls', () => {
        const nodes = [makeNode('1', 'Alpha', ''), makeNode('2', 'Beta Node', '')];
        const re = buildDependencyRegex(nodes)!;
        expect(re).not.toBeNull();
        // Reset lastIndex before each test() call since the regex has the 'g' flag
        re.lastIndex = 0;
        expect(re.test('Alpha(')).toBe(true);
        re.lastIndex = 0;
        expect(re.test('Beta_Node(')).toBe(true); // spaces → underscores in formula refs
        re.lastIndex = 0;
        expect(re.test('Gamma(')).toBe(false);
    });

    it('escapes special regex chars in node names', () => {
        const nodes = [makeNode('1', 'Node.Plus', '')];
        // Should not throw — the dot is escaped
        expect(() => buildDependencyRegex(nodes)).not.toThrow();
    });
});

// ---------------------------------------------------------------------------
// buildSortedOrder — topological sort
// ---------------------------------------------------------------------------

describe('buildSortedOrder', () => {
    it('single node — returns that node', () => {
        const nodes = [makeNode('a', 'A', '')];
        const { sorted, hasCycle } = buildSortedOrder(nodes, [], null);
        expect(sorted).toEqual(['a']);
        expect(hasCycle).toBe(false);
    });

    it('linear chain A → B → C respects order', () => {
        const nodes = [makeNode('a', 'A', ''), makeNode('b', 'B', ''), makeNode('c', 'C', '')];
        const conns = [makeConn('a', 'b', 'x'), makeConn('b', 'c', 'x')];
        const { sorted, hasCycle } = buildSortedOrder(nodes, conns, null);
        expect(hasCycle).toBe(false);
        expect(sorted.indexOf('a')).toBeLessThan(sorted.indexOf('b'));
        expect(sorted.indexOf('b')).toBeLessThan(sorted.indexOf('c'));
    });

    it('fan-in: both sources before the sink', () => {
        const a = makeNode('a', 'A', '');
        const b = makeNode('b', 'B', '');
        const c = makeNode('c', 'C', '', { x: { value: 0, isConnected: true }, y: { value: 0, isConnected: true } });
        const conns = [makeConn('a', 'c', 'x'), makeConn('b', 'c', 'y')];
        const { sorted, hasCycle } = buildSortedOrder([a, b, c], conns, null);
        expect(hasCycle).toBe(false);
        expect(sorted.indexOf('a')).toBeLessThan(sorted.indexOf('c'));
        expect(sorted.indexOf('b')).toBeLessThan(sorted.indexOf('c'));
    });

    it('detects cycle and still returns all node IDs', () => {
        const a = makeNode('a', 'A', '');
        const b = makeNode('b', 'B', '');
        const conns = [makeConn('a', 'b', 'x'), makeConn('b', 'a', 'y')];
        const { sorted, hasCycle } = buildSortedOrder([a, b], conns, null);
        expect(hasCycle).toBe(true);
        expect(sorted).toHaveLength(2);
        expect(sorted).toContain('a');
        expect(sorted).toContain('b');
    });

    it('disconnected nodes all appear in output', () => {
        const nodes = [makeNode('a', 'A', ''), makeNode('b', 'B', ''), makeNode('c', 'C', '')];
        const { sorted, hasCycle } = buildSortedOrder(nodes, [], null);
        expect(hasCycle).toBe(false);
        expect(sorted).toHaveLength(3);
    });
});

// ---------------------------------------------------------------------------
// createEvaluationScope
// ---------------------------------------------------------------------------

describe('createEvaluationScope', () => {
    it('exposes node q as q and Q', () => {
        const node = makeNode('a', 'A', '', {}, 7);
        const scope = createEvaluationScope(node, [node], []);
        expect(scope.q).toBe(7);
        expect(scope.Q).toBe(7);
    });

    it('resolves unconnected input from value', () => {
        const node = makeNode('a', 'A', '', { x: { value: 42, isConnected: false } });
        const scope = createEvaluationScope(node, [node], []);
        expect(scope.x).toBe(42);
    });

    it('resolves connected input from source node q', () => {
        const src = makeNode('src', 'Src', '', {}, 99);
        const tgt = makeNode('tgt', 'Tgt', '', { x: { value: 0, isConnected: true } });
        const conn = makeConn('src', 'tgt', 'x');
        const scope = createEvaluationScope(tgt, [src, tgt], [conn]);
        expect(scope.x).toBe(99);
    });

    it('exposes other nodes as callable functions', () => {
        const a = makeNode('a', 'Alpha', '', {}, 3);
        const b = makeNode('b', 'Beta', '', {}, 5);
        const scope = createEvaluationScope(a, [a, b], []);
        expect(typeof scope['Beta']).toBe('function');
        expect((scope['Beta'] as () => number)()).toBe(5);
    });
});

// ---------------------------------------------------------------------------
// evaluateNodeFormula
// ---------------------------------------------------------------------------

describe('evaluateNodeFormula', () => {
    it('evaluates a simple arithmetic formula', () => {
        const node = makeNode('a', 'A', 'a + b', { a: { value: 3, isConnected: false }, b: { value: 4, isConnected: false } });
        const scope = createEvaluationScope(node, [node], []);
        expect(evaluateNodeFormula(node, scope)).toBe(7);
    });

    it('returns 0 for empty formula', () => {
        const node = makeNode('a', 'A', '');
        const scope = createEvaluationScope(node, [node], []);
        expect(evaluateNodeFormula(node, scope)).toBe(0);
    });

    it('throws on invalid formula', () => {
        const node = makeNode('a', 'A', 'a +++ b');
        const scope = createEvaluationScope(node, [node], []);
        expect(() => evaluateNodeFormula(node, scope)).toThrow('Formula error');
    });

    it('uses q (current node value) in formula', () => {
        const node = makeNode('a', 'A', 'q + 1', {}, 5);
        const scope = createEvaluationScope(node, [node], []);
        expect(evaluateNodeFormula(node, scope)).toBe(6);
    });

    it('evaluates mathjs built-ins (sqrt, floor)', () => {
        const node = makeNode('a', 'A', 'floor(sqrt(16))');
        const scope = createEvaluationScope(node, [node], []);
        expect(evaluateNodeFormula(node, scope)).toBe(4);
    });
});

// ---------------------------------------------------------------------------
// runEvaluationPass — integration
// ---------------------------------------------------------------------------

describe('runEvaluationPass', () => {
    it('constant node evaluates to its formula value', () => {
        const node = makeNode('a', 'A', '42');
        const result = runEvaluationPass([node], [], BASE_SETTINGS);
        expect(result[0].q).toBe(42);
    });

    it('chain: A=1, B=A+1 → B should be 2', () => {
        const a = makeNode('a', 'A', '1');
        const b = makeNode('b', 'B', 'x + 1', { x: { value: 0, isConnected: true } });
        const conn = makeConn('a', 'b', 'x');
        const result = runEvaluationPass([a, b], [conn], BASE_SETTINGS);
        const bNode = result.find((n) => n.id === 'b')!;
        expect(bNode.q).toBe(2);
    });

    // ---- Modular arithmetic ----
    describe('modular arithmetic (modBase=2)', () => {
        const MOD2: Settings = { ...BASE_SETTINGS, modBase: 2 };

        it('XOR gate: 1+1 mod 2 = 0', () => {
            const a = makeNode('a', 'A', '1');
            const b = makeNode('b', 'B', '1');
            const xor = makeNode('xor', 'XOR', 'x + y', { x: { value: 0, isConnected: true }, y: { value: 0, isConnected: true } }, 0, true);
            const result = runEvaluationPass(
                [a, b, xor],
                [makeConn('a', 'xor', 'x'), makeConn('b', 'xor', 'y')],
                MOD2,
            );
            expect(result.find((n) => n.id === 'xor')!.q).toBe(0); // 1+1=2≡0 mod 2
        });

        it('AND gate: 1*1 mod 2 = 1', () => {
            const a = makeNode('a', 'A', '1');
            const b = makeNode('b', 'B', '1');
            const and = makeNode('and', 'AND', 'x * y', { x: { value: 0, isConnected: true }, y: { value: 0, isConnected: true } }, 0, true);
            const result = runEvaluationPass(
                [a, b, and],
                [makeConn('a', 'and', 'x'), makeConn('b', 'and', 'y')],
                MOD2,
            );
            expect(result.find((n) => n.id === 'and')!.q).toBe(1);
        });

        it('AND gate: 1*0 mod 2 = 0', () => {
            const a = makeNode('a', 'A', '1');
            const b = makeNode('b', 'B', '0');
            const and = makeNode('and', 'AND', 'x * y', { x: { value: 0, isConnected: true }, y: { value: 0, isConnected: true } }, 0, true);
            const result = runEvaluationPass(
                [a, b, and],
                [makeConn('a', 'and', 'x'), makeConn('b', 'and', 'y')],
                MOD2,
            );
            expect(result.find((n) => n.id === 'and')!.q).toBe(0);
        });

        it('half-adder: inputs 1,1 → sum=0 carry=1', () => {
            const a = makeNode('a', 'A', '1');
            const b = makeNode('b', 'B', '1');
            const sum = makeNode('sum', 'Sum', 'x + y', { x: { value: 0, isConnected: true }, y: { value: 0, isConnected: true } }, 0, true);
            const carry = makeNode('carry', 'Carry', 'x * y', { x: { value: 0, isConnected: true }, y: { value: 0, isConnected: true } }, 0, true);
            const nodes = [a, b, sum, carry];
            const conns = [
                makeConn('a', 'sum', 'x'), makeConn('b', 'sum', 'y'),
                makeConn('a', 'carry', 'x'), makeConn('b', 'carry', 'y'),
            ];
            const result = runEvaluationPass(nodes, conns, MOD2);
            expect(result.find((n) => n.id === 'sum')!.q).toBe(0);   // 1+1 = 0 mod 2
            expect(result.find((n) => n.id === 'carry')!.q).toBe(1); // 1*1 = 1 mod 2
        });

        it('mod disabled: 1+1 without mod = 2 (not reduced)', () => {
            const a = makeNode('a', 'A', '1');
            const b = makeNode('b', 'B', '1');
            // useMod2=false → no modular reduction
            const add = makeNode('add', 'Add', 'x + y', { x: { value: 0, isConnected: true }, y: { value: 0, isConnected: true } }, 0, false);
            const result = runEvaluationPass(
                [a, b, add],
                [makeConn('a', 'add', 'x'), makeConn('b', 'add', 'y')],
                MOD2,
            );
            expect(result.find((n) => n.id === 'add')!.q).toBe(2);
        });
    });

    it('formula error recorded on node without crashing', () => {
        const node = makeNode('a', 'A', '@@invalid@@');
        const result = runEvaluationPass([node], [], BASE_SETTINGS);
        expect(result[0].q).toBe(0);
        expect(result[0].error).toMatch(/Formula error/);
    });

    it('node with modBase=5: 7 mod 5 = 2', () => {
        const node = makeNode('a', 'A', '7', {}, 0, true);
        const result = runEvaluationPass([node], [], { ...BASE_SETTINGS, modBase: 5 });
        expect(result[0].q).toBe(2);
    });
});
