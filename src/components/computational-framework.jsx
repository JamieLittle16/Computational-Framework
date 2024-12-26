"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { MoreVertical, Plus, Trash, Copy, X, Edit2, Save, Upload } from 'lucide-react';
import { evaluate } from 'mathjs';

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
  showMenu,
  setShowMenu
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nodeName, setNodeName] = useState(`Node ${node.id}`);
  const [formulaError, setFormulaError] = useState('');
  const [newInputName, setNewInputName] = useState('');
  const nodeRef = useRef(null);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const evaluationDepth = useRef(0);
  const MAX_EVALUATION_DEPTH = 100;

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (nodeRef.current && !nodeRef.current.contains(event.target)) {
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
          if (evaluationDepth.current > MAX_EVALUATION_DEPTH) {
            throw new Error('Maximum evaluation depth exceeded');
          }
          evaluationDepth.current++;

          const currentNode = allNodes.find(n => n.id === nodeId);
          if (!currentNode || visited.has(nodeId)) return 0;
          visited.add(nodeId);

          const scope = {
            q: currentNode.q,
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
              result = (result % 2);
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
  }, [node.formula, node.inputs, node.useMod2, connections, allNodes, node.id, updateNodeQ]);

  const handleNodeDragStart = (e) => {
    if (e.button !== 0) return;
    if (e.target.tagName === 'INPUT' || e.target.closest('button')) return;
    
    e.stopPropagation();
    e.preventDefault();
    
    const rect = nodeRef.current.getBoundingClientRect();
    dragStartPos.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      nodeX: position.x,
      nodeY: position.y
    };
    
    setIsDragging(true);
    onSelect(node.id, e.shiftKey);
  
    const handleMove = (moveEvent) => {
      if (!isDragging) return;
      moveEvent.preventDefault();
      
      const dx = moveEvent.clientX - dragStartPos.current.x - rect.left;
      const dy = moveEvent.clientY - dragStartPos.current.y - rect.top;
      
      onPositionChange(node.id, {
        x: dragStartPos.current.nodeX + dx,
        y: dragStartPos.current.nodeY + dy
      });
    };
  
    const handleUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  const handleConnectionDragStart = (e) => {
    e.dataTransfer.setData('sourceNodeId', node.id.toString());
  };

  const handleInputDrop = (e, inputName) => {
    e.preventDefault();
    const sourceNodeId = parseInt(e.dataTransfer.getData('sourceNodeId'));
    if (sourceNodeId !== node.id) {
      createConnection(sourceNodeId, node.id, inputName);
    }
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

  return (
    <Card 
      ref={nodeRef}
      className={`absolute w-80 shadow-lg select-none ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
      style={{ 
        left: position.x,
        top: position.y,
        cursor: isDragging ? 'grabbing' : 'grab',
        backgroundColor: isSelected ? '#f0f9ff' : 'white',
        touchAction: 'none',
        userSelect: 'none'
      }}
      onMouseDown={handleNodeDragStart}
  >
      <div className="flex justify-between items-center p-4 border-b">
        {isEditingName ? (
          <Input
            value={nodeName}
            onChange={(e) => setNodeName(e.target.value)}
            onBlur={() => setIsEditingName(false)}
            onKeyDown={(e) => e.key === 'Enter' && setIsEditingName(false)}
            className="h-8 w-40"
            autoFocus
            onFocus={handleInputFocus}
          />
        ) : (
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-medium">{nodeName}</h3>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setIsEditingName(true)}
            >
              <Edit2 className="h-4 w-4" />
            </Button>
          </div>
        )}
        <div className="relative">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8" 
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
          {showMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-md border shadow-lg z-10">
              <Button
                variant="ghost"
                className="w-full justify-start px-3 py-2 text-sm"
                onClick={() => duplicateNode(node)}
              >
                <Copy className="h-4 w-4 mr-2" />
                Duplicate
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start px-3 py-2 text-sm text-red-600 hover:text-red-700"
                onClick={() => deleteNode(node.id)}
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
              className="w-4 h-4 bg-blue-500 rounded-full cursor-grab hover:bg-blue-600 transition-colors"
              draggable
              onDragStart={handleConnectionDragStart}
            />
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Inputs:</label>
          <div className="space-y-2">
            {Object.entries(node.inputs).map(([name, input]) => (
              <div key={name} className="flex items-center gap-2">
                <div
                  className="w-4 h-4 bg-gray-200 rounded-full hover:bg-gray-300 transition-colors"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleInputDrop(e, name)}
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
            Use Mod 2
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
  const [showMenu, setShowMenu] = useState(null);
  const containerRef = useRef(null);
  const lastMousePos = useRef({ x: 0, y: 0 });

  const createNode = useCallback(() => {
    const newNode = {
      id: nextNodeId,
      position: { x: 100, y: 100 },
      inputs: {},
      formula: '',
      useMod2: true,
      q: 0
    };
    setNodes(prevNodes => [...prevNodes, newNode]);
    setNextNodeId(prevId => prevId + 1);
  }, [nextNodeId]);

  useEffect(() => {
    const handleGlobalClick = (e) => {
      if (showMenu !== null) {
        const menuNode = nodes.find(n => n.id === showMenu);
        if (menuNode && !e.target.closest(`[data-node-id="${menuNode.id}"]`)) {
          setShowMenu(null);
        }
      }
    };

    document.addEventListener('mousedown', handleGlobalClick);
    return () => document.removeEventListener('mousedown', handleGlobalClick);
  }, [showMenu, nodes]);

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

  const handleMouseDown = (e) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsPanning(true);
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseMove = (e) => {
    if (isPanning) {
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;
      setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

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
      nextNodeId
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
        } catch (error) {
          console.error('Error loading setup:', error);
        }
      };
      reader.readAsText(file);
    }
  };

  // Handle keyboard events for deletion
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.key === 'Delete' /*|| e.key === 'Backspace'*/) && selectedNodes.size > 0) {
        // Delete all selected nodes
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
  }, [selectedNodes]);

  // Handle background click to clear selection
  const handleBackgroundClick = (e) => {
    if (e.target === containerRef.current) {
      setSelectedNodes(new Set());
    }
  };

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

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-screen bg-gray-50 overflow-hidden"
      onMouseDown={(e) => {
        handleBackgroundClick(e);
        handleMouseDown(e);
      }}
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
        <input
          id="load-setup"
          type="file"
          accept=".json"
          className="hidden"
          onChange={loadSetup}
        />
      </div>

      <div style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}>
        <svg className="absolute inset-0 pointer-events-none z-0">
          {connections.map((conn, idx) => {
            const sourceNode = nodes.find(n => n.id === conn.sourceId);
            const targetNode = nodes.find(n => n.id === conn.targetId);
            if (sourceNode && targetNode) {
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
            }
            return null;
          })}
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
                const dx = pos.x - node.position.x;
                const dy = pos.y - node.position.y;
                setNodes(prevNodes => prevNodes.map(n => 
                  selectedNodes.has(n.id) 
                    ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } }
                    : n
                ));
              } else {
                updateNode(id, { ...node, position: pos });
              }
            }}
            allNodes={nodes}
            updateNodeQ={updateNodeQ}
            isSelected={selectedNodes.has(node.id)}
            onSelect={handleNodeSelect}
            showMenu={showMenu === node.id}
            setShowMenu={(show) => setShowMenu(show ? node.id : null)}
          />
        ))}
      </div>
    </div>
  );
};

export default ComputationalFramework;