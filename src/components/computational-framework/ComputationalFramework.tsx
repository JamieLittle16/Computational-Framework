'use client';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Redo, Save, Settings2, Sun, Moon, Undo, Upload, Wand, Plus } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import ComputationalNode from './ComputationalNode';
import LoggerNode from './LoggerNode';
import SettingsPanel from './SettingsPanel';
import hsvToRgb from '@/utils/colourUtils';
import AIHelper from './AIHelper';
import { NodePalette } from './NodePalette';
import { ShortcutsPanel } from './ShortcutsPanel';
import { Minimap } from './Minimap';
import { getDemoGraph } from '@/lib/demoGraph';
import { Toaster, toast } from 'sonner';
import type { Connection, GraphNode, NodeType, SavedSetup, Settings } from '@/types';
import { useNodes } from '@/hooks/useNodes';
import { useConnections } from '@/hooks/useConnections';
import { useCanvas } from '@/hooks/useCanvas';
import { useKeyboard } from '@/hooks/useKeyboard';
import { useUndoRedo } from '@/hooks/useUndoRedo';
import { getDefaultInputs } from '@/lib/nodeRegistry';

const DEFAULT_SETTINGS: Settings = {
    initialQ: 0,
    modBase: 2,
    maxEvalDepth: 100,
    colorMode: false,
    delay: 100,
    selectionTintStrength: 0.15,
};

const noopDispatch = (() => {}) as React.Dispatch<React.SetStateAction<unknown>>;

const ComputationalFramework: React.FC = () => {
    const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
    const [showAIHelper, setShowAIHelper] = useState(false);
    const [isDark, setIsDark] = useState(false);
    const [darkReady, setDarkReady] = useState(false);
    const settingsRef = useRef<Settings>(settings);
    useEffect(() => {
        settingsRef.current = settings;
    }, [settings]);

    // Dark mode — initialise from storage on client mount, then react to changes
    useEffect(() => {
        const stored = localStorage.getItem('theme');
        const prefersDark = stored
            ? stored === 'dark'
            : window.matchMedia('(prefers-color-scheme: dark)').matches;
        setIsDark(prefersDark);
        setDarkReady(true);
    }, []);

    useEffect(() => {
        if (!darkReady) return;
        document.documentElement.classList.toggle('dark', isDark);
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    }, [isDark, darkReady]);

    // ---- Bridging refs for cross-hook dependencies ----
    const setNodesBridgeRef =
        useRef<React.Dispatch<React.SetStateAction<GraphNode[]>>>(noopDispatch);
    const invalidateCacheBridgeRef = useRef<() => void>(() => {});
    const setConnectionsBridgeRef =
        useRef<React.Dispatch<React.SetStateAction<Connection[]>>>(noopDispatch);
    const setSelectedConnsBridgeRef =
        useRef<React.Dispatch<React.SetStateAction<Set<string>>>>(noopDispatch);

    // 1. Connections (needs noop refs initially — gets populated after useNodes runs)
    const conns = useConnections({
        setNodesFnRef: setNodesBridgeRef,
        invalidateCacheRef: invalidateCacheBridgeRef,
    });

    // 2. Nodes + evaluation (gets the real connections ref from useConnections)
    const graph = useNodes({
        settings,
        settingsRef,
        connectionsRef: conns.connectionsRef,
        setConnectionsFnRef: setConnectionsBridgeRef,
        setSelectedConnectionsFnRef: setSelectedConnsBridgeRef,
    });

    // 3. Populate bridge refs now that both hooks exist
    setNodesBridgeRef.current = graph.setNodesFnRef.current as React.Dispatch<
        React.SetStateAction<GraphNode[]>
    >;
    invalidateCacheBridgeRef.current = graph.invalidateCacheRef.current;
    setConnectionsBridgeRef.current = conns.setConnections as React.Dispatch<
        React.SetStateAction<Connection[]>
    >;
    setSelectedConnsBridgeRef.current = conns.setSelectedConnections as React.Dispatch<
        React.SetStateAction<Set<string>>
    >;

    // ---- Destructure for convenience ----
    const {
        nodes,
        nextNodeId,
        selectedNodes,
        setSelectedNodes,
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
        transformNode,
        setNodes,
    } = graph;

    const {
        connections,
        selectedConnections,
        createConnection,
        deleteSelectedConnections,
        handleConnectionSelect,
    } = conns;

    // ---- Evaluation timer ----
    useEffect(() => {
        const id = setInterval(evaluateAllNodes, settings.delay);
        return () => clearInterval(id);
    }, [evaluateAllNodes, settings.delay]);

    // ---- Canvas ----
    const canvas = useCanvas({
        nodes,
        setNodes,
        selectedNodes,
        setSelectedNodes,
        setSelectedConnections: conns.setSelectedConnections,
        handleNodeSelect,
    });

    // ---- Undo / Redo ----
    const history = useUndoRedo({ nodes, connections, setNodes, setConnections: conns.setConnections });

    // ---- Keyboard ----
    useKeyboard({
        onCopy: copySelectedNodes,
        onPaste: () => pasteCopiedNodes(canvas.containerRef, canvas.offset),
        onDelete: () => {
            deleteSelectedNodes();
            deleteSelectedConnections();
        },
        onUndo: history.undo,
        onRedo: history.redo,
    });

    // ---- Demo graph on first visit ----
    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (localStorage.getItem('hasVisited')) return;
        localStorage.setItem('hasVisited', '1');
        const demo = getDemoGraph();
        setNodes(demo.nodes);
        conns.setConnections(demo.connections);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ---- Save / Load ----
    const handleSaveSetup = useCallback(() => {
        try {
            const setup: SavedSetup = {
                nodes: nodes.map((n) => ({
                    ...n,
                    position: {
                        x: n.position.x - canvas.offset.x,
                        y: n.position.y - canvas.offset.y,
                    },
                })),
                connections,
                nextNodeId,
                settings,
            };
            const blob = new Blob([JSON.stringify(setup, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'computational-setup.json';
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Error saving setup:', err);
        }
    }, [nodes, connections, nextNodeId, settings, canvas.offset]);

    const handleLoadSetup = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const setup = JSON.parse(ev.target?.result as string) as SavedSetup;
                    setNodes(setup.nodes.map((n) => ({ ...n, error: n.error ?? '' })));
                    conns.setConnections(setup.connections);
                    canvas.setOffset({ x: 0, y: 0 });
                    if (setup.settings) setSettings(setup.settings);
                } catch (err) {
                    console.error('Error parsing setup:', err);
                    toast.error('Failed to load setup file.');
                }
            };
            reader.readAsText(file);
        },
        [setNodes, conns, canvas],
    );

    const handleAIHelperToggle = useCallback(() => setShowAIHelper((v) => !v), []);
    const handleAddDefaultNode = useCallback(
        () => createNode(null, canvas.containerRef, canvas.offset),
        [createNode, canvas.containerRef, canvas.offset],
    );
    const handleCreateNodeByType = useCallback(
        (type: NodeType) => {
            createNode({ inputs: getDefaultInputs(type), type }, canvas.containerRef, canvas.offset);
        },
        [createNode, canvas.containerRef, canvas.offset],
    );

    // ---- Render ----
    const gridBg = `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0H20V20H0z' fill='white' /%3E%3Cpath d='M0 0H20V20H0Z' stroke='%23e0e0e0' stroke-width='0.5' fill='none' /%3E%3C/svg%3E")`;

    return (
        <div
            ref={canvas.containerRef}
            className="relative w-full h-screen overflow-hidden bg-background text-foreground"
            onMouseDown={canvas.handleMouseDown}
            onMouseMove={canvas.handleMouseMove}
            onMouseUp={canvas.handleMouseUp}
            onMouseLeave={canvas.handleMouseUp}
            onWheel={canvas.handleWheel}
        >
            <Toaster richColors />

            <div
                className="absolute inset-0 bg-repeat pointer-events-none"
                style={{
                    backgroundImage: gridBg,
                    backgroundSize: `${20 * canvas.scale}px ${20 * canvas.scale}px`,
                    transform: `translate(${canvas.offset.x % (20 * canvas.scale)}px, ${canvas.offset.y % (20 * canvas.scale)}px)`,
                }}
            />

            {/* Toolbar */}
            <div className="absolute top-4 left-4 z-10 flex gap-2">
                <Button onClick={handleAddDefaultNode} className="flex items-center gap-2">
                    <Plus className="h-4 w-4" /> Add Node
                </Button>
                <NodePalette onCreateNode={handleCreateNodeByType} />
                <Button onClick={handleSaveSetup} className="flex items-center gap-2">
                    <Save className="h-4 w-4" /> Save
                </Button>
                <Button
                    className="flex items-center gap-2"
                    onClick={() =>
                        (document.getElementById('load-setup') as HTMLInputElement)?.click()
                    }
                >
                    <Upload className="h-4 w-4" /> Load
                </Button>
                <Sheet>
                    <SheetTrigger asChild>
                        <Button className="flex items-center gap-2">
                            <Settings2 className="h-4 w-4" /> Settings
                        </Button>
                    </SheetTrigger>
                    <SheetContent>
                        <SheetHeader>
                            <SheetTitle>Framework Settings</SheetTitle>
                        </SheetHeader>
                        <div className="py-4">
                            <SettingsPanel settings={settings} onSettingsChange={setSettings} />
                        </div>
                    </SheetContent>
                </Sheet>
                <ShortcutsPanel />
                <input
                    id="load-setup"
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={handleLoadSetup}
                />
            </div>

            <div className="absolute top-4 right-4 z-10 flex gap-2">
                <Button
                    onClick={history.undo}
                    disabled={!history.canUndo}
                    className="flex items-center gap-2"
                    title="Undo (Ctrl+Z)"
                >
                    <Undo className="h-4 w-4" />
                </Button>
                <Button
                    onClick={history.redo}
                    disabled={!history.canRedo}
                    className="flex items-center gap-2"
                    title="Redo (Ctrl+Shift+Z)"
                >
                    <Redo className="h-4 w-4" />
                </Button>
                <Button
                    onClick={() => setIsDark((v) => !v)}
                    className="flex items-center gap-2"
                    title="Toggle dark mode"
                    suppressHydrationWarning
                >
                    {isDark ? (
                        <Sun className="h-4 w-4" />
                    ) : (
                        <Moon className="h-4 w-4" />
                    )}
                </Button>
                <Button onClick={handleAIHelperToggle} className="flex items-center gap-2">
                    <Wand className="h-4 w-4" /> AI Helper
                </Button>
            </div>

            {/* Scaled canvas wrapper */}
            <div
                className="absolute"
                style={{
                    transform: `translate(${canvas.offset.x}px, ${canvas.offset.y}px) scale(${canvas.scale})`,
                    transformOrigin: '0 0',
                    willChange: 'transform',
                }}
            >
                {/* Nodes */}
                <div ref={canvas.boundaryRef}>
                    {nodes.map((n) => {
                        const isSelected = selectedNodes.has(n.id);
                        const props = {
                            node: n,
                            updateNode,
                            deleteNode,
                            duplicateNode,
                            connections,
                            createConnection,
                            position: n.position,
                            onPositionChange: canvas.handlePositionChange,
                            allNodes: nodes,
                            updateNodeQ,
                            settings,
                            isSelected,
                            onSelect: handleNodeSelect,
                            handleInputChange: handleNodeInputChange,
                            onDragStart: canvas.handleNodeDragStart,
                            transformNode,
                        };
                        return n.type === 'logger' ? (
                            <LoggerNode key={n.id} {...props} />
                        ) : (
                            <ComputationalNode key={n.id} {...props} />
                        );
                    })}
                </div>

                {/* SVG connections */}
                <svg
                    className="absolute top-0 left-0 pointer-events-none"
                    style={{ width: '100vw', height: '100vh', zIndex: 1 }}
                >
                    <defs>
                        {/* Arrowhead marker */}
                        <marker
                            id="arrowhead"
                            markerWidth="8"
                            markerHeight="6"
                            refX="7"
                            refY="3"
                            orient="auto"
                        >
                            <polygon points="0 0, 8 3, 0 6" fill="#666" opacity="0.7" />
                        </marker>
                        <marker
                            id="arrowhead-selected"
                            markerWidth="8"
                            markerHeight="6"
                            refX="7"
                            refY="3"
                            orient="auto"
                        >
                            <polygon points="0 0, 8 3, 0 6" fill="rgb(59,130,246)" />
                        </marker>
                        {/* Flow animation keyframe */}
                        <style>{`
                            @keyframes flow {
                                from { stroke-dashoffset: 24; }
                                to   { stroke-dashoffset: 0; }
                            }
                            .conn-flow {
                                stroke-dasharray: 6 6;
                                animation: flow 0.6s linear infinite;
                            }
                        `}</style>
                    </defs>

                    {connections.map((conn, idx) => {
                        const src = nodes.find((n) => n.id === conn.sourceId);
                        const tgt = nodes.find((n) => n.id === conn.targetId);
                        if (!src || !tgt) return null;
                        const sx = src.position.x + 320;
                        const sy = src.position.y + 64;
                        const tx = tgt.position.x;
                        const ty = tgt.position.y + 64;
                        const cx = Math.abs(tx - sx) * 0.5;
                        const key = `${conn.sourceId}-${conn.targetId}-${conn.inputName}`;
                        const sel = selectedConnections.has(key);
                        let color = '#888';
                        if (settings.colorMode) {
                            const h = Math.max(0, Math.min(360, (src.q / settings.modBase) * 360));
                            const r = hsvToRgb(h, 0.85, 0.9);
                            color = `rgb(${r[0]},${r[1]},${r[2]})`;
                        }
                        const d = `M ${sx} ${sy} C ${sx + cx} ${sy}, ${tx - cx} ${ty}, ${tx} ${ty}`;
                        const strokeColor = sel ? 'rgb(59,130,246)' : color;
                        return (
                            <g key={idx}>
                                {/* Wide invisible hit area */}
                                <path
                                    d={d}
                                    stroke="transparent"
                                    strokeWidth="14"
                                    fill="none"
                                    style={{ pointerEvents: 'auto' }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleConnectionSelect(
                                            conn.sourceId,
                                            conn.targetId,
                                            conn.inputName,
                                            e.shiftKey,
                                        );
                                    }}
                                />
                                {/* Base wire */}
                                <path
                                    d={d}
                                    stroke={strokeColor}
                                    strokeWidth={sel ? '3' : '2'}
                                    fill="none"
                                    opacity={sel ? 1 : 0.7}
                                    markerEnd={sel ? 'url(#arrowhead-selected)' : 'url(#arrowhead)'}
                                    style={{ cursor: 'pointer' }}
                                />
                                {/* Animated flow overlay (always visible) */}
                                <path
                                    d={d}
                                    stroke={strokeColor}
                                    strokeWidth={sel ? '2' : '1.5'}
                                    fill="none"
                                    opacity={sel ? 0.9 : 0.5}
                                    className="conn-flow"
                                    style={{ pointerEvents: 'none' }}
                                />
                                {/* Output port dot */}
                                <circle cx={sx} cy={sy} r="4" fill="#4444ff" />
                            </g>
                        );
                    })}
                </svg>

                {/* Selection box */}
                {canvas.selectionBox && (
                    <div
                        className="absolute border border-blue-500 bg-blue-100 bg-opacity-20 pointer-events-none"
                        style={{
                            left: canvas.selectionBox.x,
                            top: canvas.selectionBox.y,
                            width: canvas.selectionBox.width,
                            height: canvas.selectionBox.height,
                        }}
                    />
                )}
            </div>

            {/* Minimap — fixed position, outside the scaled canvas */}
            {nodes.length > 0 && (
                <Minimap
                    nodes={nodes}
                    connections={connections}
                    offset={canvas.offset}
                    scale={canvas.scale}
                    viewportWidth={canvas.containerRef.current?.clientWidth ?? window.innerWidth}
                    viewportHeight={canvas.containerRef.current?.clientHeight ?? window.innerHeight}
                />
            )}

            {showAIHelper && (
                <AIHelper
                    allNodes={nodes}
                    connections={connections}
                    settings={settings}
                    createNode={createNode}
                    createConnection={createConnection}
                    updateNode={updateNode}
                    onClose={() => setShowAIHelper(false)}
                />
            )}
        </div>
    );
};

export default ComputationalFramework;
