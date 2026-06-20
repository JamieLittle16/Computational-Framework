import React, { useCallback } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import BaseNode from './BaseNode';
import type { BaseNodeProps } from '@/types';

const ComputationalNode = React.memo<BaseNodeProps>(({ node, updateNode, ...baseProps }) => {
    const formulaError = node.error;

    const handleConnectionStart = useCallback(
        (e: React.DragEvent<HTMLDivElement>) => {
            e.stopPropagation();
            e.dataTransfer.setData('sourceNodeId', node.id);
        },
        [node.id],
    );

    return (
        <BaseNode node={node} updateNode={updateNode} {...baseProps}>
            {/* Q value + output port */}
            <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-foreground">
                    Q Value: {isNaN(node.q) ? '0' : node.q.toFixed(2)}
                </label>
                <div
                    className="w-4 h-4 rounded-full cursor-pointer bg-blue-500 hover:bg-blue-600 transition-all duration-200 hover:scale-110 hover:shadow-md"
                    draggable
                    onMouseDown={(e) => e.stopPropagation()}
                    onDragStart={handleConnectionStart}
                />
            </div>

            {/* Formula */}
            <div>
                <label className="block text-sm font-medium text-foreground mb-1">Formula:</label>
                <Input
                    value={node.formula}
                    onChange={(e) => updateNode(node.id, { ...node, formula: e.target.value })}
                    className={`h-8 ${formulaError ? 'border-red-500' : ''}`}
                    placeholder="e.g., a + b + q"
                    onMouseDown={(e) => e.stopPropagation()}
                />
                {formulaError && <p className="mt-1 text-sm text-red-500">{formulaError}</p>}
            </div>

            {/* Mod toggle */}
            <div className="flex items-center space-x-2">
                <Checkbox
                    id={`mod2-${node.id}`}
                    checked={node.useMod2}
                    onCheckedChange={(checked) =>
                        updateNode(node.id, { ...node, useMod2: checked as boolean })
                    }
                />
                <label
                    htmlFor={`mod2-${node.id}`}
                    className="text-sm font-medium leading-none text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                    Use Mod {baseProps.settings.modBase}
                </label>
            </div>
        </BaseNode>
    );
});

ComputationalNode.displayName = 'ComputationalNode';

export default ComputationalNode;
