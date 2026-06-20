'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet';
import { Calculator, Hash, Layers } from 'lucide-react';
import { getAllDescriptors } from '@/lib/nodeRegistry';
import type { NodeType } from '@/types';

const TYPE_ICONS: Record<NodeType, React.ReactNode> = {
    computational: <Calculator className="h-5 w-5 text-blue-500" />,
    logger: <Hash className="h-5 w-5 text-green-500" />,
};

const TYPE_ACCENT: Record<NodeType, string> = {
    computational: 'border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950',
    logger: 'border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-950',
};

interface NodePaletteProps {
    onCreateNode: (type: NodeType) => void;
}

export function NodePalette({ onCreateNode }: NodePaletteProps) {
    const [open, setOpen] = useState(false);
    const descriptors = getAllDescriptors();

    function handleCreate(type: NodeType) {
        onCreateNode(type);
        setOpen(false);
    }

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button className="flex items-center gap-2" title="Node palette">
                    <Layers className="h-4 w-4" /> Node Types
                </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 flex flex-col">
                <SheetHeader className="pb-2 border-b">
                    <SheetTitle>Node Palette</SheetTitle>
                    <p className="text-xs text-muted-foreground">
                        Click a type to place it on the canvas
                    </p>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto py-4 space-y-3">
                    {(Object.entries(descriptors) as [NodeType, (typeof descriptors)[NodeType]][]).map(
                        ([type, desc]) => (
                            <button
                                key={type}
                                onClick={() => handleCreate(type)}
                                className={`w-full text-left rounded-lg border p-4 transition-colors cursor-pointer ${TYPE_ACCENT[type]}`}
                            >
                                <div className="flex items-start gap-3">
                                    <div className="mt-0.5 shrink-0">{TYPE_ICONS[type]}</div>
                                    <div className="min-w-0">
                                        <div className="text-sm font-semibold leading-tight">
                                            {desc.label}
                                        </div>
                                        <div className="mt-1 text-xs text-muted-foreground leading-snug">
                                            {desc.description}
                                        </div>
                                        <div className="mt-2 flex flex-wrap gap-1">
                                            {Object.keys(desc.defaultInputs).map((k) => (
                                                <span
                                                    key={k}
                                                    className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
                                                >
                                                    {k}
                                                </span>
                                            ))}
                                            {Object.keys(desc.defaultInputs).length === 0 && (
                                                <span className="text-[10px] text-muted-foreground italic">
                                                    no default inputs
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </button>
                        ),
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
