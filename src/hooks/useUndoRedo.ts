import { useCallback, useEffect, useRef, useState } from 'react';
import type { Connection, GraphNode } from '@/types';

interface Snapshot {
    nodes: GraphNode[];
    connections: Connection[];
}

const MAX_HISTORY = 50;

interface UseUndoRedoOptions {
    nodes: GraphNode[];
    connections: Connection[];
    setNodes: React.Dispatch<React.SetStateAction<GraphNode[]>>;
    setConnections: React.Dispatch<React.SetStateAction<Connection[]>>;
}

export function useUndoRedo({
    nodes,
    connections,
    setNodes,
    setConnections,
}: UseUndoRedoOptions) {
    const undoStack = useRef<Snapshot[]>([]);
    const redoStack = useRef<Snapshot[]>([]);
    const isUndoRedo = useRef(false);
    const prevRef = useRef<Snapshot>({ nodes, connections });

    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);

    const updateCanFlags = useCallback(() => {
        setCanUndo(undoStack.current.length > 0);
        setCanRedo(redoStack.current.length > 0);
    }, []);

    // Auto-capture snapshots whenever nodes/connections change (non-undo/redo)
    useEffect(() => {
        if (isUndoRedo.current) {
            isUndoRedo.current = false;
            prevRef.current = { nodes, connections };
            return;
        }
        const prev = prevRef.current;
        // Skip capturing if nothing actually changed
        if (prev.nodes === nodes && prev.connections === connections) return;

        const snapshot = { nodes: structuredClone(prev.nodes), connections: structuredClone(prev.connections) };
        undoStack.current.push(snapshot);
        if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift();
        redoStack.current = [];
        updateCanFlags();
        prevRef.current = { nodes, connections };
    }, [nodes, connections, updateCanFlags]);

    const undo = useCallback(() => {
        const snapshot = undoStack.current.pop();
        if (!snapshot) return;
        // Push current state to redo before restoring
        redoStack.current.push({
            nodes: structuredClone(nodes),
            connections: structuredClone(connections),
        });
        isUndoRedo.current = true;
        setNodes(snapshot.nodes);
        setConnections(snapshot.connections);
        updateCanFlags();
    }, [nodes, connections, setNodes, setConnections, updateCanFlags]);

    const redo = useCallback(() => {
        const snapshot = redoStack.current.pop();
        if (!snapshot) return;
        undoStack.current.push({
            nodes: structuredClone(nodes),
            connections: structuredClone(connections),
        });
        isUndoRedo.current = true;
        setNodes(snapshot.nodes);
        setConnections(snapshot.connections);
        updateCanFlags();
    }, [nodes, connections, setNodes, setConnections, updateCanFlags]);

    return { undo, redo, canUndo, canRedo };
}
