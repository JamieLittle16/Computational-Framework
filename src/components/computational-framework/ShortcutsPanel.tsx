'use client';

import { Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet';

const shortcuts = [
    ['Ctrl+C', 'Copy selected nodes'],
    ['Ctrl+V', 'Paste copied nodes'],
    ['Delete / Backspace', 'Delete selected nodes/connections'],
    ['Ctrl+Z', 'Undo'],
    ['Ctrl+Shift+Z / Ctrl+Y', 'Redo'],
    ['Ctrl+Scroll', 'Zoom in/out'],
    ['Middle-click / Alt+drag', 'Pan canvas'],
    ['Click node', 'Select node'],
    ['Shift+Click', 'Toggle selection'],
    ['Drag on canvas', 'Marquee select'],
    ['Drag output port', 'Create connection'],
    ['Drag input port to', 'Connect a wire'],
];

export function ShortcutsPanel() {
    return (
        <Sheet>
            <SheetTrigger asChild>
                <Button className="flex items-center gap-2" title="Keyboard shortcuts">
                    <Keyboard className="h-4 w-4" /> Shortcuts
                </Button>
            </SheetTrigger>
            <SheetContent>
                <SheetHeader>
                    <SheetTitle>Keyboard Shortcuts</SheetTitle>
                </SheetHeader>
                <div className="py-4">
                    <div className="space-y-1">
                        {shortcuts.map(([key, desc]) => (
                            <div key={key} className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800 last:border-b-0">
                                <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono">
                                    {key}
                                </kbd>
                                <span className="text-sm text-gray-600 dark:text-gray-400">{desc}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
