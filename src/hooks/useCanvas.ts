import { useCallback, useRef, useState } from 'react';
import type { GraphNode, Offset, SelectionBox } from '@/types';

interface UseCanvasOptions {
    nodes: GraphNode[];
    setNodes: React.Dispatch<React.SetStateAction<GraphNode[]>>;
    selectedNodes: Set<string>;
    setSelectedNodes: React.Dispatch<React.SetStateAction<Set<string>>>;
    setSelectedConnections: React.Dispatch<React.SetStateAction<Set<string>>>;
    handleNodeSelect: (nodeId: string, isShiftKey: boolean) => void;
}

const MIN_SCALE = 0.2;
const MAX_SCALE = 5;
const ZOOM_FACTOR = 1.1;

export function useCanvas({
    nodes,
    setNodes,
    selectedNodes,
    setSelectedNodes,
    setSelectedConnections,
    handleNodeSelect,
}: UseCanvasOptions) {
    const [isPanning, setIsPanning] = useState(false);
    const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
    const [scale, setScale] = useState(1);
    const containerRef = useRef<HTMLDivElement>(null);
    const boundaryRef = useRef<HTMLDivElement>(null);
    const lastMousePos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
    const [isSelecting, setIsSelecting] = useState(false);
    const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
    const [isDraggingNodes, setIsDraggingNodes] = useState(false);
    const [draggedNode, setDraggedNode] = useState<GraphNode | null>(null);

    // Convert screen coords to world coords (accounting for pan+zoom)
    const screenToWorld = useCallback(
        (sx: number, sy: number): { x: number; y: number } => ({
            x: (sx - offset.x) / scale,
            y: (sy - offset.y) / scale,
        }),
        [offset.x, offset.y, scale],
    );

    // ---- Zoom (Ctrl + scroll) ----
    const handleWheel = useCallback(
        (e: React.WheelEvent<HTMLDivElement>) => {
            if (!e.ctrlKey && !e.metaKey) return;
            e.preventDefault();
            const rect = containerRef.current?.getBoundingClientRect();
            if (!rect) return;
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            const worldBefore = screenToWorld(mx, my);
            const factor = e.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;
            const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * factor));
            setScale(newScale);
            setOffset({
                x: mx - worldBefore.x * newScale,
                y: my - worldBefore.y * newScale,
            });
        },
        [scale, screenToWorld],
    );

    const handleMouseDown = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            if (e.button === 1 || e.button === 2 || (e.button === 0 && e.altKey)) {
                setIsPanning(true);
                lastMousePos.current = { x: e.clientX, y: e.clientY };
                return;
            }
            if (e.button === 0) {
                setIsSelecting(true);
                const rect = containerRef.current!.getBoundingClientRect();
                const world = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
                setSelectionStart(world);
                setSelectionBox({ ...world, width: 0, height: 0 });
                if (!e.shiftKey) {
                    setSelectedNodes(new Set());
                    setSelectedConnections(new Set());
                }
            }
        },
        [screenToWorld, setSelectedNodes, setSelectedConnections],
    );

    const handleNodeDragStart = useCallback(
        (nodeId: string, e: React.MouseEvent) => {
            if (
                e.button !== 0 ||
                (e.target as HTMLElement).tagName === 'INPUT' ||
                (e.target as HTMLElement).closest('button')
            )
                return;
            e.stopPropagation();
            e.preventDefault();
            if (!selectedNodes.has(nodeId)) handleNodeSelect(nodeId, e.shiftKey);
            setIsDraggingNodes(true);
            setDraggedNode(nodes.find((n) => n.id === nodeId) ?? null);
            lastMousePos.current = { x: e.clientX, y: e.clientY };
        },
        [selectedNodes, nodes, handleNodeSelect],
    );

    const handleMouseMove = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            if (isPanning) {
                const dx = e.clientX - lastMousePos.current.x;
                const dy = e.clientY - lastMousePos.current.y;
                setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
                lastMousePos.current = { x: e.clientX, y: e.clientY };
                return;
            }
            if (isDraggingNodes && draggedNode) {
                const dx = (e.clientX - lastMousePos.current.x) / scale;
                const dy = (e.clientY - lastMousePos.current.y) / scale;
                setNodes((prev) =>
                    prev.map((n) =>
                        selectedNodes.has(n.id)
                            ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } }
                            : n,
                    ),
                );
                lastMousePos.current = { x: e.clientX, y: e.clientY };
                return;
            }
            if (isSelecting && selectionStart && containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                const world = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
                const box: SelectionBox = {
                    x: Math.min(selectionStart.x, world.x),
                    y: Math.min(selectionStart.y, world.y),
                    width: Math.abs(world.x - selectionStart.x),
                    height: Math.abs(world.y - selectionStart.y),
                };
                setSelectionBox(box);
                const sel = new Set<string>();
                nodes.forEach((n) => {
                    if (
                        n.position.x < box.x + box.width &&
                        n.position.x + 320 > box.x &&
                        n.position.y < box.y + box.height &&
                        n.position.y + 200 > box.y
                    ) {
                        sel.add(n.id);
                    }
                });
                setSelectedNodes(sel);
                setSelectedConnections(new Set());
            }
        },
        [
            isPanning,
            isDraggingNodes,
            draggedNode,
            isSelecting,
            selectionStart,
            scale,
            screenToWorld,
            nodes,
            selectedNodes,
            setNodes,
            setSelectedNodes,
            setSelectedConnections,
        ],
    );

    const handleMouseUp = useCallback(() => {
        if (isSelecting && selectionBox && selectionBox.width === 0 && selectionBox.height === 0) {
            setSelectedNodes(new Set());
            setSelectedConnections(new Set());
        }
        setIsPanning(false);
        setIsDraggingNodes(false);
        setDraggedNode(null);
        setIsSelecting(false);
        setSelectionBox(null);
        setSelectionStart(null);
    }, [isSelecting, selectionBox, setSelectedNodes, setSelectedConnections]);

    const handlePositionChange = useCallback(
        (id: string, pos: { x: number; y: number }) => {
            if (!selectedNodes.has(id)) {
                const node = nodes.find((n) => n.id === id);
                if (node)
                    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, position: pos } : n)));
            }
        },
        [nodes, selectedNodes, setNodes],
    );

    return {
        offset,
        setOffset,
        scale,
        setScale,
        containerRef,
        boundaryRef,
        lastMousePos,
        selectionBox,
        isSelecting,
        isDraggingNodes,
        handleWheel,
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
        handleNodeDragStart,
        handlePositionChange,
    };
}
