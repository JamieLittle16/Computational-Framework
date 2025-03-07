import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Edit2, MoreVertical, Copy, Trash, X } from 'lucide-react';
import styles from "./ComputationalFramework.module.css";
import { isEqual } from 'lodash';
import * as math from 'mathjs';
import hsvToRgb from '@/utils/colourUtils'

const ComputationalNode = React.memo(({
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
    onDragStart,
    handleInputChange,
}) => {

    const isNodeSelected = useMemo(() => isSelected, [isSelected]);
    const [isEditingName, setIsEditingName] = useState(false);
    const [nodeName, setNodeName] = useState(node.name || `Node ${node.id}`);
    const [newInputName, setNewInputName] = useState('');
    const [showMenu, setShowMenu] = useState(false);
    const formulaError = node.error;
    const nodeRef = useRef(null);
    const menuRef = useRef(null);

  // Get connected input value
    const getConnectedInputValue = useCallback((inputName) => {
    try {
        const connection = connections.find(c => c.targetId === node.id && c.inputName === inputName);
        if (connection) {
            const sourceNode = allNodes.find(n => n.id === connection.sourceId);
            return sourceNode ? sourceNode.q : 0;
        }
        return 0;
    } catch (error) {
        console.error("Error getting connected input value:", error);
        return 0;
    }
  }, [connections, node.id, allNodes]);


  // Connection handling
  const handleConnectionStart = (e) => {
    e.stopPropagation();
    e.dataTransfer.setData('sourceNodeId', node.id);
  };

  const handleInputDrop = (e, inputName) => {
    e.preventDefault();
    try {
      const sourceNodeId = e.dataTransfer.getData('sourceNodeId');
      if (sourceNodeId && sourceNodeId !== node.id) {
        createConnection(sourceNodeId, node.id, inputName);
      }
    } catch (error) {
      console.error("Error during input drop:", error);
    }
  };

    const handleInputFocus = useCallback((e) => {
    e.stopPropagation();
    }, []);

    const handleNameEdit = useCallback((e) => {
    e.stopPropagation();
    setIsEditingName(true);
    }, []);

    const handleMenuToggle = useCallback((e) => {
    e.stopPropagation();
    setShowMenu(prev => !prev);
    }, []);


    useEffect(() => {
    const handleClickOutside = (event) => {
    if (menuRef.current && !menuRef.current.contains(event.target)) {
    setShowMenu(false);
    }
    };

      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [setShowMenu]);


    const handleNodeDragStart = useCallback((e) => {
    onDragStart(node.id, e);
    }, [node.id, onDragStart]);

    const addInput = useCallback(() => {
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
    }, [node, newInputName, updateNode]);

  const backgroundColor = useMemo(() => {
    if (!settings.colorMode) return 'white';
    try {
      const hue = Math.max(0, Math.min(360, (node.q / settings.modBase) * 360));
      const saturation = 0.2;
      const value = 1;
      const rgb = hsvToRgb(hue, saturation, value);
      return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
    } catch (error) {
      console.error("Error setting background color:", error);
      return 'white';
    }
  }, [node.q, settings.modBase, settings.colorMode]);


  return (
    <Card
      ref={nodeRef}
      className={`absolute w-80 shadow-lg z-10 ${isNodeSelected ? styles.selectedNode : ''}`}
      style={{
        left: position?.x,
        top: position?.y,
        cursor: 'grab',
        backgroundColor: backgroundColor,
        WebkitUserSelect: 'none',
        MozUserSelect: 'none',
        msUserSelect: 'none',
        userSelect: 'none',
        transition: 'background-color 0.2s ease-in-out, transform 0.1s ease-in-out, border 0.2s ease-in-out',
        transform: 'scale(1)'
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
              style={{ width: '16px', height: '16px' }}
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
                  style={{ width: '16px', height: '16px' }}
                />
                <Input
                  type="number"
                  value={input.isConnected ? getConnectedInputValue(name) : (input.value === 0 ? '' : input.value)}
                  onChange={(e) => {
                    const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                    handleInputChange(node.id, name, isNaN(value) ? 0 : value)
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

        <div className="flex items-center space-x-2">
          <Checkbox
            id={`mod2-${node.id}`}
            checked={node.useMod2}
            onCheckedChange={(checked) => updateNode(node.id, { ...node, useMod2: checked })}
          />
          <label
            htmlFor={`mod2-${node.id}`}
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Use Mod {settings.modBase}
          </label>
        </div>
      </CardContent>
      {isNodeSelected && <div className={styles.overlay} style={{ "--tint-strength": settings.selectionTintStrength }}/>}
    </Card>
  );
}, (prevProps, nextProps) => {
    return isEqual(prevProps, nextProps);
});

export default ComputationalNode;
