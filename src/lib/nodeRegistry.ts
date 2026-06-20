import type { NodeInput, NodeType } from '@/types';

export interface NodeTypeDescriptor {
    label: string;
    description: string;
    defaultInputs: Record<string, NodeInput>;
}

const defaultInput = (value = 0): NodeInput => ({ value, isConnected: false });

const TYPE_REGISTRY: Record<NodeType, NodeTypeDescriptor> = {
    computational: {
        label: 'Computational Node',
        description: 'Evaluates a math formula with per-node modular arithmetic.',
        defaultInputs: { a: defaultInput(), b: defaultInput() },
    },
    logger: {
        label: 'Logger Node',
        description: 'Logs input values on a rising clock edge.',
        defaultInputs: { clock: defaultInput() },
    },
};

export function getDescriptor(type: NodeType): NodeTypeDescriptor {
    return TYPE_REGISTRY[type];
}

export function getDefaultInputs(type: NodeType): Record<string, NodeInput> {
    return structuredClone(TYPE_REGISTRY[type].defaultInputs);
}

export function getAllDescriptors(): Record<NodeType, NodeTypeDescriptor> {
    return TYPE_REGISTRY;
}
