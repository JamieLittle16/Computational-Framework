'use client';

import type { Connection, GraphNode, Offset } from '@/types';

interface MinimapProps {
    nodes: GraphNode[];
    connections: Connection[];
    offset: Offset;
    scale: number;
    viewportWidth: number;
    viewportHeight: number;
}

const MINIMAP_W = 200;
const MINIMAP_H = 130;
const PADDING = 48;
const NODE_W = 320;
const NODE_H = 200;
const HEADER_H = 56;
const BODY_PAD = 16;
const ROW_H = 22;

function estimateNodeHeight(node: GraphNode) {
    const inputCount = Object.keys(node.inputs ?? {}).length;
    const bodyRows = node.type === 'logger' ? 8 : 3 + inputCount;
    return Math.max(NODE_H, HEADER_H + BODY_PAD * 2 + bodyRows * ROW_H);
}

function worldBounds(nodes: GraphNode[]) {
    if (nodes.length === 0) return { minX: 0, minY: 0, maxX: 1200, maxY: 700 };
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const node of nodes) {
        const height = estimateNodeHeight(node);
        minX = Math.min(minX, node.position.x);
        minY = Math.min(minY, node.position.y);
        maxX = Math.max(maxX, node.position.x + NODE_W);
        maxY = Math.max(maxY, node.position.y + height);
    }

    return {
        minX: minX - PADDING,
        minY: minY - PADDING,
        maxX: maxX + PADDING,
        maxY: maxY + PADDING,
    };
}

export function Minimap({
    nodes,
    connections,
    offset,
    scale,
    viewportWidth,
    viewportHeight,
}: MinimapProps) {
    const bounds = worldBounds(nodes);
    const worldW = Math.max(1, bounds.maxX - bounds.minX);
    const worldH = Math.max(1, bounds.maxY - bounds.minY);

    const vpX = -offset.x / scale;
    const vpY = -offset.y / scale;
    const vpW = viewportWidth / scale;
    const vpH = viewportHeight / scale;

    const scaleX = MINIMAP_W / worldW;
    const scaleY = MINIMAP_H / worldH;
    const miniScale = Math.min(scaleX, scaleY);
    const drawW = worldW * miniScale;
    const drawH = worldH * miniScale;
    const dx = (MINIMAP_W - drawW) / 2;
    const dy = (MINIMAP_H - drawH) / 2;

    const mapX = (x: number) => (x - bounds.minX) * miniScale + dx;
    const mapY = (y: number) => (y - bounds.minY) * miniScale + dy;
    const mapLen = (v: number) => Math.max(1, v * miniScale);

    return (
        <div
            className="absolute bottom-4 right-4 z-20 overflow-hidden select-none rounded-lg border border-gray-200 bg-white/90 shadow-lg backdrop-blur-sm dark:border-gray-700 dark:bg-gray-900/90"
            style={{ width: MINIMAP_W, height: MINIMAP_H }}
        >
            <div className="pointer-events-none absolute left-2 top-1 z-10 text-[9px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
                Overview
            </div>

            <svg width={MINIMAP_W} height={MINIMAP_H} className="block">
                <rect x={0} y={0} width={MINIMAP_W} height={MINIMAP_H} fill="transparent" />

                <rect
                    x={dx}
                    y={dy}
                    width={drawW}
                    height={drawH}
                    rx={10}
                    fill="#f8fafc"
                    className="dark:fill-gray-900"
                />

                {connections.map((conn, idx) => {
                    const src = nodes.find((n) => n.id === conn.sourceId);
                    const tgt = nodes.find((n) => n.id === conn.targetId);
                    if (!src || !tgt) return null;
                    const srcH = estimateNodeHeight(src);
                    const tgtH = estimateNodeHeight(tgt);
                    const sx = mapX(src.position.x + NODE_W);
                    const sy = mapY(src.position.y + srcH / 2);
                    const tx = mapX(tgt.position.x);
                    const ty = mapY(tgt.position.y + tgtH / 2);
                    const bend = Math.max(18, Math.abs(tx - sx) * 0.35);

                    return (
                        <path
                            key={`${conn.sourceId}-${conn.targetId}-${conn.inputName}-${idx}`}
                            d={`M ${sx} ${sy} C ${sx + bend} ${sy}, ${tx - bend} ${ty}, ${tx} ${ty}`}
                            fill="none"
                            stroke="#94a3b8"
                            strokeWidth={Math.max(1, miniScale * 3)}
                            opacity="0.6"
                        />
                    );
                })}

                {nodes.map((node) => {
                    const isLogger = node.type === 'logger';
                    const height = estimateNodeHeight(node);
                    const x = mapX(node.position.x);
                    const y = mapY(node.position.y);
                    const w = mapLen(NODE_W);
                    const h = mapLen(height);
                    const headerH = mapLen(HEADER_H);
                    const innerPad = mapLen(BODY_PAD);
                    const rowH = mapLen(ROW_H);
                    const textY = y + headerH / 2;

                    return (
                        <g key={node.id}>
                            <rect
                                x={x}
                                y={y}
                                width={w}
                                height={h}
                                rx={10}
                                fill={isLogger ? '#dcfce7' : '#dbeafe'}
                                stroke={isLogger ? '#22c55e' : '#3b82f6'}
                                strokeWidth={Math.max(1, miniScale * 2)}
                                opacity="0.92"
                            />
                            <rect
                                x={x}
                                y={y}
                                width={w}
                                height={headerH}
                                rx={10}
                                fill={isLogger ? '#bbf7d0' : '#bfdbfe'}
                                opacity="0.75"
                            />
                            <text
                                x={x + 10}
                                y={textY}
                                dominantBaseline="middle"
                                fontSize={Math.max(8, miniScale * 12)}
                                fill={isLogger ? '#166534' : '#1d4ed8'}
                                fontWeight="600"
                                style={{ fontFamily: 'sans-serif' }}
                            >
                                {node.name.length > 14 ? `${node.name.slice(0, 13)}…` : node.name}
                            </text>

                            {!isLogger && (
                                <g opacity="0.85">
                                    {Object.keys(node.inputs ?? {}).map((name, index) => {
                                        const rowY = y + headerH + innerPad + index * rowH + rowH / 2;
                                        return (
                                            <g key={name}>
                                                <circle
                                                    cx={x + 10}
                                                    cy={rowY}
                                                    r={Math.max(1.5, miniScale * 2.5)}
                                                    fill="#93c5fd"
                                                />
                                                <rect
                                                    x={x + 18}
                                                    y={rowY - 3}
                                                    width={w - 28}
                                                    height={Math.max(2, miniScale * 5)}
                                                    rx={2}
                                                    fill="#e2e8f0"
                                                />
                                            </g>
                                        );
                                    })}
                                </g>
                            )}
                        </g>
                    );
                })}

                <rect
                    x={mapX(vpX)}
                    y={mapY(vpY)}
                    width={mapLen(vpW)}
                    height={mapLen(vpH)}
                    fill="rgba(249,115,22,0.08)"
                    stroke="#f97316"
                    strokeWidth={Math.max(1.5, miniScale * 3)}
                    rx={8}
                />
            </svg>
        </div>
    );
}
