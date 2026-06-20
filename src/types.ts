// ---------------------------------------------------------------------------
// Core data model
// ---------------------------------------------------------------------------

export interface NodeInput {
    value: number;
    isConnected: boolean;
}

export type NodeType = 'computational' | 'logger';

export interface LogEntry {
    timestamp: string;
    data: Record<string, number>;
}

export interface GraphNode {
    id: string;
    name: string;
    type?: NodeType;
    position: { x: number; y: number };
    inputs: Record<string, NodeInput>;
    formula: string;
    useMod2: boolean;
    q: number;
    error: string;
    /** Logger nodes only */
    logHistory?: LogEntry[];
}

export interface Connection {
    sourceId: string;
    targetId: string;
    inputName: string;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export interface Settings {
    initialQ: number;
    modBase: number;
    maxEvalDepth: number;
    delay: number;
    selectionTintStrength: number;
    colorMode: boolean;
}

// ---------------------------------------------------------------------------
// Saved file format
// ---------------------------------------------------------------------------

export interface SavedSetup {
    nodes: GraphNode[];
    connections: Connection[];
    nextNodeId: number;
    settings: Settings;
}

// ---------------------------------------------------------------------------
// Canvas state
// ---------------------------------------------------------------------------

export interface Offset {
    x: number;
    y: number;
}

export interface SelectionBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

// ---------------------------------------------------------------------------
// Prop shapes shared across node components
// ---------------------------------------------------------------------------

export interface BaseNodeProps {
    node: GraphNode;
    updateNode: (id: string, updatedNodeOrFn: GraphNode | ((prev: GraphNode) => GraphNode)) => void;
    deleteNode: (id: string) => void;
    duplicateNode: (node: GraphNode) => void;
    connections: Connection[];
    createConnection: (sourceId: string, targetId: string, inputName: string) => void;
    position: { x: number; y: number };
    onPositionChange: (id: string, pos: { x: number; y: number }) => void;
    allNodes: GraphNode[];
    updateNodeQ: (id: string, newQ: number) => void;
    isSelected: boolean;
    onSelect: (nodeId: string, isShiftKey: boolean) => void;
    handleInputChange: (nodeId: string, inputName: string, value: number) => void;
    settings: Settings;
    onDragStart: (nodeId: string, e: React.MouseEvent) => void;
    transformNode: (node: GraphNode, targetType: NodeType) => void;
}

// ---------------------------------------------------------------------------
// AI helper
// ---------------------------------------------------------------------------

export type AIProvider = 'OPENAI' | 'GEMINI' | 'DEEPSEEK';

export interface ModelConfig {
    provider: AIProvider;
    model: string;
    apiKey: string;
}

export interface AINodeSchema {
    id: string;
    /** AI returns arbitrary strings like "operation" | "constant" | "output" */
    type: string;
    operation?: string;
    formula?: string;
    inputs?: Record<string, unknown>;
}

export interface AIConnectionSchema {
    sourceId: string;
    targetId: string;
    inputName: string;
}

export interface AIParsedResponse {
    nodes: AINodeSchema[];
    connections: AIConnectionSchema[];
}
