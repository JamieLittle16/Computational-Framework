import React, { useCallback, useMemo, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Copy } from 'lucide-react';
import BaseNode from './BaseNode';
import type { BaseNodeProps, LogEntry } from '@/types';

const LoggerNode: React.FC<BaseNodeProps> = ({ node, updateNode, ...props }) => {
    const logHistory = useMemo<LogEntry[]>(() => node.logHistory ?? [], [node.logHistory]);
    const previousClockInput = useRef<number>(
        typeof node.inputs['clock']?.value === 'number' ? node.inputs['clock'].value : 0,
    );
    const logDisplayRef = useRef<HTMLDivElement>(null);

    // Auto-scroll log display to bottom whenever entries are added
    useEffect(() => {
        if (logDisplayRef.current) {
            logDisplayRef.current.scrollTop = logDisplayRef.current.scrollHeight;
        }
    }, [logHistory.length]);

    // Trigger logging on rising edge of the clock input
    useEffect(() => {
        const clockInput = node.inputs['clock']?.value ?? 0;
        const isRisingEdge = clockInput === 1 && previousClockInput.current === 0;

        if (isRisingEdge) {
            const logEntry: LogEntry = {
                timestamp: new Date().toLocaleTimeString(),
                data: Object.entries(node.inputs)
                    .filter(([key]) => key !== 'clock')
                    .reduce<Record<string, number>>((acc, [key, input]) => {
                        acc[key] = input.value;
                        return acc;
                    }, {}),
            };
            updateNode(node.id, (prevNode) => ({
                ...prevNode,
                logHistory: [...(prevNode.logHistory ?? []), logEntry],
            }));
        }

        previousClockInput.current = clockInput;
    }, [node.inputs, node.id, updateNode]);

    const copyToClipboard = useCallback(() => {
        const logString = logHistory
            .map((log) => {
                const dataString = Object.entries(log.data)
                    .map(([key, value]) => `${key}: ${value}`)
                    .join(', ');
                return `[${log.timestamp}] ${dataString}`;
            })
            .join('\n');
        navigator.clipboard.writeText(logString).catch((err) => {
            console.error('Failed to copy log to clipboard:', err);
        });
    }, [logHistory]);

    const clearLog = useCallback(() => {
        updateNode(node.id, { ...node, logHistory: [] });
    }, [updateNode, node]);

    return (
        <BaseNode {...props} node={node} updateNode={updateNode}>
            {/* Clock indicator */}
            <div className="flex justify-between items-center">
                <label className="block text-sm font-medium text-foreground">Clock Input</label>
                <div
                    className="w-4 h-4 rounded-full transition-colors duration-150"
                    style={{
                        backgroundColor: node.inputs['clock']?.value === 1 ? '#22c55e' : '#9ca3af',
                    }}
                    title="Clock signal indicator"
                />
            </div>

            {/* Log display */}
            <div>
                <label className="block text-sm font-medium text-foreground mb-1">Log:</label>
                <div
                    className="max-h-40 overflow-auto border rounded-md p-2 text-sm"
                    ref={logDisplayRef}
                >
                    {logHistory.length === 0 ? (
                        <p className="text-center text-muted-foreground">No logs yet.</p>
                    ) : (
                        <>
                            {logHistory.map((log, index) => (
                                <div
                                    key={index}
                                    className="py-1 text-foreground border-b last:border-b-0"
                                >
                                    <span className="mr-2 text-muted-foreground">{log.timestamp}</span>
                                    {Object.entries(log.data).map(([key, value], idx) => (
                                        <span key={idx}>{`${key}: ${value}  `}</span>
                                    ))}
                                </div>
                            ))}
                            <div className="flex gap-2 mt-2">
                                <Button onClick={clearLog} size="sm">
                                    Clear Log
                                </Button>
                                <Button onClick={copyToClipboard} size="sm">
                                    <Copy className="h-4 w-4" />
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </BaseNode>
    );
};

LoggerNode.displayName = 'LoggerNode';

export default LoggerNode;
