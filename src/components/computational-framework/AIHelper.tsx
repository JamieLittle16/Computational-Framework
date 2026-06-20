import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import ComputationalNode from './ComputationalNode';
import basePrompt from './basePrompt';
import type {
    GraphNode,
    Connection,
    Settings,
    AIProvider,
    ModelConfig,
    AIParsedResponse,
    BaseNodeProps,
} from '@/types';

const generateUniqueId = () => '_' + Math.random().toString(36).substr(2, 9);

// ---------------------------------------------------------------------------
// Provider / model catalogue
// ---------------------------------------------------------------------------
const MODEL_CONFIGS: Record<AIProvider, { name: string; models: string[] }> = {
    OPENAI: {
        name: 'OpenAI',
        models: [
            'gpt-5.5',
            'gpt-5.4',
            'gpt-5.4-mini',
        ],
    },
    GEMINI: {
        name: 'Google Gemini',
        models: [
            'gemini-2.5-pro',
            'gemini-2.5-flash',
            'gemini-2.0-flash',
            'gemini-2.0-flash-lite',
        ],
    },
    DEEPSEEK: {
        name: 'DeepSeek',
        models: [
            'deepseek-v4-pro',
            'deepseek-v4-flash',
        ],
    },
};

const DEFAULT_PROVIDER: AIProvider = 'OPENAI';

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------
interface SavedProviderData {
    model: string;
    apiKey: string;
}
type SavedConfigs = Partial<Record<AIProvider, SavedProviderData>> & { lastProvider?: AIProvider };

function loadSavedConfigs(): SavedConfigs {
    try {
        const raw = localStorage.getItem('aiModelConfigs');
        return raw ? (JSON.parse(raw) as SavedConfigs) : {};
    } catch {
        return {};
    }
}

function initModelConfig(): ModelConfig {
    const saved = loadSavedConfigs();
    const provider: AIProvider =
        saved.lastProvider && MODEL_CONFIGS[saved.lastProvider]
            ? saved.lastProvider
            : DEFAULT_PROVIDER;
    const providerData = saved[provider];
    const savedModel = providerData?.model;
    return {
        provider,
        model:
            savedModel && MODEL_CONFIGS[provider].models.includes(savedModel)
                ? savedModel
                : MODEL_CONFIGS[provider].models[0],
        apiKey: providerData?.apiKey ?? '',
    };
}

// ---------------------------------------------------------------------------
// Server proxy call
// ---------------------------------------------------------------------------
async function callAIProxy(params: {
    provider: AIProvider;
    model: string;
    apiKey: string | undefined;
    fullPrompt: string;
}): Promise<string> {
    const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            provider: params.provider,
            model: params.model,
            apiKey: params.apiKey || undefined,
            prompt: params.fullPrompt,
        }),
    });
    const data = await res.json();
    if (!res.ok)
        throw new Error((data as { error: string }).error || `Request failed (${res.status})`);
    return (data as { text: string }).text;
}

// ---------------------------------------------------------------------------
// Parse + validate the JSON block from the AI response
// ---------------------------------------------------------------------------
function extractParsedResponse(aiText: string): AIParsedResponse {
    const jsonMatch = aiText.match(/```json\s*([\s\S]*?)\s*```/);
    if (!jsonMatch) {
        throw new Error(
            'Could not find a JSON block in the AI response. Preview: ' +
                aiText.substring(0, 200) +
                '...',
        );
    }
    const jsonString = jsonMatch[1].trim();
    let parsed: AIParsedResponse;
    try {
        parsed = JSON.parse(
            jsonString.replace(/\\n/g, '\n').replace(/\\"/g, '"'),
        ) as AIParsedResponse;
    } catch (e) {
        throw new Error(`Failed to parse extracted JSON: ${(e as Error).message}`);
    }
    if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.connections)) {
        throw new Error("Response must contain 'nodes' and 'connections' arrays.");
    }
    parsed.nodes.forEach((node, i) => {
        if (!node.id) throw new Error(`Node at index ${i} is missing 'id'`);
        if (!node.type) throw new Error(`Node at index ${i} is missing 'type'`);
    });
    return parsed;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface AIHelperProps {
    allNodes: GraphNode[];
    connections: Connection[];
    settings: Settings;
    createNode: (nodeData: GraphNode) => void;
    createConnection: (sourceId: string, targetId: string, inputName: string) => void;
    updateNode: (id: string, updatedNodeOrFn: GraphNode | ((prev: GraphNode) => GraphNode)) => void;
    onClose: () => void;
}

// Preview nodes need a no-op for most callbacks since they're read-only
const noOp = () => {};
const PREVIEW_SETTINGS: Settings = {
    initialQ: 0,
    modBase: 2,
    maxEvalDepth: 100,
    delay: 100,
    selectionTintStrength: 0.15,
    colorMode: false,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const AIHelper: React.FC<AIHelperProps> = ({
    allNodes,
    connections,
    settings,
    createNode,
    createConnection,
    updateNode,
    onClose,
}) => {
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [response, setResponse] = useState('');
    const [modelConfig, setModelConfig] = useState<ModelConfig>(initModelConfig);
    const [previewNodes, setPreviewNodes] = useState<GraphNode[] | null>(null);
    const [showJson, setShowJson] = useState(false);

    // Persist to localStorage on change
    useEffect(() => {
        try {
            const saved = loadSavedConfigs();
            localStorage.setItem(
                'aiModelConfigs',
                JSON.stringify({
                    ...saved,
                    lastProvider: modelConfig.provider,
                    [modelConfig.provider]: {
                        model: modelConfig.model,
                        apiKey: modelConfig.apiKey,
                    },
                }),
            );
        } catch {
            // localStorage unavailable — non-fatal
        }
    }, [modelConfig]);

    const handleProviderChange = useCallback((provider: string) => {
        const p = provider as AIProvider;
        const saved = loadSavedConfigs();
        const providerData = saved[p];
        const savedModel = providerData?.model;
        setModelConfig({
            provider: p,
            model:
                savedModel && MODEL_CONFIGS[p].models.includes(savedModel)
                    ? savedModel
                    : MODEL_CONFIGS[p].models[0],
            apiKey: providerData?.apiKey ?? '',
        });
    }, []);

    const handleSubmit = useCallback(async () => {
        if (!prompt.trim()) {
            toast.error('Please enter a prompt');
            return;
        }

        setIsLoading(true);
        const toastId = toast.loading('Generating node setup...');
        try {
            const context = { nodes: allNodes, connections, settings };
            const fullPrompt = [
                basePrompt,
                '',
                'Current setup:',
                '```json',
                JSON.stringify(context, null, 2),
                '```',
                '',
                `User Request: ${prompt}`,
            ].join('\n');

            const aiText = await callAIProxy({
                provider: modelConfig.provider,
                model: modelConfig.model,
                apiKey: modelConfig.apiKey || undefined,
                fullPrompt,
            });

            const parsed = extractParsedResponse(aiText);
            setResponse(JSON.stringify(parsed, null, 2));

            const uniqueNodes: GraphNode[] = parsed.nodes.map((n, index) => {
                const inputs: Record<string, { value: number; isConnected: boolean }> =
                    n.type === 'operation'
                        ? {
                              a: { value: 0, isConnected: false },
                              b: { value: 0, isConnected: false },
                          }
                        : { value: { value: 0, isConnected: false } };
                return {
                    id: `${n.id}_preview_${index}`,
                    name: n.id,
                    type: 'computational' as const,
                    useMod2: true,
                    formula: n.formula ?? '',
                    inputs,
                    position: { x: 100 + (index % 3) * 350, y: 100 + Math.floor(index / 3) * 250 },
                    q: 0,
                    error: '',
                };
            });
            setPreviewNodes(uniqueNodes);
            toast.success('Node setup generated!', { id: toastId });
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            toast.error(msg, { id: toastId });
            setResponse('Error: ' + msg);
            setPreviewNodes(null);
        } finally {
            setIsLoading(false);
        }
    }, [prompt, allNodes, connections, settings, modelConfig]);

    const handleApplyPreview = useCallback(async () => {
        if (!previewNodes) return;
        let parsedResponse: AIParsedResponse;
        try {
            parsedResponse = JSON.parse(response) as AIParsedResponse;
        } catch {
            toast.error('Failed to parse AI response to apply connections.');
            return;
        }

        const toastId = toast.loading('Applying node setup...');
        try {
            const idMapping = new Map<string, string>();
            const createdNodes: GraphNode[] = [];

            for (const previewNode of previewNodes) {
                const newId = generateUniqueId();
                idMapping.set(previewNode.id, newId);
                // Use the inputs already assigned during preview generation
                const nodeInputs: Record<string, { value: number; isConnected: boolean }> =
                    previewNode.inputs as Record<string, { value: number; isConnected: boolean }>;
                const enrichedNode: GraphNode = {
                    ...previewNode,
                    id: newId,
                    name: previewNode.name || `Node ${newId}`,
                    position: previewNode.position ?? {
                        x: 100 + (createdNodes.length % 3) * 350,
                        y: 100 + Math.floor(createdNodes.length / 3) * 250,
                    },
                    inputs: nodeInputs,
                    formula: previewNode.formula ?? '',
                    useMod2: true,
                    q: 0,
                    error: '',
                };
                createNode(enrichedNode);
                createdNodes.push(enrichedNode);
            }

            for (const conn of parsedResponse.connections ?? []) {
                const newSourceId = idMapping.get(conn.sourceId);
                const newTargetId = idMapping.get(conn.targetId);
                if (!newSourceId || !newTargetId) continue;
                const targetNode = createdNodes.find((n) => n.id === newTargetId);
                if (targetNode?.inputs && conn.inputName in targetNode.inputs) {
                    createConnection(newSourceId, newTargetId, conn.inputName);
                    updateNode(newTargetId, {
                        ...targetNode,
                        inputs: {
                            ...targetNode.inputs,
                            [conn.inputName]: {
                                ...targetNode.inputs[conn.inputName],
                                isConnected: true,
                            },
                        },
                    });
                }
            }

            toast.success(`Created ${createdNodes.length} nodes`, { id: toastId });
            setPreviewNodes(null);
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            toast.error(`Failed to apply: ${msg}`, { id: toastId });
        }
    }, [previewNodes, response, createNode, createConnection, updateNode]);

    const currentProvider = modelConfig.provider;
    const availableModels = MODEL_CONFIGS[currentProvider]?.models ?? [];

    // Minimal stub props for read-only ComputationalNode previews
    const previewNodeProps: Omit<BaseNodeProps, 'node' | 'isSelected' | 'position'> = {
        updateNode: noOp as BaseNodeProps['updateNode'],
        deleteNode: noOp,
        duplicateNode: noOp,
        connections: [],
        createConnection: noOp,
        onPositionChange: noOp,
        allNodes: previewNodes ?? [],
        updateNodeQ: noOp,
        onSelect: noOp,
        handleInputChange: noOp,
        settings: PREVIEW_SETTINGS,
        onDragStart: noOp,
        transformNode: noOp,
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-card text-card-foreground rounded-lg shadow-xl p-6 w-[600px] max-h-[80vh] overflow-y-auto border border-border">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold">AI Node Generator</h2>
                    <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 p-0">
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                <div className="space-y-4">
                    {/* Provider + model */}
                    <div className="flex gap-4">
                        <Select value={currentProvider} onValueChange={handleProviderChange}>
                            <SelectTrigger className="w-[200px]">
                                <SelectValue placeholder="Select Provider" />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.entries(MODEL_CONFIGS).map(([key, cfg]) => (
                                    <SelectItem key={key} value={key}>
                                        {cfg.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select
                            value={modelConfig.model}
                            onValueChange={(model) =>
                                setModelConfig((prev) => ({ ...prev, model }))
                            }
                        >
                            <SelectTrigger className="w-[200px]">
                                <SelectValue placeholder="Select Model" />
                            </SelectTrigger>
                            <SelectContent>
                                {availableModels.map((m) => (
                                    <SelectItem key={m} value={m}>
                                        {m}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* API key */}
                    <div className="space-y-1">
                        <Input
                            type="password"
                            placeholder={`${MODEL_CONFIGS[currentProvider].name} API Key (optional — leave blank to use server default)`}
                            value={modelConfig.apiKey}
                            onChange={(e) =>
                                setModelConfig((prev) => ({ ...prev, apiKey: e.target.value }))
                            }
                            className="w-full"
                        />
                        <p className="text-xs text-gray-500">
                            Your key is sent only to this app&apos;s server — never directly to the
                            AI provider.
                        </p>
                    </div>

                    {/* Prompt */}
                    <div>
                        <label className="block text-sm font-medium mb-1">Prompt</label>
                        <Textarea
                            placeholder="Describe the node setup you want to create..."
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            className="h-32"
                        />
                    </div>

                    {/* Reference */}
                    <div className="bg-muted rounded-md p-4">
                        <h3 className="font-medium mb-2">Logic Gate Reference</h3>
                        <ul className="space-y-2 text-sm">
                            <li>
                                <span className="font-mono bg-background px-1 rounded">*</span> is AND
                                (mod 2): Returns 1 only when both inputs are 1
                            </li>
                            <li>
                                <span className="font-mono bg-background px-1 rounded">+</span> is XOR
                                (mod 2): Returns 1 when inputs differ
                            </li>
                        </ul>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button onClick={handleSubmit} disabled={isLoading}>
                            {isLoading ? 'Generating...' : 'Generate Nodes'}
                        </Button>
                    </div>

                    {/* Toggle */}
                    {(response || previewNodes) && (
                        <div className="mt-4">
                            <Button variant="secondary" onClick={() => setShowJson((v) => !v)}>
                                {showJson ? 'Show Preview' : 'Show JSON'}
                            </Button>
                        </div>
                    )}

                    {showJson
                        ? response && (
                                <div className="mt-4">
                                  <h3 className="font-medium mb-2">AI Response:</h3>
                                  <pre className="bg-muted p-4 rounded-md text-sm overflow-x-auto">
                                      {response}
                                  </pre>
                              </div>
                          )
                        : previewNodes && (
                              <div className="mt-4">
                                  <h3 className="font-medium mb-2">Preview:</h3>
                                  <div className="bg-muted p-4 rounded-md">
                                      <div className="relative w-full min-h-[300px] border border-dashed border-border rounded flex flex-wrap items-start">
                                          {previewNodes.map((node) => (
                                              <div
                                                  key={node.id}
                                                  className="m-2"
                                                  style={{
                                                      width: '320px',
                                                      height: '200px',
                                                      transform: 'scale(0.7)',
                                                      transformOrigin: 'top left',
                                                  }}
                                              >
                                                  <ComputationalNode
                                                      {...previewNodeProps}
                                                      node={node}
                                                      isSelected={false}
                                                      position={node.position}
                                                  />
                                              </div>
                                          ))}
                                      </div>
                                      <div className="mt-2 flex justify-end">
                                          <Button
                                              onClick={handleApplyPreview}
                                              className="bg-green-500 hover:bg-green-600 text-white"
                                          >
                                              Apply Setup
                                          </Button>
                                      </div>
                                  </div>
                              </div>
                          )}
                </div>
            </div>
        </div>
    );
};

export default AIHelper;
