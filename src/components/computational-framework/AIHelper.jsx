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
import ComputationalNode from './ComputationalNode';
import basePrompt from './basePrompt';

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
            'gemini-2.0-flash'
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
    updateNode,
    onClose,
    offset, // Receive the offset from the main component
    transformNode,
}) => {
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [response, setResponse] = useState('');
    const [selectedProvider, setSelectedProvider] = useState(Object.keys(MODEL_CONFIGS)[0]);
    const [modelConfig, setModelConfig] = useState(() => {
        const savedConfigs = localStorage.getItem('aiModelConfigs');
        if (savedConfigs) {
            try {
                const parsedConfigs = JSON.parse(savedConfigs);
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

         const fullPrompt = `
             ${basePrompt}

             Current setup:
              \`\`\`json
             ${JSON.stringify(context, null, 2)}
              \`\`\`

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
                          { role: "user", content: fullPrompt }
                      ]
                  };
                  break;

              case 'GEMINI':
                  endpoint = `${MODEL_CONFIGS.GEMINI.baseUrl}/models/${modelConfig.model}:generateContent`;
                  payload = {
                      contents: [{
                          parts: [{ text: fullPrompt }]
                      }]
                  };
                  break;

              case 'DEEPSEEK':
                  endpoint = `${MODEL_CONFIGS.DEEPSEEK.baseUrl}/chat/completions`;
                  payload = {
                      model: modelConfig.model,
                      messages: [
                          { role: "system", content: "You are an AI assistant that generates node setups..." },
                          { role: "user", content: fullPrompt }
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
          let toastId;
          try {
              const context = {
                  nodes: allNodes,
                  connections: connections,
                  settings: settings,
              };

              toastId = toast.loading("Generating node setup...");
              const aiResponse = await callAI(prompt, context);

              setResponse(JSON.stringify(aiResponse, null, 2));

              if (aiResponse && aiResponse.nodes) {
                 const parsedResponse = aiResponse; // No need to re-parse, it's already parsed in callAI
                 console.log("Parsed response in handleSubmit", parsedResponse)
                 // Ensure unique IDs before setting preview nodes
                 const uniqueNodes = parsedResponse.nodes.map((node, index) => ({
                   ...node,
                   id: `${node.id}_preview_${index}`, // Append a unique suffix
                   name: node.id,
                   useMod2: true,
                   inputs: node.type === "operation"
                    ? { a: { value: 0, isConnected: false }, b: { value: 0, isConnected: false } } // Adjust inputs based on the node type
                    : { value: 0, isConnected: false },
                   position: {
                     x: 100 + (index % 3) * 350,
                     y: 100 + Math.floor(index / 3) * 250,                },              }));               setPreviewNodes(uniqueNodes);
              } else {
                setPreviewNodes(null);
              }
              toast.success("Node setup generated!", { id: toastId }); // Resolve loading toast
          } catch (error) {
              console.error("AI Interaction Error:", error);
              console.error("Full error context:", {
                  provider: modelConfig?.provider,
                  model: modelConfig?.model,
                  prompt: prompt.substring(0, 100) + "..."
              });
              toast.error(error.message, { id: toastId }); // Resolve loading toast with error
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
          let toastId;
          try {
              toastId = toast.loading("Applying node setup...");

              // Create a mapping from preview IDs to new IDs
              const idMapping = new Map();
              const createdNodes = [];

              // First pass: Create all nodes and build ID mapping
              for (const previewNode of previewNodes) {
                  const newId = generateUniqueId();
                  idMapping.set(previewNode.id, newId);

                  const enrichedNode = {
                      ...previewNode,
                      id: newId,
                      name: previewNode.name || `Node ${newId}`,
                      position: previewNode.position || {
                          x: 100 + (createdNodes.length % 3) * 350,
                          y: 100 + Math.floor(createdNodes.length / 3) * 250
                      },
                      inputs: {},
                      formula: previewNode.formula || '',
                      useMod2: true,
                      q: 0,
                      error: ''
                  };

                  // Initialize inputs based on node type
                  if (previewNode.type === "operation") {
                      enrichedNode.inputs = {
                          a: { value: 0, isConnected: false },
                          b: { value: 0, isConnected: false }
                      };
                  } else {
                      enrichedNode.inputs = { value: 0, isConnected: false };
                  }

                  await createNode(enrichedNode);
                  createdNodes.push(enrichedNode);
              }

              // Second pass: Create connections using the new IDs
              if (parsedResponse.connections && Array.isArray(parsedResponse.connections)) {
                  for (const connection of parsedResponse.connections) {
                      const newSourceId = idMapping.get(connection.sourceId);
                      const newTargetId = idMapping.get(connection.targetId);

                      if (newSourceId && newTargetId) {
                          // Make sure the input exists on the target node
                          const targetNode = createdNodes.find(n => n.id === newTargetId);
                          if (targetNode && targetNode.inputs && connection.inputName in targetNode.inputs) {
                              await createConnection(newSourceId, newTargetId, connection.inputName);

                              // Update the target node's input connection status
                              const updatedNode = {
                                  ...targetNode,
                                  inputs: {
                                      ...targetNode.inputs,
                                      [connection.inputName]: {
                                          ...targetNode.inputs[connection.inputName],
                                          isConnected: true
                                      }
                                  }
                              };

                              await updateNode(newTargetId, updatedNode);
                          }
                      }
                  }
              }

              toast.success(`Created ${createdNodes.length} nodes with connections`, { id: toastId });
              setPreviewNodes(null);
          } catch (error) {
              console.error("Failed to apply preview:", error);
              toast.error(`Failed to apply preview: ${error.message}`, { id: toastId });
          }
     }, [previewNodes, createNode, createConnection, updateNode, response]);

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
                                                      connections={connections}
                                                      allNodes={allNodes}
                                                      settings={settings}
                                                      createConnection={createConnection}
                                                      offset={offset} // Pass the offset here
                                                      transformNode={transformNode} // Pass the transformNode function
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
