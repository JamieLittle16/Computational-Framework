const generateUniqueId = () => {
  return '_' + Math.random().toString(36).substr(2, 9);
};

import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from 'sonner';
import { X } from 'lucide-react';
// import PreviewCard from './PreviewCard';
import ComputationalNode from './ComputationalNode';

const MODEL_CONFIGS = {
    OPENAI: {
        name: 'OpenAI',
        models: [
            'gpt-4',
            'gpt-4-turbo-preview',
            'gpt-3.5-turbo',
            'gpt-3.5-turbo-0125',
        ],
        baseUrl: 'https://api.openai.com/v1'
    },
    GEMINI: {
        name: 'Google Gemini',
        models: [
            'gemini-pro',
            'gemini-pro-lite',
            'gemini-2.0-flash',
            'gemini-2.0-flash-lite',
            'gemini-2.0-flash-thinking'
        ],
        baseUrl: 'https://generativelanguage.googleapis.com/v1'
    },
    DEEPSEEK: {
        name: 'DeepSeek',
        models: [
            'deepseek-chat',
            'deepseek-reasoner',
        ],
        baseUrl: 'https://api.deepseek.com/v1'
    }
};

const AIHelper = ({
    allNodes,
    connections,
    settings,
    createNode,
    createConnection,
    onClose
}) => {
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [response, setResponse] = useState('');
    const [selectedProvider, setSelectedProvider] = useState(Object.keys(MODEL_CONFIGS)[0]); // Track selected provider
    const [modelConfig, setModelConfig] = useState(() => {
        const savedConfigs = localStorage.getItem('aiModelConfigs');
        if (savedConfigs) {
            try {
                const parsedConfigs = JSON.parse(savedConfigs);
                // Validate and return specific config for the selected provider, or fallback to default
                const provider = parsedConfigs[selectedProvider] ? selectedProvider : Object.keys(MODEL_CONFIGS)[0];
                const model = parsedConfigs[provider]?.model || MODEL_CONFIGS[provider].models[0];
                const apiKey = parsedConfigs[provider]?.apiKey || '';
                return { provider, model, apiKey };
            } catch (e) {
                console.error('Failed to parse saved configs:', e);
            }
        }
        const defaultProvider = Object.keys(MODEL_CONFIGS)[0];
        return {
            provider: defaultProvider,
            model: MODEL_CONFIGS[defaultProvider].models[0],
            apiKey: ''
        };
    });
    const [previewNodes, setPreviewNodes] = useState(null);
    const [showJson, setShowJson] = useState(false);


    useEffect(() => {
        const savedConfigs = localStorage.getItem('aiModelConfigs');
        let parsedConfigs = {};
        if (savedConfigs) {
            try {
                parsedConfigs = JSON.parse(savedConfigs);
            } catch (e) {
                console.error('Failed to parse saved configs:', e);
            }
        }

        // Update localStorage with the individual API key for the selected provider
        const updatedConfigs = {
            ...parsedConfigs,
            [modelConfig.provider]: {
                model: modelConfig.model,
                apiKey: modelConfig.apiKey,
            },
        };
        localStorage.setItem('aiModelConfigs', JSON.stringify(updatedConfigs));

    }, [modelConfig]);

    const callAI = async (prompt, context) => {
        if (!modelConfig || !modelConfig.apiKey) {
            throw new Error("Please configure the AI model and API key");
         }
         console.log("Model Config:", {
             provider: modelConfig.provider,
             model: modelConfig.model,
             baseUrl: MODEL_CONFIGS[modelConfig.provider]?.baseUrl
         });

         const basePrompt = `
             You are an AI assistant that generates node setups for a computational framework.
             * '*' represents AND (mod 2)
             * '+' represents XOR (mod 2)
             * Each node has a q value

             Current setup:
             \`\`\`json
             ${JSON.stringify(context, null, 2)}
             \`\`\`

             Instructions:
             1. Create a node setup based on the user's request.
             2. Return ONLY valid JSON inside a code block (\`\`\`json ... \`\`\`). No extra text.
             3. The JSON should contain 'nodes' (array of nodes) and 'connections' (array of connections).
             4. Each node object must have:
                 * 'id': A unique identifier string.
                 * 'type': String, can only be "input", "output", or "operation".
                 * 'operation': Required string with '+' or '*' for "operation" types (only for operation nodes).
             5.  Each connection object must have:
                 *   'sourceId': The id of the connection source.
                 *   'targetId': The id of the connection target.
                 *    'inputName': The name of the input on the target node (e.g., "a", "b").
             6. Operation nodes need to take input from other nodes. Use unique names as inputs.
             7. The 'formula' for an 'operation' node should reference the input names (e.g., "a * b").
             8. Always create connections between the input nodes and the operation node, and from the operation node to the output node.

             User Request: ${prompt}
         `;

         const headers = {
             'Content-Type': 'application/json',
         };

         if (modelConfig.provider === 'GEMINI') {
             headers['x-goog-api-key'] = modelConfig.apiKey;  // Use API key header for Gemini
         } else {
             headers['Authorization'] = `Bearer ${modelConfig.apiKey}`; // Bearer token for others
         }

         let endpoint;
         let payload;

         switch (modelConfig.provider) {
             case 'OPENAI':
                 endpoint = `${MODEL_CONFIGS.OPENAI.baseUrl}/chat/completions`;
                 payload = {
                     model: modelConfig.model,
                     messages: [
                         { role: "system", content: "You are an AI assistant that generates node setups..." },
                         { role: "user", content: basePrompt }
                     ]
                 };
                 break;

             case 'GEMINI':
                 endpoint = `${MODEL_CONFIGS.GEMINI.baseUrl}/models/${modelConfig.model}:generateContent`;
                 payload = {
                     contents: [{
                         parts: [{ text: basePrompt }]
                     }]
                 };
                 break;

             case 'DEEPSEEK':
                 endpoint = `${MODEL_CONFIGS.DEEPSEEK.baseUrl}/chat/completions`;
                 payload = {
                     model: modelConfig.model,
                     messages: [
                         { role: "system", content: "You are an AI assistant that generates node setups..." },
                         { role: "user", content: basePrompt }
                     ]
                 };
                 break;

             default:
                 throw new Error("Unsupported AI provider");
         }

         try {
             console.log("Sending request to:", endpoint);
             console.log("Payload:", payload);

             const response = await fetch(endpoint, {
                 method: 'POST',
                 headers,
                 body: JSON.stringify(payload)
             });

             const responseText = await response.text();
             console.log("Raw response text:", responseText);

             if (!response.ok) {
                 console.error("API Error Response:", responseText);
                 throw new Error(`API call failed: ${response.statusText}. Details: ${responseText}`);
             }

             let data;
             try {
                 data = JSON.parse(responseText);
                 console.log("Parsed API Response Data:", data);
             } catch (parseError) {
                 console.error("Failed to parse API response as JSON:", responseText);
                 throw new Error(`Failed to parse API response: ${parseError.message}`);
             }

             let aiResponse;
             switch (modelConfig.provider) {
                 case 'OPENAI':
                 case 'DEEPSEEK':
                     aiResponse = data.choices[0].message.content;
                     break;
                 case 'GEMINI':
                     aiResponse = data.candidates[0].content.parts[0].text;
                     break;
                 default:
                     throw new Error("Unexpected response format");
             }

             console.log("AI Response before JSON extraction:", aiResponse);

             const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)\s*```/);
             if (!jsonMatch) {
                 console.error("Failed to find JSON in response. Full response:", aiResponse);
                 throw new Error("Could not find JSON in response. Full response: " + aiResponse.substring(0, 200) + "...");
             }

             const jsonString = jsonMatch[1].trim();
             console.log("Extracted JSON string:", jsonString);

             let parsedResponse;
             try {
                 parsedResponse = JSON.parse(jsonString.replace(/\\n/g, '\n').replace(/\\"/g, '"'));
                 console.log("Parsed JSON:", parsedResponse);

                 if (!Array.isArray(parsedResponse.nodes) || !Array.isArray(parsedResponse.connections)) {
                     throw new Error("Response must contain 'nodes' and 'connections' arrays.");
                 }
                 parsedResponse.nodes.forEach((node, index) => {
                     if (!node.id) throw new Error(`Node at index ${index} is missing 'id'`);
                     if (!node.type) throw new Error(`Node at index ${index} is missing 'type'`);
                 });

                 return parsedResponse;
             } catch (jsonParseError) {
                 console.error("Failed to parse extracted JSON:", jsonString);
                 throw new Error(`Failed to parse extracted JSON: ${jsonParseError.message}`);
             }
         } catch (error) {
             console.error("AI API call failed:", error);
             console.error("Full error details:", {
                 message: error.message,
                 stack: error.stack,
                 response: error.response
             });
             throw new Error(`AI API Error: ${error.message}. Check console for full response.`);
         }
     };

     const handleSubmit = useCallback(async () => {
         if (!modelConfig?.apiKey) {
             toast.error("Please configure the AI model and API key");
             return;
         }

         if (!prompt.trim()) {
             toast.error("Please enter a prompt");
             return;
         }

         setIsLoading(true);
         try {
             const context = {
                 nodes: allNodes,
                 connections: connections,
                 settings: settings,
             };

             toast.loading("Generating node setup...");
             const aiResponse = await callAI(prompt, context);

             setResponse(JSON.stringify(aiResponse, null, 2));

             if (aiResponse && aiResponse.nodes) {
                const parsedResponse = aiResponse; // No need to re-parse, it's already parsed in callAI

               // Ensure unique IDs before setting preview nodes
               const uniqueNodes = parsedResponse.nodes.map((node, index) => ({
                 ...node,
                 id: `${node.id}_preview_${index}`, // Append a unique suffix
                 name: node.id,
                 useMod2: true,
                 inputs: node.type === "operation"
                   ? { a: { value: 0, isConnected: false }, b: { value: 0, isConnected: false } }
                   : { value: 0, isConnected: false },
                 formula: node.type === "operation" ? "a * b" : "q",
                 position: {
                   x: 100 + (index % 3) * 350,
                   y: 100 + Math.floor(index / 3) * 250
                 },
                 operation: node.type === "operation" ? "*" : undefined
               }));
               setPreviewNodes(uniqueNodes);
             } else {
               setPreviewNodes(null);
             }
         } catch (error) {
             console.error("AI Interaction Error:", error);
             console.error("Full error context:", {
                 provider: modelConfig?.provider,
                 model: modelConfig?.model,
                 prompt: prompt.substring(0, 100) + "..."
             });
             toast.error(error.message);
             setResponse("Error Response:\n" + error.message);
         } finally {
             setIsLoading(false);
         }
     }, [prompt, allNodes, connections, settings, modelConfig]);

     const generateUniqueId = () => {
       // This can be replaced with any unique id generator (e.g. uuid)
       return '_' + Math.random().toString(36).substr(2, 9);
     };

     const handleApplyPreview = useCallback(async () => {
       if (!previewNodes) return;

       let parsedResponse;
       try {
         parsedResponse = JSON.parse(response);
       } catch (error) {
         console.error("Error parsing AI response for connections:", error);
         toast.error("Failed to parse AI response to apply connections.");
         return;
       }

       try {
         // Create a mapping from the preview node id (which may be like "input1_preview_0") to a new unique id.
         const previewIdToNewId = {};
         const newNodes = [];

         // Loop over each preview node, enrich it with defaults if necessary, and assign a new unique id.
         for (let i = 0; i < previewNodes.length; i++) {
           const preview = previewNodes[i];

           // Generate a new unique id.
           const newId = generateUniqueId();
           previewIdToNewId[preview.id] = newId;

           // Enrich the node:
           const enrichedNode = {
             ...preview,
             id: newId,
             // Ensure we have a proper name. (If the AI output was incomplete, fallback to the preview id.)
             name: preview.name || preview.id,
             // If no position was provided, assign a default based on the index.
             position: preview.position || { x: 100 + (i % 3) * 350, y: 100 + Math.floor(i / 3) * 250 },
             // If no inputs were provided, assign defaults.
             inputs: preview.inputs || (
               preview.type === "operation"
                 ? { a: { value: 0, isConnected: false }, b: { value: 0, isConnected: false } }
                 : { value: 0, isConnected: false }
             ),
             // If no formula, use a default (for operations use "a * b", otherwise "q")
             formula: preview.formula || (preview.type === "operation" ? "a * b" : "q"),
             // For operation nodes, if the operation string is missing, default to "*"
             operation: preview.type === "operation" ? (preview.operation || "*") : undefined,
             useMod2: true,
             q: 0,
             error: ""
           };

           // Insert the node using createNode.
           // IMPORTANT: Make sure your ComputationalFramework's createNode function is updated
           // so that if a node object is provided as an argument, it inserts that node directly
           // (instead of generating a new blank node).
           await createNode(enrichedNode);
           newNodes.push(enrichedNode);
         }

         // Now process the connections: remap the connection source and target ids to the new id values.
         if (parsedResponse.connections && Array.isArray(parsedResponse.connections)) {
           for (const conn of parsedResponse.connections) {
             const newSourceId = previewIdToNewId[conn.sourceId];
             const newTargetId = previewIdToNewId[conn.targetId];
             if (newSourceId && newTargetId) {
               createConnection(newSourceId, newTargetId, conn.inputName);
             }
           }
         }

         toast.success(`Created ${newNodes.length} nodes`);
         setPreviewNodes(null);
       } catch (error) {
         console.error("Failed to apply preview:", error);
         toast.error(`Failed to apply preview: ${error.message}`);
       }
     }, [previewNodes, createNode, createConnection, response]);

     const handleToggleView = () => {
         setShowJson(!showJson);
     };

     const handleProviderChange = (provider) => {
         setSelectedProvider(provider);

         const savedConfigs = localStorage.getItem('aiModelConfigs');
         let parsedConfigs = {};
         if (savedConfigs) {
             try {
                 parsedConfigs = JSON.parse(savedConfigs);
             } catch (e) {
                 console.error('Failed to parse saved configs:', e);
             }
         }

         const model = parsedConfigs[provider]?.model || MODEL_CONFIGS[provider].models[0];
         const apiKey = parsedConfigs[provider]?.apiKey || '';

         setModelConfig(prev => ({
             ...prev,
             provider,
             model,
             apiKey,
         }));
     };

     const handleApiKeyChange = (apiKey) => {
         setModelConfig(prev => ({
             ...prev,
             apiKey,
         }));
     };

     return (
         <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
             <div className="bg-white rounded-lg shadow-xl p-6 w-[600px] max-h-[80vh] overflow-y-auto">
                 <div className="flex justify-between items-center mb-4">
                     <h2 className="text-xl font-semibold">AI Node Generator</h2>
                     <Button
                         variant="ghost"
                         size="icon"
                         onClick={onClose}
                         className="h-8 w-8 p-0"
                     >
                         <X className="h-4 w-4" />
                     </Button>
                 </div>

                 <div className="space-y-4">
                     <div className="space-y-4">
                         <div className="flex gap-4">
                             <Select
                                 value={modelConfig?.provider || Object.keys(MODEL_CONFIGS)[0]}
                                 onValueChange={handleProviderChange}
                             >
                                 <SelectTrigger className="w-[200px]">
                                     <SelectValue placeholder="Select Provider" />
                                 </SelectTrigger>
                                 <SelectContent>
                                     {Object.entries(MODEL_CONFIGS).map(([key, config]) => (
                                         <SelectItem key={key} value={key}>
                                             {config.name}
                                         </SelectItem>
                                     ))}
                                 </SelectContent>
                             </Select>

                             <Select
                                 value={modelConfig?.model || MODEL_CONFIGS[modelConfig?.provider || Object.keys(MODEL_CONFIGS)[0]].models[0]}
                                 onValueChange={(model) => setModelConfig(prev => ({
                                     ...prev,
                                     model
                                 }))}
                             >
                                 <SelectTrigger className="w-[200px]">
                                     <SelectValue placeholder="Select Model" />
                                 </SelectTrigger>
                                 <SelectContent>
                                     {MODEL_CONFIGS[modelConfig?.provider || Object.keys(MODEL_CONFIGS)[0]].models.map(model => (
                                         <SelectItem key={model} value={model}>
                                             {model}
                                         </SelectItem>
                                     ))}
                                 </SelectContent>
                             </Select>
                         </div>

                         <div>
                             <Input
                                 type="password"
                                 placeholder={`Enter ${MODEL_CONFIGS[modelConfig?.provider || Object.keys(MODEL_CONFIGS)[0]].name} API Key`}
                                 value={modelConfig?.apiKey || ''}
                                 onChange={(e) => handleApiKeyChange(e.target.value)}
                                 className="w-full"
                             />
                         </div>
                     </div>

                     <div>
                         <label className="block text-sm font-medium mb-1">
                             Prompt
                         </label>
                         <Textarea
                             placeholder="Describe the node setup you want to create..."
                             value={prompt}
                             onChange={(e) => setPrompt(e.target.value)}
                             className="h-32"
                         />
                     </div>

                     <div className="bg-gray-50 rounded-md p-4">
                         <h3 className="font-medium mb-2">Logic Gate Reference</h3>
                         <ul className="space-y-2 text-sm">
                             <li>
                                 <span className="font-mono bg-gray-200 px-1 rounded">*</span>
                                 {" "}is AND (mod 2): Returns 1 only when both inputs are 1
                             </li>
                             <li>
                                 <span className="font-mono bg-gray-200 px-1 rounded">+</span>
                                 {" "}is XOR (mod 2): Returns 1 when inputs differ
                             </li>
                         </ul>
                     </div>

                     <div className="flex justify-end gap-2">
                         <Button variant="outline" onClick={onClose}>
                             Cancel
                         </Button>
                         <Button
                             onClick={handleSubmit}
                             disabled={isLoading}
                         >
                             {isLoading ? "Generating..." : "Generate Nodes"}
                         </Button>
                     </div>

                     <div className="mt-4">
                         <Button
                             variant="secondary"
                             onClick={handleToggleView}
                         >
                             {showJson ? "Show Preview" : "Show JSON"}
                         </Button>
                     </div>

                     {showJson ? (
                         response && (
                             <div className="mt-4">
                                 <h3 className="font-medium mb-2">AI Response:</h3>
                                 <pre className="bg-gray-100 p-4 rounded-md text-sm overflow-x-auto">
                                     {response}
                                 </pre>
                             </div>
                         )
                     ) : (
                         previewNodes && (
                             <div className="mt-4">
                                 <h3 className="font-medium mb-2">Preview:</h3>
                                 <div className="bg-gray-100 p-4 rounded-md">
                                     <div className="relative w-full min-h-[300px] border border-dashed border-gray-300 rounded flex flex-wrap items-start">
                                         {previewNodes.map((node, index) => (
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
                                                 node={node}
                                                 connections = {connections}
                                                 allNodes = {allNodes}
                                                 settings = {settings}
                                                 createConnection={createConnection}
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
                         )
                     )}
                 </div>
             </div>
         </div>
     );
 };

 export default AIHelper;
