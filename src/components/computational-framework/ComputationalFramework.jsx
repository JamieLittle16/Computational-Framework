import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Copy, Edit2, MoreVertical, Plus, Save, Settings2, Trash, Upload, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, } from 'react';
import ComputationalNode from './ComputationalNode';
import SettingsPanel from './SettingsPanel';
import styles from "./ComputationalFramework.module.css";

const ComputationalFramework = () => {
    const [nodes, setNodes] = useState([]);
    const [connections, setConnections] = useState([]);
    const [selectedConnections, setSelectedConnections] = useState(new Set());
    const [nextNodeId, setNextNodeId] = useState(1);
    const [selectedNodes, setSelectedNodes] = useState(new Set());
    const [isPanning, setIsPanning] = useState(false);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const containerRef = useRef(null);
    const boundaryRef = useRef(null);
    const lastMousePos = useRef({ x: 0, y: 0 });
    const [selectionBox, setSelectionBox] = useState(null);
    const [isSelecting, setIsSelecting] = useState(false);
    const [selectionStart, setSelectionStart] = useState(null);
    const [isDraggingNodes, setIsDraggingNodes] = useState(false);
    const [draggedNode, setDraggedNode] = useState(null);

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
                    newSelection.clear();
                } else {
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
                    newSelection.clear();
                } else {
                    newSelection.clear();
                    newSelection.add(connectionString);
                }
            }
            return newSelection;
        });
    };

    const handleMouseDown = (e) => {
        if (e.button === 1 || e.button === 2 || (e.button === 0 && e.altKey)) {
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

    const handleNodeDragStart = useCallback((nodeId, e) => {
        if (e.button !== 0 || e.target.tagName === 'INPUT' || e.target.closest('button')) return;
        e.stopPropagation();
        e.preventDefault();
        if (!selectedNodes.has(nodeId)) {
            handleNodeSelect(nodeId, e.shiftKey);
        }

        setIsDraggingNodes(true);
        setDraggedNode(nodes.find(n => n.id === nodeId));
        lastMousePos.current = { x: e.clientX, y: e.clientY };
    }, [selectedNodes, nodes, handleNodeSelect]);

    const handleMouseMove = (e) => {
        if (isPanning) {
            const dx = e.clientX - lastMousePos.current.x;
            const dy = e.clientY - lastMousePos.current.y;

            setOffset(prev => ({
                x: prev.x + dx,
                y: prev.y + dy,
            }));
            lastMousePos.current = { x: e.clientX, y: e.clientY };
            return;
        } else if (isDraggingNodes) {
            if (draggedNode) {
                const dx = e.clientX - lastMousePos.current.x;
                const dy = e.clientY - lastMousePos.current.y;

                setNodes(prevNodes => prevNodes.map(n => {
                    if (selectedNodes.has(n.id)) {
                        const newX = n.position.x + dx;
                        const newY = n.position.y + dy;
                        return { ...n, position: { x: newX, y: newY } };
                    }
                    return n;
                }));
                lastMousePos.current = { x: e.clientX, y: e.clientY };
            }
            return;
        }

        if (isSelecting && selectionStart) {
            const rect = containerRef.current.getBoundingClientRect();
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
        setIsDraggingNodes(false);
        setDraggedNode(null);
        setIsSelecting(false);
        setSelectionBox(null);
        setSelectionStart(null);
    };


    const handlePositionChange = useCallback((id, pos) => {
        if (!selectedNodes.has(id)) {
            updateNode(id, { ...nodes.find(n => n.id === id), position: pos });
        }
    }, [nodes, selectedNodes, updateNode]);

    return (
        <div
            ref={containerRef}
            className="relative w-full h-screen bg-gray-50 overflow-hidden"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            {/* UI Buttons (fixed relative to the screen) */}
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

            {/* Workspace (moves relative to the screen) */}
            <div
                className="absolute"
                style={{
                    transform: `translate(${offset.x}px, ${offset.y}px)`,
                }}
                ref={boundaryRef}
            >
                 {/* Nodes (fixed relative to the workspace) */}
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
                        onPositionChange={handlePositionChange}
                        allNodes={nodes}
                        updateNodeQ={updateNodeQ}
                        isSelected={selectedNodes.has(node.id)}
                        onSelect={handleNodeSelect}
                        settings={settings}
                        onDragStart={handleNodeDragStart}
                    />
                ))}
            </div>

             {/* Connections (fixed relative to the screen) */}
            <svg
                className="absolute top-0 left-0 w-full h-full pointer-events-none"
                style={{ zIndex: 1 }}
            >
                {connections.map((conn, idx) => {
                    const sourceNode = nodes.find(n => n.id === conn.sourceId);
                    const targetNode = nodes.find(n => n.id === conn.targetId);
                    if (!sourceNode || !targetNode) return null;

                    // Calculate positions relative to the screen
                    const sourceX = sourceNode.position.x + 320 + offset.x;
                    const sourceY = sourceNode.position.y + 64 + offset.y;
                    const targetX = targetNode.position.x + offset.x;
                    const targetY = targetNode.position.y + 64 + offset.y;
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
            </svg>

            {/* Selection Box (fixed relative to the screen) */}
            {selectionBox && (
                <div
                    className="absolute border border-blue-500 bg-blue-100 bg-opacity-10"
                    style={{
                        left: selectionBox.x + offset.x,
                        top: selectionBox.y + offset.y,
                        width: selectionBox.width,
                        height: selectionBox.height,
                    }}
                />
            )}
        </div>
    );
};

export default ComputationalFramework;
