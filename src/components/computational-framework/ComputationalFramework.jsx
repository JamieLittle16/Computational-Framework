import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Copy, Edit2, MoreVertical, Plus, Save, Settings2, Trash, Upload, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import ComputationalNode from './ComputationalNode';
import SettingsPanel from './SettingsPanel';
import * as math from 'mathjs';
import styles from "./ComputationalFramework.module.css";
import { isEqual } from 'lodash'; // Install with npm install lodash

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
    const copiedNodes = useRef([]);
    const nodesRef = useRef(nodes);
    const [settings, setSettings] = useState({
        initialQ: 0,
        modBase: 2,
        maxEvalDepth: 100,
        colorMode: false,
        delay: 100,
        selectionTintStrength: 0.15
    });
    const connectionsRef = useRef(connections);
    const settingsRef = useRef(settings);
    // Store dependency regex for reuse
    const [dependencyRegex, setDependencyRegex] = useState(null);

    //Update refs
    useEffect(() => {
        nodesRef.current = nodes;
    }, [nodes]);

    useEffect(() => {
        connectionsRef.current = connections;
    }, [connections]);

    useEffect(() => {
        settingsRef.current = settings;
    }, [settings]);

     // Generate and update the regex for dependencies only when node names change
    useEffect(() => {
         const nodeNames = nodes.map(node => node.name.replace(/ /g, '_'));
         const regex = new RegExp(`\\b(${nodeNames.join('|')})\\b\\s*\\(`, 'g');
         setDependencyRegex(regex);
    }, [nodes]);


    // Optimized dependency extraction using pre-compiled regex
    const extractNodeDependencies = useCallback((formula, allNodes) => {
        if (!dependencyRegex) return [];
        const dependencies = [];
        let match;
        while ((match = dependencyRegex.exec(formula)) !== null) {
            dependencies.push(match[1]);
        }

        return dependencies.map(name => allNodes.find(n => n.name.replace(/ /g, '_') === name)?.id).filter(id => id);
    }, [dependencyRegex]);


      const buildDependencyGraph = useCallback(() => {
        const graph = new Map();
        const inDegree = new Map();

        nodesRef.current.forEach(node => {
          graph.set(node.id, []);
          inDegree.set(node.id, 0);
        });

        connectionsRef.current.forEach(conn => {
          graph.get(conn.sourceId).push(conn.targetId);
          inDegree.set(conn.targetId, inDegree.get(conn.targetId) + 1);
        });

        nodesRef.current.forEach(node => {
            const dependencies = extractNodeDependencies(node.formula, nodesRef.current);
            dependencies.forEach(dependencyId => {
              graph.get(dependencyId).push(node.id);
              inDegree.set(node.id, inDegree.get(node.id) + 1);
            })
        });

        const queue = [];
        inDegree.forEach((degree, nodeId) => {
          if (degree === 0) queue.push(nodeId);
        });

        const sortedOrder = [];
        while (queue.length > 0) {
          const nodeId = queue.shift();
          sortedOrder.push(nodeId);
          graph.get(nodeId).forEach(dependentId => {
            inDegree.set(dependentId, inDegree.get(dependentId) - 1);
            if (inDegree.get(dependentId) === 0) queue.push(dependentId);
          });
        }

        if (sortedOrder.length !== nodesRef.current.length) {
          console.warn("Cycle detected in dependencies");
          nodesRef.current.forEach(node => {
            if (!sortedOrder.includes(node.id)) sortedOrder.push(node.id);
          });
        }

        return sortedOrder;
      }, [extractNodeDependencies]); // Only rebuild when extract changes

    // Create a reusable scope object
    const createEvaluationScope = useCallback((node, allNodes, connections, settings) => {
        const scope = {
             q: node.q,
             Q: () => node.q,
            ...math
        };
         // Add inputs to scope
        Object.entries(node.inputs).forEach(([inputName, input]) => {
            if (input.isConnected) {
              const connection = connections.find(c =>
                c.targetId === node.id && c.inputName === inputName
              );
              const sourceNode = connection ?
                allNodes.find(n => n.id === connection.sourceId) : null;
              scope[inputName] = sourceNode ? sourceNode.q : 0;
            } else {
                scope[inputName] = input.value;
            }
        });
         // Add node references
            allNodes.forEach(n => {
             const sanitizedName = n.name.replace(/ /g, '_');
             scope[sanitizedName] = () => {
               const targetNode = allNodes.find(nn => nn.id === n.id);
               return targetNode ? targetNode.q : 0;
             };
           });
        return scope;
    }, []);



    const evaluateNodeFormula = useCallback((node, scope, settings) => {

      let result;
      try {
         result = math.evaluate(node.formula, scope);
      } catch (e) {
        throw new Error(`Formula error: ${e.message}`);
      }

      if (isNaN(result)) {
        return 0;
      }

      return result;
    }, []);

    // Evaluate nodes only when necessary
    const evaluateAllNodes = useCallback(() => {
        const currentNodes = nodesRef.current.map(node => ({ ...node }));
        const currentConnections = [...connectionsRef.current];
        const currentSettings = settingsRef.current;
        const sortedIds = buildDependencyGraph();


         let hasUpdates = false;
         const updatedNodes = currentNodes.map(node => ({ ...node }));

         sortedIds.forEach(nodeId => {
              const node = updatedNodes.find(n => n.id === nodeId);
             if (!node) return;

             const scope = createEvaluationScope(node, updatedNodes, currentConnections, currentSettings);


                let newQ, error = '';
                try {
                  newQ = evaluateNodeFormula(node, scope, currentSettings);
                  if (node.useMod2) {
                      newQ = ((newQ % currentSettings.modBase) + currentSettings.modBase) % currentSettings.modBase;
                  }
                } catch (e) {
                   newQ = 0;
                   error = e.message;
                }
                 if (node.q !== newQ || node.error !== error) {
                    node.q = newQ;
                    node.error = error;
                    hasUpdates = true;
                }


         });

         if (hasUpdates) {
            setNodes(prevNodes => {
                if (isEqual(prevNodes, updatedNodes)) return prevNodes;
                return updatedNodes;
            });
        }

    }, [buildDependencyGraph, createEvaluationScope, evaluateNodeFormula]);


    // Evaluate nodes with a delay
    useEffect(() => {
       const timeoutId = setTimeout(evaluateAllNodes, settings.delay);
       return () => clearTimeout(timeoutId);
    }, [evaluateAllNodes, settings.delay]);

    const createNode = useCallback(() => {
        try {
            const container = containerRef.current;
            if (!container) throw new Error("Container ref is not valid.");

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
                name: `Node ${nextNodeId}`,
                error: ''
            };
            setNodes(prevNodes => [...prevNodes, newNode]);
            setNextNodeId(prevId => prevId + 1);
        } catch (error) {
            console.error("Error creating node:", error);
        }
    }, [nextNodeId, offset, settings.initialQ]);

    const saveSetup = () => {
        try {
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
        } catch (error) {
            console.error("Error saving setup:", error);
        }
    };

    const loadSetup = (e) => {
        try {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const setup = JSON.parse(e.target.result);
                        setNodes(setup.nodes.map(n => ({
                            ...n,
                            error: n.error || ''
                          })));
                        setConnections(setup.connections);
                        setNextNodeId(setup.nextNodeId);
                        setOffset({ x: 0, y: 0 });
                        if (setup.settings) {
                            setSettings(setup.settings);
                        }
                    } catch (error) {
                        console.error('Error parsing setup:', error);
                    }
                };
                reader.readAsText(file);
            }
        } catch (error) {
            console.error("Error loading setup:", error);
        }
    };

    const updateNode = useCallback((id, updatedNode) => {
        try {
            setNodes(prevNodes =>
                prevNodes.map(node => node.id === id ? updatedNode : node)
            );
        } catch (error) {
            console.error("Error updating node:", error);
        }
    }, []);

    const deleteNode = useCallback((id) => {
        try {
            setNodes(prevNodes => prevNodes.filter(node => node.id !== id));
            setConnections(prevConns =>
                prevConns.filter(conn => conn.sourceId !== id && conn.targetId !== id)
            );
        } catch (error) {
            console.error("Error deleting node:", error);
        }
    }, []);

    const duplicateNode = useCallback((node) => {
        try {
            const newNode = {
                ...node,
                id: nextNodeId,
                position: { x: node.position.x + 50, y: node.position.y + 50 }
            };
            setNodes(prevNodes => [...prevNodes, newNode]);
            setNextNodeId(prevId => prevId + 1);
        } catch (error) {
            console.error("Error duplicating node:", error);
        }
    }, [nextNodeId]);


    const copySelectedNodes = useCallback(() => {
        try{
            copiedNodes.current = nodes.filter(node => selectedNodes.has(node.id)).map(node => {
                const { id, ...nodeData } = node;
                return nodeData;
            });
        } catch (error){
            console.error("Error copying node:", error);
        }

    }, [nodes, selectedNodes]);

    const pasteCopiedNodes = useCallback(() => {
        try {
            if (copiedNodes.current.length === 0) return;

            const container = containerRef.current;
            if (!container) throw new Error("Container ref is not valid.");

            const rect = container.getBoundingClientRect();
            const centerX = (rect.width / 2) - 160 - offset.x;
            const centerY = (rect.height / 2) - 100 - offset.y;

            const newNodes = copiedNodes.current.map(nodeData => ({
                ...nodeData,
                id: nextNodeId,
                position: { x: centerX, y: centerY },
            }));

            setNodes(prevNodes => [...prevNodes, ...newNodes]);
            setNextNodeId(prevId => prevId + newNodes.length);

        } catch (error) {
            console.error("Error pasting node:", error);
        }

    }, [nextNodeId, offset]);

    const deleteSelectedNodes = useCallback(() => {
        try {
            selectedNodes.forEach(nodeId => {
                deleteNode(nodeId);
            });
            setSelectedNodes(new Set());
        } catch (error) {
            console.error("Error deleting selected nodes", error);
        }
    }, [selectedNodes, deleteNode]);

    const createConnection = useCallback((sourceId, targetId, inputName) => {
        try {
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
        } catch (error) {
            console.error("Error creating connection:", error)
        }
    }, []);

      const deleteSelectedConnections = useCallback(() => {
        try {
          setSelectedConnections(prev => {
            const newSet = new Set(prev);
            prev.forEach(connStr => {
              const [sourceId, targetId] = connStr.split('-');
              if (sourceId === id.toString() || targetId === id.toString()) {
                newSet.delete(connStr);
              }
            });
            return newSet;
          });
        } catch (error) {
            console.error("Error deleting selected connections", error);
        }
    }, []);

    const updateNodeQ = useCallback((id, newQ) => {
        try {
            setNodes(prevNodes =>
                prevNodes.map(node =>
                    node.id === id ? { ...node, q: newQ } : node
                )
            );
        } catch (error) {
            console.error("Error updating node Q value:", error);
        }
    }, []);

    const handleNodeSelect = (nodeId, isShiftKey) => {
        try {
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
        } catch (error) {
            console.error("Error selecting node:", error);
        }
    };

    const handleConnectionSelect = (sourceId, targetId, inputName, isShiftKey) => {
        try {
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
        } catch (error) {
            console.error("Error selecting connection:", error);
        }
    };

     const handleMouseDown = (e) => {
          try {
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
        } catch (error) {
            console.error("Error handling mouse down:", error)
        }
    };

    const handleNodeDragStart = useCallback((nodeId, e) => {
        try {
            if (e.button !== 0 || e.target.tagName === 'INPUT' || e.target.closest('button')) return;
            e.stopPropagation();
            e.preventDefault();
            if (!selectedNodes.has(nodeId)) {
                handleNodeSelect(nodeId, e.shiftKey);
            }

            setIsDraggingNodes(true);
            setDraggedNode(nodes.find(n => n.id === nodeId));
            lastMousePos.current = { x: e.clientX, y: e.clientY };
        } catch (error) {
            console.error("Error handling node drag start:", error);
        }
    }, [selectedNodes, nodes, handleNodeSelect]);

    const handleMouseMove = (e) => {
        try {
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
        } catch (error) {
            console.error("Error handling mouse move:", error);
        }
    };

    const handleMouseUp = () => {
        try {
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
        } catch (error) {
            console.error("Error handling mouse up:", error);
        }
    };


    const handlePositionChange = useCallback((id, pos) => {
        try {
            if (!selectedNodes.has(id)) {
                updateNode(id, { ...nodes.find(n => n.id === id), position: pos });
            }
        } catch (error) {
            console.error("Error handling position change:", error);
        }
    }, [nodes, selectedNodes, updateNode]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.ctrlKey && e.key === 'c') {
                copySelectedNodes();
            } else if (e.ctrlKey && e.key === 'v') {
                pasteCopiedNodes();
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
                deleteSelectedNodes();
                deleteSelectedConnections();
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [copySelectedNodes, pasteCopiedNodes, deleteSelectedNodes, deleteSelectedConnections]);

    return (
        <div
            ref={containerRef}
            className="relative w-full h-screen overflow-hidden bg-gray-50"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            {/* Squared background that moves with panning */}
            <div
                className="absolute inset-0 bg-repeat"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0H20V20H0z' fill='white' /%3E%3Cpath d='M0 0H20V20H0Z' stroke='%23e0e0e0' stroke-width='0.5' fill='none' /%3E%3C/svg%3E")`,
                    backgroundSize: '20px 20px',
                    transform: `translate(${offset.x % 20}px, ${offset.y % 20}px)`
                }}
            />
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

                        >
                         <path
                                d={`M ${sourceX} ${sourceY}
         C ${sourceX + controlX} ${sourceY},
           ${targetX - controlX} ${targetY},
           ${targetX} ${targetY}`}
                                stroke="transparent"
                                strokeWidth="15"
                                fill="none"
                                style={{pointerEvents: 'auto'}}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleConnectionSelect(conn.sourceId, conn.targetId, conn.inputName, e.shiftKey);
                                }}
                            />
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
                    className="absolute border border-blue-500 bg-blue-100 bg-opacity-20"
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
