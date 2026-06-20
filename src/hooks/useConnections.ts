import { useCallback, useEffect, useRef, useState } from 'react';
import type { Connection, GraphNode } from '@/types';

interface UseConnectionsOptions {
    setNodesFnRef: React.MutableRefObject<React.Dispatch<React.SetStateAction<GraphNode[]>>>;
    invalidateCacheRef: React.MutableRefObject<() => void>;
}

export function useConnections({ setNodesFnRef, invalidateCacheRef }: UseConnectionsOptions) {
    const [connections, setConnections] = useState<Connection[]>([]);
    const [selectedConnections, setSelectedConnections] = useState<Set<string>>(new Set());
    const connectionsRef = useRef<Connection[]>(connections);
    useEffect(() => {
        connectionsRef.current = connections;
    }, [connections]);

    const createConnection = useCallback(
        (sourceId: string, targetId: string, inputName: string) => {
            setConnections((prev) => [
                ...prev.filter((c) => !(c.targetId === targetId && c.inputName === inputName)),
                { sourceId, targetId, inputName },
            ]);
            setNodesFnRef.current((prev) =>
                prev.map((n) =>
                    n.id === targetId
                        ? {
                              ...n,
                              inputs: {
                                  ...n.inputs,
                                  [inputName]: { ...n.inputs[inputName], isConnected: true },
                              },
                          }
                        : n,
                ),
            );
            invalidateCacheRef.current();
        },
        [setNodesFnRef, invalidateCacheRef],
    );

    const deleteSelectedConnections = useCallback(() => {
        const toDelete = new Set(Array.from(selectedConnections));
        setConnections((prev) =>
            prev.filter((c) => !toDelete.has(`${c.sourceId}-${c.targetId}-${c.inputName}`)),
        );
        setSelectedConnections(new Set());
    }, [selectedConnections]);

    const handleConnectionSelect = useCallback(
        (sourceId: string, targetId: string, inputName: string, isShiftKey: boolean) => {
            const key = `${sourceId}-${targetId}-${inputName}`;
            setSelectedConnections((prev) => {
                const next = new Set(prev);
                if (isShiftKey) {
                    if (next.has(key)) next.delete(key);
                    else next.add(key);
                } else {
                    if (next.size === 1 && next.has(key)) next.clear();
                    else {
                        next.clear();
                        next.add(key);
                    }
                }
                return next;
            });
        },
        [],
    );

    return {
        connections,
        setConnections,
        connectionsRef,
        selectedConnections,
        setSelectedConnections,
        createConnection,
        deleteSelectedConnections,
        handleConnectionSelect,
    };
}
