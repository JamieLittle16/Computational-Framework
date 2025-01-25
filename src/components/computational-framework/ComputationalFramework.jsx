import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Copy, Edit2, MoreVertical, Plus, Save, Settings2, Trash, Upload, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import ComputationalNode from './ComputationalNode';
import SettingsPanel from './SettingsPanel';
import styles from "./ComputationalFramework.module.css";

function hsvToRgb(h, s, v) {
    h /= 360; // Normalize hue to 0-1 range
    let i = Math.floor(h * 6);
    let f = h * 6 - i;
    let p = v * (1 - s);
    let q = v * (1 - f * s);
    let t = v * (1 - (1 - f) * s);
    i %= 6;
    return [
        [v, q, p, p, t, v][i] * 255,
        [t, v, v, q, p, p][i] * 255,
        [p, p, t, v, v, q][i] * 255,
    ];
}


const ComputationalFramework = () => {
    const [nodes, setNodes] = useState([]);
    const [connections, setConnections] = useState([]);
    const [selectedConnections, setSelectedConnections] = useState(new Set());
    const [nextNodeId, setNextNodeId] = useState(1);
    const [selectedNodes, setSelectedNodes] = useState(new Set());
    const [isPanning, setIsPanning] = useState(false);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const containerRef = useRef(null);
    const lastMousePos = useRef({ x: 0, y: 0 });
    const [selectionBox, setSelectionBox] = useState(null);
    const [isSelecting, setIsSelecting] = useState(false);
    const [selectionStart, setSelectionStart] = useState(null);

    const [settings, setSettings] = useState({
        initialQ: 0,
        modBase: 2,
        maxEvalDepth: 100,
        colorMode: false,
        delay: 100,
        selectionTintStrength: 0.15
    });

    const createNode = useCallback(() => {
        const container = containerRef.current;
        const rect = container.getBoundingClientRect();

        const centerX = (rect.width / 2) - 160 - offset.x;
        const centerY = (rect.height / 2) - 100 - offset.y;

        const newNode = {
            id: nextNodeId,
            position: { x: centerX, y: centerY },
            inputs: {},
            formula: '',
            useMod2: true,
            q: settings.initialQ,
            name: `Node ${nextNodeId}`
        };
        setNodes(prevNodes => [...prevNodes, newNode]);
        setNextNodeId(prevId => prevId + 1);
    }, [nextNodeId, offset, settings.initialQ]);

    const saveSetup = () => {
        const setup = {
            nodes: nodes.map(node => ({
                ...node,
                position: {
                    x: node.position.x - offset.x,
                    y: node.position.y - offset.y
                }
            })),
            connections,
            nextNodeId,
            settings
        };
        const blob = new Blob([JSON.stringify(setup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'computational-setup.json';
        a.click();
        URL.revokeObjectURL(url);
    };

    const loadSetup = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const setup = JSON.parse(e.target.result);
                    setNodes(setup.nodes);
                    setConnections(setup.connections);
                    setNextNodeId(setup.nextNodeId);
                    setOffset({ x: 0, y: 0 });
                    if (setup.settings) {
                        setSettings(setup.settings);
                    }
                } catch (error) {
                    console.error('Error loading setup:', error);
                }
            };
            reader.readAsText(file);
        }
    };

    const updateNode = useCallback((id, updatedNode) => {
        setNodes(prevNodes =>
            prevNodes.map(node => node.id === id ? updatedNode : node)
        );
    }, []);

    const deleteNode = useCallback((id) => {
        setNodes(prevNodes => prevNodes.filter(node => node.id !== id));
        setConnections(prevConns =>
            prevConns.filter(conn => conn.sourceId !== id && conn.targetId !== id)
        );
    }, []);

    const duplicateNode = useCallback((node) => {
        const newNode = {
            ...node,
            id: nextNodeId,
            position: { x: node.position.x + 50, y: node.position.y + 50 }
        };
        setNodes(prevNodes => [...prevNodes, newNode]);
        setNextNodeId(prevId => prevId + 1);
    }, [nextNodeId]);

    const createConnection = useCallback((sourceId, targetId, inputName) => {
        setConnections(prevConns => {
            const newConns = prevConns.filter(conn =>
                !(conn.targetId === targetId && conn.inputName === inputName)
            );
            return [...newConns, { sourceId, targetId, inputName }];
        });

        setNodes(prevNodes => prevNodes.map(node => {
            if (node.id === targetId) {
                return {
                    ...node,
                    inputs: {
                        ...node.inputs,
                        [inputName]: { ...node.inputs[inputName], isConnected: true }
                    }
                };
            }
            return node;
        }));
    }, []);

    const updateNodeQ = useCallback((id, newQ) => {
        setNodes(prevNodes =>
            prevNodes.map(node =>
                node.id === id ? { ...node, q: newQ } : node
            )
        );
    }, []);

    // Update the node selection handler
    const handleNodeSelect = (nodeId, isShiftKey) => {
        setSelectedNodes(prev => {
            const newSelection = new Set(prev);
            if (isShiftKey) {
                if (newSelection.has(nodeId)) {
                    newSelection.delete(nodeId);
                } else {
                    newSelection.add(nodeId);
                }
            } else {
                if (newSelection.size === 1 && newSelection.has(nodeId)) {
                    // Clicking the only selected node deselects it
                    newSelection.clear();
                } else {
                    // Clicking a new node or adding to selection
                    newSelection.clear();
                    newSelection.add(nodeId);
                }
            }
            return newSelection;
        });
    };
    const handleConnectionSelect = (sourceId, targetId, inputName, isShiftKey) => {
        setSelectedConnections(prev => {
            const newSelection = new Set(prev);
            const connectionString = `${sourceId}-${targetId}-${inputName}`;
            if (isShiftKey) {
                if (newSelection.has(connectionString)) {
                    newSelection.delete(connectionString);
                } else {
                    newSelection.add(connectionString);
                }
            } else {
                if (newSelection.size === 1 && newSelection.has(connectionString)) {
                    // Clicking the only selected connection deselects it
                    newSelection.clear();
                } else {
                    // Clicking a new node or adding to selection
                    newSelection.clear();
                    newSelection.add(connectionString);
                }
            }
            return newSelection;
        })
    }

    const calculateWorkspaceSize = useCallback(() => {
        const container = containerRef.current;
        if (!container) return { width: '100%', height: '100%' };

        const rect = container.getBoundingClientRect();
        const viewportWidth = rect.width;
        const viewportHeight = rect.height;

        if (nodes.length === 0) {
            return {
                width: `${viewportWidth}px`,
                height: `${viewportHeight}px`,
            };
        }

        const positions = nodes.map(node => ({
            x: node.position.x,
            y: node.position.y,
        }));

        const minX = Math.min(...positions.map(p => p.x));
        const maxX = Math.max(...positions.map(p => p.x));
        const minY = Math.min(...positions.map(p => p.y));
        const maxY = Math.max(...positions.map(p => p.y));

        const width = Math.max(viewportWidth, maxX - minX + 800);
        const height = Math.max(viewportHeight, maxY - minY + 600);
        return { width: `${width}px`, height: `${height}px` };
    }, [nodes]);

    useEffect(() => {
        const handleResize = () => {
            const newSize = calculateWorkspaceSize();
            setWorkspaceSize(newSize);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [calculateWorkspaceSize]);

    const [workspaceSize, setWorkspaceSize] = useState(calculateWorkspaceSize());

    useEffect(() => {
        setWorkspaceSize(calculateWorkspaceSize());
    }, [offset, nodes, calculateWorkspaceSize]);

    // Handle keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Copy selected nodes
            if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                const selectedNodesList = nodes.filter(node => selectedNodes.has(node.id));
                if (selectedNodesList.length > 0) {
                    localStorage.setItem('copiedNodes', JSON.stringify(selectedNodesList));
                }
            }

            // Paste nodes
            if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
                const copiedNodes = JSON.parse(localStorage.getItem('copiedNodes') || '[]');
                if (copiedNodes.length > 0) {
                    const offset = { x: 50, y: 50 }; // Offset pasted nodes
                    const idMapping = {};

                    const newNodes = copiedNodes.map(node => {
                        const newId = nextNodeId + (idMapping[node.id] || Object.keys(idMapping).length);
                        idMapping[node.id] = newId;

                        return {
                            ...node,
                            id: newId,
                            position: {
                                x: node.position.x + offset.x,
                                y: node.position.y + offset.y
                            }
                        };
                    });

                    setNodes(prev => [...prev, ...newNodes]);
                    setNextNodeId(prev => prev + newNodes.length);

                    // Select newly pasted nodes
                    setSelectedNodes(new Set(newNodes.map(n => n.id)));
                }
            }
            // Delete selected connections and nodes
            if ((e.key === 'Delete' || e.key === 'Backspace')) {
                if (selectedNodes.size > 0) {
                    setNodes(prevNodes => prevNodes.filter(node => !selectedNodes.has(node.id)));
                    setConnections(prevConns =>
                        prevConns.filter(conn =>
                            !selectedNodes.has(conn.sourceId) && !selectedNodes.has(conn.targetId)
                        )
                    );
                    setSelectedNodes(new Set());
                }
                if (selectedConnections.size > 0) {
                    setConnections(prevConns => prevConns.filter(conn => {
                        const connectionString = `${conn.sourceId}-${conn.targetId}-${conn.inputName}`;
                        return !selectedConnections.has(connectionString)
                    }));
                    setSelectedConnections(new Set())
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [nodes, selectedNodes, nextNodeId, selectedConnections]);

    // Handle selection box
    const handleMouseDown = (e) => {
        if (e.button === 1 || e.button === 2 || (e.button === 0 && e.altKey)) {
            // Middle click, Right Click or Alt+left click for panning
            setIsPanning(true);
            lastMousePos.current = { x: e.clientX, y: e.clientY };
            return;
        }

        if (e.button === 0) {
            setIsSelecting(true);
            const rect = containerRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            setSelectionStart({
                x: x - offset.x,
                y: y - offset.y
            });

            setSelectionBox({
                x: x - offset.x,
                y: y - offset.y,
                width: 0,
                height: 0
            });
            if (!e.shiftKey) {
                setSelectedNodes(new Set());
                setSelectedConnections(new Set());
            }
        }
    };

    const handleMouseMove = (e) => {
        if (isPanning) {
            const dx = e.clientX - lastMousePos.current.x;
            const dy = e.clientY - lastMousePos.current.y;
            setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
            lastMousePos.current = { x: e.clientX, y: e.clientY };
            return;
        }

        if (isSelecting && selectionStart) {
            const rect = containerRef.current.getBoundingClientRect();
            // Get mouse position with respect to the top left corner of the canvas, taking into account the offset
            const currentX = e.clientX - rect.left - offset.x;
            const currentY = e.clientY - rect.top - offset.y;

            const newSelectionBox = {
                x: Math.min(selectionStart.x, currentX),
                y: Math.min(selectionStart.y, currentY),
                width: Math.abs(currentX - selectionStart.x),
                height: Math.abs(currentY - selectionStart.y)
            };

            setSelectionBox(newSelectionBox);

            const newSelectedNodes = new Set();
            nodes.forEach(node => {
                const nodeRect = {
                    left: node.position.x,
                    right: node.position.x + 320,
                    top: node.position.y,
                    bottom: node.position.y + 200
                };

                if (
                    nodeRect.left < newSelectionBox.x + newSelectionBox.width &&
                    nodeRect.right > newSelectionBox.x &&
                    nodeRect.top < newSelectionBox.y + newSelectionBox.height &&
                    nodeRect.bottom > newSelectionBox.y
                ) {
                    newSelectedNodes.add(node.id);
                }
            });

            setSelectedNodes(newSelectedNodes);
            setSelectedConnections(new Set());
        }
    };

    const handleMouseUp = () => {
        if (isSelecting && selectionBox && selectionBox.width === 0 && selectionBox.height === 0) {
            setSelectedNodes(new Set());
            setSelectedConnections(new Set());
        }

        setIsPanning(false);
        setIsSelecting(false);
        setSelectionBox(null);
        setSelectionStart(null);
    };


    const svgContent = useMemo(() => (
            <svg
                width={workspaceSize.width}
                height={workspaceSize.height}
            >
                <defs>
                    <pattern
                        id="gridPattern"
                        width="20"
                        height="20"
                        patternUnits="userSpaceOnUse"
                    >
                        <path
                            d="M 20 0 L 0 0 0 20"
                            fill="none"
                            stroke="#e0e0e0"
                            strokeWidth="1"
                        />
                    </pattern>
                </defs>
                <rect
                    width="100%"
                    height="100%"
                    fill="url(#gridPattern)"
                />

                {connections.map((conn, idx) => {
                    const sourceNode = nodes.find(n => n.id === conn.sourceId);
                    const targetNode = nodes.find(n => n.id === conn.targetId);
                    if (!sourceNode || !targetNode) return null;

                    const sourceX = sourceNode.position.x + 320;
                    const sourceY = sourceNode.position.y + 64;
                    const targetX = targetNode.position.x;
                    const targetY = targetNode.position.y + 64;
                    const dx = targetX - sourceX;
                    const controlX = Math.abs(dx) * 0.5;
                    const connectionString = `${conn.sourceId}-${conn.targetId}-${conn.inputName}`;

                    return (
                        <g key={idx}
                           onClick={(e) => {
                               e.stopPropagation();
                               handleConnectionSelect(conn.sourceId, conn.targetId, conn.inputName, e.shiftKey);
                           }}
                        >
                            <path
                                d={`M ${sourceX} ${sourceY}
                                    C ${sourceX + controlX} ${sourceY},
                                      ${targetX - controlX} ${targetY},
                                      ${targetX} ${targetY}`}
                                stroke={selectedConnections.has(connectionString) ? "rgb(59, 130, 246)" : "#666"}
                                strokeWidth={selectedConnections.has(connectionString) ? "4" : "2"}
                                fill="none"
                                style={{ cursor: 'pointer' }}
                            />
                            <circle cx={sourceX} cy={sourceY} r="4" fill="#4444ff" />
                            <circle cx={targetX} cy={targetY} r="4" fill="#666" />
                        </g>
                    );
                })}

                {selectionBox && (
                    <rect
                        x={selectionBox.x}
                        y={selectionBox.y}
                        width={selectionBox.width}
                        height={selectionBox.height}
                        fill="rgba(59, 130, 246, 0.1)"
                        stroke="rgb(59, 130, 246)"
                        strokeWidth="1"
                    />
                )}
            </svg>
        ), [workspaceSize, connections, nodes, selectedConnections, selectionBox, handleConnectionSelect]);


    return (
        <div
            ref={containerRef}
            className="relative w-full h-screen bg-gray-50 overflow-hidden"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            <div className="absolute top-4 left-4 z-10 flex gap-2">
                <Button onClick={createNode} className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Add Node
                </Button>
                <Button onClick={saveSetup} className="flex items-center gap-2">
                    <Save className="h-4 w-4" />
                    Save
                </Button>
                <Button className="flex items-center gap-2" onClick={() => document.getElementById('load-setup').click()}>
                    <Upload className="h-4 w-4" />
                    Load
                </Button>
                <Sheet>
                    <SheetTrigger asChild>
                        <Button className="flex items-center gap-2">
                            <Settings2 className="h-4 w-4" />
                            Settings
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
                <input
                    id="load-setup"
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={loadSetup}
                />
            </div>
            <div
                 className="absolute"
                 style={{
                   transform: `translate(${offset.x}px, ${offset.y}px)`,
                 }}
            >
            {svgContent}
            {nodes.map(node => (
                 <ComputationalNode
                 key={node.id}
                 node={node}
                 updateNode={updateNode}
                 deleteNode={deleteNode}
                 duplicateNode={duplicateNode}
                 connections={connections}
                 createConnection={createConnection}
                 position={node.position}
                 data-node-id={node.id}
                 onPositionChange={(id, pos) => {
                     if (selectedNodes.has(id)) {
                         const draggedNode = nodes.find(n => n.id === id);
                         if (draggedNode) {
                             const dx = pos.x - draggedNode.position.x;
                             const dy = pos.y - draggedNode.position.y;
                             setNodes(prevNodes => prevNodes.map(n =>
                                 selectedNodes.has(n.id)
                                     ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } }
                                     : n
                             ));
                         }
                     } else {
                         updateNode(id, { ...node, position: pos });
                     }
                 }}
                 allNodes={nodes}
                 updateNodeQ={updateNodeQ}
                 isSelected={selectedNodes.has(node.id)}
                 onSelect={handleNodeSelect}
                 settings={settings}
                 />
                 ))}
            </div>
        </div>
    );
};

export default ComputationalFramework;
