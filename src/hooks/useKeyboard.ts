import { useEffect } from 'react';

interface UseKeyboardOptions {
    onCopy: () => void;
    onPaste: () => void;
    onDelete: () => void;
    onUndo?: () => void;
    onRedo?: () => void;
}

export function useKeyboard({ onCopy, onPaste, onDelete, onUndo, onRedo }: UseKeyboardOptions) {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'c') {
                    onCopy();
                } else if (e.key === 'v') {
                    onPaste();
                } else if (e.key === 'z') {
                    e.preventDefault();
                    if (e.shiftKey) {
                        onRedo?.();
                    } else {
                        onUndo?.();
                    }
                } else if (e.key === 'y') {
                    e.preventDefault();
                    onRedo?.();
                }
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
                onDelete();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onCopy, onPaste, onDelete, onUndo, onRedo]);
}
