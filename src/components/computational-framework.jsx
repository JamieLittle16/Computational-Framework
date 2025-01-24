import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Copy, Edit2, MoreVertical, Plus, Save, Settings2, Trash, Upload, X } from 'lucide-react';
import { evaluate } from 'mathjs';
import { useCallback, useEffect, useRef, useState, useMemo } from 'react';

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

// Settings component
const SettingsPanel = ({ settings, onSettingsChange }) => {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="initialQ">Initial Q Value</Label>
        <Input
          id="initialQ"
          type="number"
          value={settings.initialQ}
          onChange={(e) => onSettingsChange({
            ...settings,
            initialQ: parseFloat(e.target.value) || 0
          })}
        />
        <p className="text-sm text-gray-500">Default Q value for new nodes</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="modBase">Mod Base</Label>
          <Input
            id="modBase"
            type="number"
            min="2"
            value={settings.modBase}
              onChange={(e) => {
                const value = parseInt(e.target.value) || 2;
                onSettingsChange({
                  ...settings,
                   modBase: Math.max(2, value)
                 });
               }}
           />
        <p className="text-sm text-gray-500">Base for modular arithmetic (minimum 2)</p>
      </div>
        <div className="space-y-2">
          <Label htmlFor="maxEvalDepth">Max Evaluation Depth</Label>
          <Input
            id="maxEvalDepth"
            type="number"
            min="1"
            value={settings.maxEvalDepth}
            onChange={(e) => {
                const value = parseInt(e.target.value) || 100;
                onSettingsChange({
                  ...settings,
                    maxEvalDepth: Math.max(1, value)
               });
            }}
          />
          <p className="text-sm text-gray-500">Maximum depth of evaluation to prevent infinite loops</p>
        </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="colorMode"
          checked={settings.colorMode}
          onCheckedChange={(checked) => onSettingsChange({ ...settings, colorMode: checked })}
        />
        <label
          htmlFor="colorMode"
          className="text-sm text-gray-700 cursor-pointer"
        >
          Enable Colour-Coding
        </label>
      </div>
    </div>
  );
};

const ComputationalNode = ({
    node,
    updateNode,
    deleteNode,
    duplicateNode,
    connections,
    createConnection,
    position,
    onPositionChange,
    allNodes,
    updateNodeQ,
    isSelected,
    onSelect,
    settings
}) => {
    const isNodeSelected = useMemo(() => isSelected, [isSelected]);
    const [isDragging, setIsDragging] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    const [nodeName, setNodeName] = useState(`Node ${node.id}`);
    const [formulaError, setFormulaError] = useState('');
    const [newInputName, setNewInputName] = useState('');
    const [isDraggingConnection, setIsDraggingConnection] = useState(false);
    const [showMenu, setShowMenu] = useState(false);

    const nodeRef = useRef(null);
    const evaluationDepth = useRef(0);

    // Connection handling
    const handleConnectionStart = (e) => {
        e.stopPropagation();
        setIsDraggingConnection(true);
        e.dataTransfer.setData('sourceNodeId', node.id.toString());
    };

    const handleInputDrop = (e, inputName) => {
        e.preventDefault();
        const sourceNodeId = parseInt(e.dataTransfer.getData('sourceNodeId'));
        if (sourceNodeId !== node.id) { // Prevent self-connection
            createConnection(sourceNodeId, node.id, inputName);
        }
    };

    const handleInputFocus = (e) => {
        e.stopPropagation();
    };

    const handleNameEdit = (e) => {
        e.stopPropagation();
        setIsEditingName(true);
    };

    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setShowMenu(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [setShowMenu]);

    // Get connected input value
    const getConnectedInputValue = useCallback((inputName) => {
        const connection = connections.find(c => c.targetId === node.id && c.inputName === inputName);
        if (connection) {
            const sourceNode = allNodes.find(n => n.id === connection.sourceId);
            return sourceNode ? sourceNode.q : 0;
        }
        return 0;
    }, [connections, node.id, allNodes]);

    // Formula evaluation effect
    useEffect(() => {
        const evaluateFormula = () => {
            try {
                if (!node.formula) {
                    setFormulaError('');
                    return;
                }

                evaluationDepth.current = 0;
                 const evaluateWithDepthCheck = (nodeId, visited = new Set()) => {
                    if (evaluationDepth.current > settings.maxEvalDepth) {
                        throw new Error('Maximum evaluation depth exceeded');
                    }
                    evaluationDepth.current++;

                    const currentNode = allNodes.find(n => n.id === nodeId);
                    if (!currentNode || visited.has(nodeId)) return 0;
                    visited.add(nodeId);

                   const nodeCall = (calledNodeId) => {
                      if (evaluationDepth.current > settings.maxEvalDepth) {
                            throw new Error('Maximum evaluation depth exceeded');
                      }
                        return evaluateWithDepthCheck(calledNodeId, new Set(visited));
                    }
                     const scope = {
                       q: currentNode.q,
                       Q: currentNode.q,
                       ...Object.entries(currentNode.inputs).reduce((acc, [key, input]) => {
                         if (input.isConnected) {
                           const connection = connections.find(c => c.targetId === currentNode.id && c.inputName === key);
                           if (connection) {
                             acc[key] = evaluateWithDepthCheck(connection.sourceId, new Set(visited));
                           }
                         } else {
                           acc[key] = input.value;
                         }
                         return acc;
                       }, {}),
                       ...allNodes.reduce((acc, n) => {
                         acc[n.name] = () => nodeCall(n.id);
                         return acc;
                        }, {})
                    };



                    try {
                        const matches = currentNode.formula.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || [];
                        const undefinedVars = matches.filter(v => scope[v] === undefined);
                        if (undefinedVars.length > 0) {
                            throw new Error(`Undefined variables: ${undefinedVars.join(', ')}`);
                        }


                        let result = evaluate(currentNode.formula, scope);
                        if (currentNode.useMod2) {
                            result = ((result % settings.modBase) + settings.modBase) % settings.modBase;
                        }
                        return result;
                    } catch (e) {
                        throw new Error(`Error in formula: ${e.message}`);
                    }
                };

               const result = evaluateWithDepthCheck(node.id);
                setFormulaError('');
                updateNodeQ(node.id, result);
            } catch (error) {
                setFormulaError(error.message);
                updateNodeQ(node.id, 0);
            }
        };

        const timeoutId = setTimeout(evaluateFormula, 100);
        return () => clearTimeout(timeoutId);
    }, [node.formula, node.inputs, node.useMod2, connections, allNodes, node.id, updateNodeQ, settings.modBase, settings.maxEvalDepth]);

    const handleNodeDragStart = (e) => {
        if (e.button !== 0 || e.target.tagName === 'INPUT' || e.target.closest('button')) return;

        e.stopPropagation();
        e.preventDefault();

        const initialMouseX = e.clientX;
        const initialMouseY = e.clientY;
        const initialNodeX = position.x;
        const initialNodeY = position.y;

        setIsDragging(true);
        onSelect(node.id, e.shiftKey);

        const handleMove = (moveEvent) => {
            moveEvent.preventDefault();
            const dx = moveEvent.clientX - initialMouseX;
            const dy = moveEvent.clientY - initialMouseY;
            onPositionChange(node.id, {
                x: initialNodeX + dx,
                y: initialNodeY + dy
            });
        };

        const handleUp = (upEvent) => {
            setIsDragging(false);
            // Clear selection on any mouse up unless shift is pressed
            if (!upEvent.shiftKey) {
                onSelect(node.id, false);
            }
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
        };

        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);
    };

    const addInput = () => {
        if (newInputName.trim()) {
            updateNode(node.id, {
                ...node,
                inputs: {
                    ...node.inputs,
                    [newInputName]: { value: 0, isConnected: false }
                }
            });
            setNewInputName('');
        }
    };

    const handleConnectionDragStart = (e) => {
        e.dataTransfer.setData('sourceNodeId', node.id.toString());
    };

    const handleMenuToggle = (e) => {
        e.stopPropagation();
        setShowMenu(prev => !prev);
    };

     const backgroundColor = useMemo(() => {
        if (!settings.colorMode) return 'white'; // Use white if colorMode is off
          const hue = Math.max(0, Math.min(360, (node.q / settings.modBase) * 360));
          const saturation = 0.2;
          const value = 1;
          const rgb = hsvToRgb(hue, saturation, value);
          return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
        }, [node.q, settings.modBase, settings.colorMode]); // Only recalculate when qValue or modBase changes

    return (
        <Card
            ref={nodeRef}
            className="absolute w-80 shadow-lg z-10"
            style={{
                left: position.x,
                top: position.y,
                cursor: isDragging ? 'grabbing' : 'grab',
                backgroundColor: isNodeSelected ? '#f0f9ff' : backgroundColor,
                WebkitUserSelect: 'none',
                MozUserSelect: 'none',
                msUserSelect: 'none',
                userSelect: 'none',
                transition: 'background-color 0.2s ease-in-out, transform 0.1s ease-in-out',
                transform: isDragging ? 'scale(1.02)' : 'scale(1)'
            }}
            onMouseDown={handleNodeDragStart}
        >
            <div className="flex justify-between items-center p-4 border-b">
                {isEditingName ? (
                    <Input
                        value={nodeName}
                        onChange={(e) => setNodeName(e.target.value)}
                        onBlur={() => {
                            setIsEditingName(false);
                            updateNode(node.id, { ...node, name: nodeName });
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                setIsEditingName(false);
                                updateNode(node.id, { ...node, name: nodeName });
                            }
                        }}
                        className="h-8 w-40"
                        autoFocus
                        onMouseDown={(e) => e.stopPropagation()}
                        onFocus={handleInputFocus}
                    />
                ) : (
                    <div className="flex items-center gap-2">
                        <h3 className="text-lg font-medium">{node.name || `Node ${node.id}`}</h3>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={handleNameEdit}
                        >
                            <Edit2 className="h-4 w-4" />
                        </Button>
                    </div>
                )}
                <div className="relative" ref={menuRef}>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={handleMenuToggle}
                    >
                        <MoreVertical className="h-4 w-4" />
                    </Button>
                    {showMenu && (
                        <div
                            className="absolute right-0 mt-2 w-48 bg-white rounded-md border shadow-lg z-50 animate-in fade-in zoom-in duration-200"
                            style={{
                                transformOrigin: 'top right'
                            }}
                        >
                            <Button
                                variant="ghost"
                                className="w-full justify-start px-3 py-2 text-sm transition-colors hover:bg-gray-50 group"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    duplicateNode(node);
                                    setShowMenu(false);
                                }}
                            >
                                <Copy className="h-4 w-4 mr-2" />
                                Duplicate
                            </Button>
                            <Button
                                variant="ghost"
                                className="w-full justify-start px-3 py-2 text-sm text-red-600 hover:text-red-700"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    deleteNode(node.id);
                                    setShowMenu(false);
                                }}
                            >
                                <Trash className="h-4 w-4 mr-2" />
                                Delete
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            <CardContent className="p-4 space-y-4">
                <div>
                    <div className="flex justify-between items-center">
                        <label className="text-sm font-medium text-gray-700">
                            Q Value: {isNaN(node.q) ? '0' : node.q.toFixed(2)}
                        </label>
                        <div
                            className="w-6 h-6 bg-blue-500 rounded-full cursor-pointer hover:bg-blue-600 transition-all duration-200 hover:scale-110 hover:shadow-md"
                            draggable
                            onMouseDown={(e) => e.stopPropagation()}
                            onDragStart={handleConnectionStart}
                            style={{ width: '16px', height: '16px' }} // Increased size for the output connection point
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Inputs:</label>
                    <div className="space-y-2">
                        {Object.entries(node.inputs).map(([name, input]) => (
                            <div key={name} className="flex items-center gap-2">
                                <div
                                    className="w-6 h-6 bg-gray-200 rounded-full hover:bg-gray-300 transition-all duration-200 hover:scale-110 cursor-pointer"
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={(e) => handleInputDrop(e, name)}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    style={{ width: '16px', height: '16px' }} // Increased size for the input connection point
                                />
                                <Input
                                    type="number"
                                    value={input.isConnected ? getConnectedInputValue(name) : (input.value === 0 ? '' : input.value)}
                                    onChange={(e) => {
                                        const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                        updateNode(node.id, {
                                            ...node,
                                            inputs: {
                                                ...node.inputs,
                                                [name]: { ...input, value: isNaN(value) ? 0 : value }
                                            }
                                        });
                                    }}
                                    disabled={input.isConnected}
                                    className="h-8"
                                    placeholder="0"
                                    onMouseDown={(e) => e.stopPropagation()}
                                />
                                <span className="font-medium min-w-[20px]">{name}</span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => {
                                        const newInputs = { ...node.inputs };
                                        delete newInputs[name];
                                        updateNode(node.id, { ...node, inputs: newInputs });
                                    }}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-2 mt-2">
                        <Input
                            value={newInputName}
                            onChange={(e) => setNewInputName(e.target.value)}
                            placeholder="New input name"
                            className="h-8"
                        />
                        <Button
                            onClick={addInput}
                            size="sm"
                            className="px-3"
                        >
                            Add
                        </Button>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Formula:</label>
                    <Input
                        value={node.formula}
                        onChange={(e) => updateNode(node.id, { ...node, formula: e.target.value })}
                        className={`h-8 ${formulaError ? 'border-red-500' : ''}`}
                        placeholder="e.g., a + b + q"
                    />
                    {formulaError && (
                        <p className="text-sm text-red-500 mt-1">{formulaError}</p>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <Checkbox
                        id={`mod2-${node.id}`}
                        checked={node.useMod2}
                        onCheckedChange={(checked) => updateNode(node.id, { ...node, useMod2: checked })}
                    />
                    <label
                        htmlFor={`mod2-${node.id}`}
                        className="text-sm text-gray-700 cursor-pointer"
                    >
                        Use Mod {settings.modBase}
                    </label>
                </div>
            </CardContent>
        </Card>
    );
};

const ComputationalFramework = () => {
  const [nodes, setNodes] = useState([]);
  const [connections, setConnections] = useState([]);
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
        colorMode: false
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

                // Delete selected nodes
                if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodes.size > 0) {
                  setNodes(prevNodes => prevNodes.filter(node => !selectedNodes.has(node.id)));
                  setConnections(prevConns =>
                    prevConns.filter(conn =>
                      !selectedNodes.has(conn.sourceId) && !selectedNodes.has(conn.targetId)
                    )
                  );
                  setSelectedNodes(new Set());
                }
              };

              window.addEventListener('keydown', handleKeyDown);
              return () => window.removeEventListener('keydown', handleKeyDown);
            }, [nodes, selectedNodes, nextNodeId]);

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
              }
            };

            const handleMouseUp = () => {
                if (isSelecting && selectionBox && selectionBox.width === 0 && selectionBox.height === 0) {
                  setSelectedNodes(new Set());
                }

              setIsPanning(false);
              setIsSelecting(false);
              setSelectionBox(null);
              setSelectionStart(null);
            };
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
                      width={workspaceSize.width}
                      height={workspaceSize.height}
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

                      return (
                        <g key={idx}>
                          <path
                            d={`M ${sourceX} ${sourceY}
                               C ${sourceX + controlX} ${sourceY},
                                 ${targetX - controlX} ${targetY},
                                 ${targetX} ${targetY}`}
                            stroke="#666"
                            strokeWidth="2"
                            fill="none"
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
          }

export default ComputationalFramework;
