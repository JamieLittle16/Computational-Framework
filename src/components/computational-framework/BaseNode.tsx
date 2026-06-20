import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Edit2, MoreVertical, Copy, Trash, X } from 'lucide-react';
import styles from './ComputationalFramework.module.css';
import hsvToRgb from '@/utils/colourUtils';
import type { BaseNodeProps } from '@/types';

interface BaseNodeExtendedProps extends BaseNodeProps {
    children?: React.ReactNode;
}

const BaseNode = React.memo<BaseNodeExtendedProps>(
    ({
        node,
        updateNode,
        deleteNode,
        duplicateNode,
        connections,
        createConnection,
        position,
        allNodes,
        isSelected,
        settings,
        onDragStart,
        handleInputChange,
        transformNode,
        children,
    }) => {
        const [isEditingName, setIsEditingName] = useState(false);
        const [nodeName, setNodeName] = useState(node.name || `Node ${node.id}`);
        const [newInputName, setNewInputName] = useState('');
        const [showMenu, setShowMenu] = useState(false);
        const [hoveredInputs, setHoveredInputs] = useState<Set<string>>(new Set());
        const menuRef = useRef<HTMLDivElement>(null);

        const getConnectedInputValue = useCallback(
            (inputName: string): number => {
                try {
                    const connection = connections.find(
                        (c) => c.targetId === node.id && c.inputName === inputName,
                    );
                    if (connection) {
                        const sourceNode = allNodes.find((n) => n.id === connection.sourceId);
                        return sourceNode ? sourceNode.q : 0;
                    }
                    return 0;
                } catch {
                    return 0;
                }
            },
            [connections, node.id, allNodes],
        );

        // handleConnectionStart is intentionally unused in BaseNode — BaseNode renders
        // child-specific content (e.g. LoggerNode) that doesn't have an output port.
        // Output ports are owned by ComputationalNode which has its own drag handler.

        const handleInputDrop = useCallback(
            (e: React.DragEvent<HTMLDivElement>, inputName: string) => {
                e.preventDefault();
                setHoveredInputs((prev) => {
                    const next = new Set(prev);
                    next.delete(inputName);
                    return next;
                });
                try {
                    const sourceNodeId = e.dataTransfer.getData('sourceNodeId');
                    if (sourceNodeId && sourceNodeId !== node.id) {
                        createConnection(sourceNodeId, node.id, inputName);
                    }
                } catch (error) {
                    console.error('Error during input drop:', error);
                }
            },
            [createConnection, node.id],
        );

        const handleInputDragEnter = useCallback((inputName: string) => {
            setHoveredInputs((prev) => new Set([...prev, inputName]));
        }, []);

        const handleInputDragLeave = useCallback((inputName: string) => {
            setHoveredInputs((prev) => {
                const next = new Set(prev);
                next.delete(inputName);
                return next;
            });
        }, []);

        const handleInputFocus = useCallback((e: React.FocusEvent) => {
            e.stopPropagation();
        }, []);

        const handleNameEdit = useCallback((e: React.MouseEvent) => {
            e.stopPropagation();
            setIsEditingName(true);
        }, []);

        const handleMenuToggle = useCallback((e: React.MouseEvent) => {
            e.stopPropagation();
            setShowMenu((prev) => !prev);
        }, []);

        useEffect(() => {
            const handleClickOutside = (event: MouseEvent) => {
                if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                    setShowMenu(false);
                }
            };
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }, []);

        const handleNodeDragStart = useCallback(
            (e: React.MouseEvent) => {
                onDragStart(node.id, e);
            },
            [node.id, onDragStart],
        );

        const commitNameEdit = useCallback(() => {
            setIsEditingName(false);
            updateNode(node.id, { ...node, name: nodeName });
        }, [node, nodeName, updateNode]);

        const addInput = useCallback(() => {
            if (newInputName.trim()) {
                updateNode(node.id, {
                    ...node,
                    inputs: {
                        ...node.inputs,
                        [newInputName.trim()]: { value: 0, isConnected: false },
                    },
                });
                setNewInputName('');
            }
        }, [node, newInputName, updateNode]);

        const backgroundColor = useMemo(() => {
            if (!settings?.colorMode) return undefined;
            try {
                const hue = Math.max(0, Math.min(360, (node.q / (settings.modBase || 2)) * 360));
                const rgb = hsvToRgb(hue, 0.2, 1);
                return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
            } catch {
                return undefined;
            }
        }, [node.q, settings?.modBase, settings?.colorMode]);

        return (
            <Card
                className={`absolute w-80 shadow-lg z-10 ${isSelected ? styles.selectedNode : ''}`}
                style={{
                    left: position.x,
                    top: position.y,
                    cursor: 'grab',
                    ...(backgroundColor ? { backgroundColor } : {}),
                    userSelect: 'none',
                    transition: 'background-color 0.2s ease-in-out, border 0.2s ease-in-out',
                }}
                onMouseDown={handleNodeDragStart}
            >
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b">
                    {isEditingName ? (
                        <Input
                            value={nodeName}
                            onChange={(e) => setNodeName(e.target.value)}
                            onBlur={commitNameEdit}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') commitNameEdit();
                            }}
                            className="h-8 w-40"
                            autoFocus
                            onMouseDown={(e) => e.stopPropagation()}
                            onFocus={handleInputFocus}
                        />
                    ) : (
                        <div className="flex items-center gap-2">
                            <h3 className="text-lg font-medium text-foreground">
                                {node.name || `Node ${node.id}`}
                            </h3>
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
                                className="absolute right-0 mt-2 w-48 rounded-md border bg-card text-card-foreground shadow-lg z-50 animate-in fade-in zoom-in duration-200"
                                style={{ transformOrigin: 'top right' }}
                            >
                                <Button
                                    variant="ghost"
                                    className="w-full justify-start px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        duplicateNode(node);
                                        setShowMenu(false);
                                    }}
                                >
                                    <Copy className="h-4 w-4 mr-2" /> Duplicate
                                </Button>
                                {node.type === 'logger' ? (
                                    <Button
                                        variant="ghost"
                                        className="w-full justify-start px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            transformNode(node, 'computational');
                                            setShowMenu(false);
                                        }}
                                    >
                                        <Copy className="h-4 w-4 mr-2" /> Transform to Computational
                                    </Button>
                                ) : (
                                    <Button
                                        variant="ghost"
                                        className="w-full justify-start px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            transformNode(node, 'logger');
                                            setShowMenu(false);
                                        }}
                                    >
                                        <Copy className="h-4 w-4 mr-2" /> Transform to Logger
                                    </Button>
                                )}
                                <Button
                                    variant="ghost"
                                    className="w-full justify-start px-3 py-2 text-sm text-red-600 hover:text-red-700"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        deleteNode(node.id);
                                        setShowMenu(false);
                                    }}
                                >
                                    <Trash className="h-4 w-4 mr-2" /> Delete
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

                <CardContent className="p-4 space-y-4">
                    {/* Inputs */}
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                            Inputs:
                        </label>
                        <div className="space-y-2">
                                 {Object.entries(node.inputs).map(([name, input]) => {
                                     const isOver = hoveredInputs.has(name);
                                     const portClass = input.isConnected
                                         ? 'bg-blue-500 border-2 border-blue-300 shadow-sm shadow-blue-300'
                                         : isOver
                                           ? 'bg-green-400 border-2 border-green-200 scale-125 shadow-sm shadow-green-300'
                                           : 'bg-gray-300 hover:bg-gray-400 border-2 border-transparent hover:scale-110';
                                     return (
                                         <div key={name} className="flex items-center gap-2">
                                              <div
                                                  className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full transition-all duration-150 cursor-pointer ${portClass}`}
                                                  title={
                                                      input.isConnected
                                                          ? `${name} — connected`
                                                          : isOver
                                                            ? `Drop to connect → ${name}`
                                                          : `${name} — drag a wire here`
                                                  }
                                                  onDragOver={(e) => e.preventDefault()}
                                                  onDragEnter={() => handleInputDragEnter(name)}
                                                  onDragLeave={() => handleInputDragLeave(name)}
                                                  onDrop={(e) => handleInputDrop(e, name)}
                                                  onMouseDown={(e) => e.stopPropagation()}
                                              >
                                                  <div className="h-5 w-5 rounded-full bg-inherit" />
                                              </div>
                                    <Input
                                        type="number"
                                        value={
                                            input.isConnected
                                                ? getConnectedInputValue(name)
                                                : input.value === 0
                                                  ? ''
                                                  : input.value
                                        }
                                        onChange={(e) => {
                                            const value =
                                                e.target.value === ''
                                                    ? 0
                                                    : parseFloat(e.target.value);
                                            handleInputChange(
                                                node.id,
                                                name,
                                                isNaN(value) ? 0 : value,
                                            );
                                        }}
                                        disabled={input.isConnected}
                                        className="h-8"
                                        placeholder="0"
                                        onMouseDown={(e) => e.stopPropagation()}
                                    />
                                    <span className="font-medium min-w-[20px] text-sm text-foreground">{name}</span>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 flex-shrink-0"
                                        onClick={() => {
                                            const newInputs = { ...node.inputs };
                                            delete newInputs[name];
                                            updateNode(node.id, { ...node, inputs: newInputs });
                                        }}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                 </div>
                                     );
                                 })}
                        </div>
                        <div className="flex gap-2 mt-2">
                            <Input
                                value={newInputName}
                                onChange={(e) => setNewInputName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') addInput();
                                }}
                                placeholder="New input name"
                                className="h-8"
                                onMouseDown={(e) => e.stopPropagation()}
                            />
                            <Button onClick={addInput} size="sm" className="px-3">
                                Add
                            </Button>
                        </div>
                    </div>

                    {/* Slot for node-type-specific content */}
                    {children}
                </CardContent>

                {isSelected && (
                    <div
                        className={styles.overlay}
                        style={
                            {
                                '--tint-strength': settings?.selectionTintStrength,
                            } as React.CSSProperties
                        }
                    />
                )}
            </Card>
        );
    },
);

BaseNode.displayName = 'BaseNode';

export default BaseNode;
