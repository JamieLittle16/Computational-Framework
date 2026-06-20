import { useCallback, useEffect, useRef, useState } from 'react';
import type { Connection, GraphNode, Settings, NodeType } from '@/types';
import {
    buildDependencyRegex,
    buildSortedOrder,
    createEvaluationScope,
    evaluateNodeFormula,
} from '@/lib/evaluationEngine';

const generateUniqueId = () => '_' + Math.random().toString(36).substr(2, 9);

interface UseNodesOptions {
    settings: Settings;
    settingsRef: React.MutableRefObject<Settings>;
    connectionsRef: React.MutableRefObject<Connection[]>;
    setConnectionsFnRef: React.MutableRefObject<React.Dispatch<React.SetStateAction<Connection[]>>>;
    setSelectedConnectionsFnRef: React.MutableRefObject<
        React.Dispatch<React.SetStateAction<Set<string>>>
    >;
}

export function useNodes({
    settings,
    settingsRef,
    connectionsRef,
    setConnectionsFnRef,
    setSelectedConnectionsFnRef,
}: UseNodesOptions) {
    const [nodes, setNodes] = useState<GraphNode[]>([]);
    const [nextNodeId, setNextNodeId] = useState(1);
    const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());
    const nodesRef = useRef<GraphNode[]>(nodes);
    const copiedNodesRef = useRef<Omit<GraphNode, 'id'>[]>([]);
    const [cachedDependencyGraph, setCachedDependencyGraph] = useState<string[] | null>(null);
    const inputTimeoutIdsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

    useEffect(() => {
        nodesRef.current = nodes;
    }, [nodes]);

    // Stably expose setNodes + cache invalidation via refs for cross-hook wiring
    const setNodesFnRef = useRef<React.Dispatch<React.SetStateAction<GraphNode[]>>>(setNodes);
    setNodesFnRef.current = setNodes;

    const invalidateCache = useCallback(() => {
        setCachedDependencyGraph(null);
    }, []);
    const invalidateCacheRef = useRef<() => void>(invalidateCache);
    invalidateCacheRef.current = invalidateCache;
    const buildDependencyGraph = useCallback((): string[] => {
        const { sorted } = buildSortedOrder(
            nodesRef.current,
            connectionsRef.current,
            buildDependencyRegex(nodesRef.current),
        );
        return sorted;
    }, [connectionsRef]);

    // ---- Evaluation engine ----
    const evaluateAllNodes = useCallback(() => {
        const curNodes = nodesRef.current.map((n) => ({ ...n }));
        const curConns = [...connectionsRef.current];
        const curSettings = settingsRef.current;
        let sorted = cachedDependencyGraph;
        if (!sorted) {
            sorted = buildDependencyGraph();
            setCachedDependencyGraph(sorted);
        }

        let hasUpdates = false;
        const updated = curNodes.map((n) => ({ ...n }));

        sorted.forEach((id) => {
            const node = updated.find((n) => n.id === id);
            if (!node) return;

            // Scope for evaluating formula:
            // 1. Current node's Q value (from start of tick)
            // 2. Named node references (e.g. Node_1) from updated (so downstream sees new upstream)
            // 3. Inputs from updated (so connected inputs see new upstream)
            const scope = createEvaluationScope(node, updated, curConns);

            // IMPORTANT: Manually override 'q' and 'Q' to the value from the START of the tick
            // to allow expressions like q + 1 to increment predictably once per tick.
            const originalNode = curNodes.find((n) => n.id === id);
            if (originalNode) {
                scope.q = originalNode.q;
                scope.Q = originalNode.q;
            }

            let newQ: number,
                err = '';
            try {
                newQ = evaluateNodeFormula(node, scope);
                if (node.useMod2)
                    newQ =
                        ((newQ % curSettings.modBase) + curSettings.modBase) % curSettings.modBase;
            } catch (e) {
                newQ = 0;
                err = (e as Error).message;
            }
            if (node.q !== newQ || node.error !== err) {
                node.q = newQ;
                node.error = err;
                hasUpdates = true;
            }
        });
        if (hasUpdates) setNodes(updated);
    }, [connectionsRef, settingsRef, cachedDependencyGraph, buildDependencyGraph]);

    // ---- CRUD ----
    const updateNode = useCallback(
        (id: string, val: GraphNode | ((prev: GraphNode) => GraphNode)) => {
            setNodes((prev) =>
                prev.map((n) => (n.id === id ? (typeof val === 'function' ? val(n) : val) : n)),
            );
            setCachedDependencyGraph(null);
        },
        [],
    );

    const createNode = useCallback(
        (
            nodeData?: Partial<GraphNode> | null,
            containerRef?: React.RefObject<HTMLElement | null>,
            offset?: { x: number; y: number },
        ) => {
            const newId = `${nextNodeId}-${generateUniqueId()}`;
            let pos = nodeData?.position ?? { x: 100, y: 100 };
            if (!nodeData && containerRef?.current) {
                const r = containerRef.current.getBoundingClientRect();
                const off = offset ?? { x: 0, y: 0 };
                pos = { x: r.width / 2 - 160 - off.x, y: r.height / 2 - 100 - off.y };
            }
            const newNode: GraphNode = {
                inputs: {},
                formula: '',
                useMod2: true,
                q: settingsRef.current.initialQ,
                error: '',
                ...(nodeData ?? {}),
                id: nodeData?.id ?? newId,
                name: nodeData?.name ?? `Node ${nextNodeId}`,
                position: pos,
            };
            setNodes((prev) => [...prev, newNode]);
            const prefix = parseInt(newId.split('-')[0], 10);
            if (!isNaN(prefix)) setNextNodeId((p) => Math.max(p, prefix + 1));
            setCachedDependencyGraph(null);
        },
        [nextNodeId, settingsRef],
    );

    const deleteNode = useCallback(
        (id: string) => {
            setNodes((prev) => prev.filter((n) => n.id !== id));
            setConnectionsFnRef.current((prev) =>
                prev.filter((c) => c.sourceId !== id && c.targetId !== id),
            );
            setCachedDependencyGraph(null);
        },
        [setConnectionsFnRef],
    );

    const duplicateNode = useCallback(
        (node: GraphNode) => {
            const newId = `${nextNodeId}-${generateUniqueId()}`;
            setNodes((prev) => [
                ...prev,
                {
                    ...node,
                    id: newId,
                    name: `${node.name} (copy)`,
                    position: { x: node.position.x + 50, y: node.position.y + 50 },
                },
            ]);
            setNextNodeId((p) => p + 1);
            setCachedDependencyGraph(null);
        },
        [nextNodeId],
    );

    const updateNodeQ = useCallback((id: string, q: number) => {
        setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, q } : n)));
    }, []);

    const handleNodeInputChange = useCallback(
        (nodeId: string, inputName: string, value: number) => {
            const ids = inputTimeoutIdsRef.current;
            if (ids.get(nodeId)) clearTimeout(ids.get(nodeId));
            const tid = setTimeout(() => {
                ids.delete(nodeId);
                setNodes((prev) =>
                    prev.map((n) =>
                        n.id === nodeId
                            ? {
                                  ...n,
                                  inputs: {
                                      ...n.inputs,
                                      [inputName]: { ...n.inputs[inputName], value },
                                  },
                              }
                            : n,
                    ),
                );
            }, settings.delay / 2);
            ids.set(nodeId, tid);
        },
        [settings.delay],
    );

    // ---- Selection ----
    const handleNodeSelect = useCallback((nodeId: string, isShiftKey: boolean) => {
        setSelectedNodes((prev) => {
            const next = new Set(prev);
            if (isShiftKey) {
                if (next.has(nodeId)) next.delete(nodeId);
                else next.add(nodeId);
            } else {
                if (next.size === 1 && next.has(nodeId)) next.clear();
                else {
                    next.clear();
                    next.add(nodeId);
                }
            }
            return next;
        });
    }, []);

    const copySelectedNodes = useCallback(() => {
        copiedNodesRef.current = nodes
            .filter((n) => selectedNodes.has(n.id))
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            .map(({ id: _id, ...rest }) => rest);
    }, [nodes, selectedNodes]);

    const pasteCopiedNodes = useCallback(
        (containerRef: React.RefObject<HTMLElement | null>, offset: { x: number; y: number }) => {
            if (!copiedNodesRef.current.length || !containerRef.current) return;
            const r = containerRef.current.getBoundingClientRect();
            const cx = r.width / 2 - 160 - offset.x;
            const cy = r.height / 2 - 100 - offset.y;
            let c = nextNodeId;
            const newNodes: GraphNode[] = copiedNodesRef.current.map((d, i) => ({
                ...d,
                id: `${c++}-${generateUniqueId()}`,
                name: `${d.name} (copy)`,
                position: { x: cx + i * 20, y: cy + i * 20 },
            }));
            setNodes((prev) => [...prev, ...newNodes]);
            setNextNodeId(c);
            setCachedDependencyGraph(null);
        },
        [nextNodeId],
    );

    const deleteSelectedNodes = useCallback(() => {
        selectedNodes.forEach((id) => deleteNode(id));
        setSelectedNodes(new Set());
        setSelectedConnectionsFnRef.current(new Set());
    }, [selectedNodes, deleteNode, setSelectedConnectionsFnRef]);

    // ---- Transform ----
    const transformNode = useCallback(
        (node: GraphNode, targetType: NodeType) => {
            const base: GraphNode = { ...node, type: targetType, error: '' };
            if (targetType === 'logger') {
                base.formula = '';
                base.logHistory = node.logHistory ?? [];
                if (!base.inputs['clock'])
                    base.inputs = { ...base.inputs, clock: { value: 0, isConnected: false } };
            } else {
                delete base.logHistory;
            }
            updateNode(node.id, base);
            setCachedDependencyGraph(null);
        },
        [updateNode],
    );

    return {
        nodes,
        setNodes,
        nodesRef,
        nextNodeId,
        selectedNodes,
        setSelectedNodes,
        copiedNodesRef,
        createNode,
        updateNode,
        deleteNode,
        duplicateNode,
        updateNodeQ,
        handleNodeInputChange,
        handleNodeSelect,
        copySelectedNodes,
        pasteCopiedNodes,
        deleteSelectedNodes,
        evaluateAllNodes,
        cachedDependencyGraph,
        setCachedDependencyGraph,
        transformNode,
        // Cross-hook wiring refs
        setNodesFnRef,
        invalidateCacheRef,
    };
}
