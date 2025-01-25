import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Edit2, MoreVertical, Copy, Trash, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import styles from "./ComputationalFramework.module.css";
import * as math from 'mathjs';

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
    settings,
    onDragStart
}) => {

    const isNodeSelected = useMemo(() => isSelected, [isSelected]);
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
    const effectDependencies = useMemo(() => {
        const inputNodeIds = connections
            .filter(c => c.targetId === node.id)
            .map(c => allNodes.find(n => n.id === c.sourceId)?.id || 'undefined')
            .sort()
            .join(',');


        return [
            node.formula,
            JSON.stringify(node.inputs),
            node.useMod2,
            inputNodeIds,
            allNodes.find(n => n.id === node.id)?.q,
            settings.modBase,
            settings.maxEvalDepth,
            settings.delay,

        ].join(':')
    }, [node, connections, allNodes, settings]);


    useMemo(() => {
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
                            const sanitizedName = n.name.replace(/ /g, '_');
                            acc[sanitizedName] = () => nodeCall(n.id);
                            return acc;
                        }, {}),
                        ...math // Add all mathjs functions to the scope
                    };



                    try {
                        const matches = currentNode.formula.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || [];
                        const undefinedVars = matches.filter(v => scope[v] === undefined);
                        if (undefinedVars.length > 0) {
                            throw new Error(`Undefined variables: ${undefinedVars.join(', ')}`);
                        }


                        let result = math.evaluate(currentNode.formula, scope);
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
                if (node.q !== result) {
                    updateNodeQ(node.id, result);

                    // Find downstream nodes and trigger update
                    const downstreamNodes = connections
                        .filter(c => c.sourceId === node.id)
                        .map(c => allNodes.find(n => n.id === c.targetId))
                        .filter(downstreamNode => !!downstreamNode);

                    downstreamNodes.forEach(downstreamNode => {
                        updateNodeQ(downstreamNode.id, downstreamNode.q)
                    })
                }
            } catch (error) {
                setFormulaError(error.message);
                updateNodeQ(node.id, 0);
            }
        };

        const timeoutId = setTimeout(evaluateFormula, settings.delay);
        return () => clearTimeout(timeoutId);
    }, [effectDependencies, settings.delay, updateNodeQ, node.formula, node.useMod2, node.id, connections, allNodes, settings.maxEvalDepth, settings.modBase]);


    const handleNodeDragStart = (e) => {
        onDragStart(node.id, e);
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
        if (!settings.colorMode) return 'white';
        const hue = Math.max(0, Math.min(360, (node.q / settings.modBase) * 360));
        const saturation = 0.2;
        const value = 1;
        const rgb = hsvToRgb(hue, saturation, value);
        return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
    }, [node.q, settings.modBase, settings.colorMode]);

    return (
        <Card
            ref={nodeRef}
            className={`absolute w-80 shadow-lg z-10 ${isNodeSelected ? styles.selectedNode : ''}`}
            style={{
                left: position.x,
                top: position.y,
                cursor: 'grab',
                backgroundColor: backgroundColor,
                WebkitUserSelect: 'none',
                MozUserSelect: 'none',
                msUserSelect: 'none',
                userSelect: 'none',
                transition: 'background-color 0.2s ease-in-out, transform 0.1s ease-in-out, border 0.2s ease-in-out',
                transform:  'scale(1)'
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
            {isNodeSelected && <div className={styles.overlay} style={{ "--tint-strength": settings.selectionTintStrength }}/>}
        </Card>
    );
};

export default ComputationalNode;
