import type { Connection, GraphNode } from '@/types';

const generateId = () => '_' + Math.random().toString(36).substr(2, 9);

const pos = (x: number, y: number) => ({ x, y });

export function getDemoGraph(): { nodes: GraphNode[]; connections: Connection[] } {
    const id1 = `1-${generateId()}`;
    const id2 = `2-${generateId()}`;
    const id3 = `3-${generateId()}`;
    const id4 = `4-${generateId()}`;

    const nodes: GraphNode[] = [
        {
            id: id1,
            name: 'Input A',
            type: 'computational',
            position: pos(100, 120),
            inputs: {},
            formula: '1',
            useMod2: true,
            q: 1,
            error: '',
        },
        {
            id: id2,
            name: 'Input B',
            type: 'computational',
            position: pos(100, 300),
            inputs: {},
            formula: '1',
            useMod2: true,
            q: 1,
            error: '',
        },
        {
            id: id3,
            name: 'Sum (XOR)',
            type: 'computational',
            position: pos(500, 100),
            inputs: { a: { value: 0, isConnected: false }, b: { value: 0, isConnected: false } },
            formula: 'a + b',
            useMod2: true,
            q: 0,
            error: '',
        },
        {
            id: id4,
            name: 'Carry (AND)',
            type: 'computational',
            position: pos(500, 320),
            inputs: { a: { value: 0, isConnected: false }, b: { value: 0, isConnected: false } },
            formula: 'a * b',
            useMod2: true,
            q: 0,
            error: '',
        },
    ];

    const connections: Connection[] = [
        { sourceId: id1, targetId: id3, inputName: 'a' },
        { sourceId: id2, targetId: id3, inputName: 'b' },
        { sourceId: id1, targetId: id4, inputName: 'a' },
        { sourceId: id2, targetId: id4, inputName: 'b' },
    ];

    // Mark inputs as connected
    nodes[2].inputs.a.isConnected = true;
    nodes[2].inputs.b.isConnected = true;
    nodes[3].inputs.a.isConnected = true;
    nodes[3].inputs.b.isConnected = true;

    return { nodes, connections };
}
