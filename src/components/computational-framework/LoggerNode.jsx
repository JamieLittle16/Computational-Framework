import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import BaseNode from './BaseNode';
import { Button } from '@/components/ui/button';
import { Copy } from 'lucide-react';


const LoggerNode = ({ node, updateNode, ...props }) => {
    const [newLog, setNewLog] = useState('');
     const logHistory = useMemo(() => node.logHistory || [], [node.logHistory]);
    const previousClockInput = useRef(node.previousClockInput || 0);
    const logDisplayRef = useRef(null);

  const handleLog = useCallback(() => {
        if (newLog.trim()) {
            updateNode(node.id, prevNode => ({
                ...prevNode,
                logHistory: [...(prevNode.logHistory || []), newLog],
            }));
            setNewLog('');
        }

  }, [newLog, updateNode, node.id]);

   const copyToClipboard = useCallback(() => {
       const logString = logHistory.map((log) => {
            const dataString = Object.entries(log.data).map(([key, value]) => `${key}: ${value}`).join(', ');
            return `[${log.timestamp}] ${dataString}`;
        }).join('\n');

        navigator.clipboard.writeText(logString).then(() => {
           console.log("Copied to clipboard");
        }, (err) => {
            console.error("Failed to copy", err);
        });
   }, [logHistory]);


  const clearLog = useCallback(() => {
      updateNode(node.id, { ...node, logHistory: [] });
  }, [updateNode, node.id]);


  const handleInputChange = useCallback((inputName, value) => {
      updateNode(node.id, prevNode => ({
        ...prevNode,
        inputs: {
            ...prevNode.inputs,
            [inputName]: { ...prevNode.inputs[inputName], value: value}
        }
      }));
  }, [node.id, updateNode])

    useEffect(() => {
         const clockInput = node.inputs['clock'] ? node.inputs['clock'].value : 0
         if (clockInput === 1 || clockInput === true) {
             if (previousClockInput.current === 0 || previousClockInput.current === false) {
                const logEntry = {
                    timestamp: new Date().toLocaleTimeString(),
                    data: Object.entries(node.inputs).filter(([key, input]) => key !== 'clock').reduce((acc, [key, input]) => {
                            acc[key] = input.value;
                            return acc;
                        }, {})
                };
               updateNode(node.id, prevNode => ({
                  ...prevNode,
                  logHistory: [...(prevNode.logHistory || []), logEntry]
               }));

               if (logDisplayRef.current) {
                   logDisplayRef.current.scrollTop = logDisplayRef.current.scrollHeight;
               }
             }
          }
         previousClockInput.current = clockInput;

    }, [node.inputs, node.id, updateNode])


     return (
          <BaseNode  {...props} node={node} updateNode={updateNode} >
                <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                           Clock Input
                     </label>
                    <div
                         className="w-6 h-6 bg-gray-400 rounded-full cursor-pointer transition-all duration-200 hover:scale-110 hover:shadow-md"
                        style={{ width: '16px', height: '16px', marginLeft: '4px' }}
                     />
                  </div>
               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">Log:</label>
                        <div className="max-h-40 overflow-auto border rounded-md mt-2 p-2" ref={logDisplayRef}>
                            {logHistory.map((log, index) => (
                                <div key={index} className="text-sm text-gray-800 py-1 border-b last:border-b-0">
                                    <span className="text-gray-500">{log.timestamp}</span>
                                        {Object.entries(log.data).map(([key, value], idx) => (
                                            <span key={idx}>{` ${key}: ${value}`}</span>
                                        ))}
                                </div>
                            ))}
                             {logHistory.length > 0 ?
                             <div className="flex gap-2 mt-2">
                                  <Button onClick={clearLog} size="sm" >Clear Log</Button>
                                  <Button onClick={copyToClipboard} size="sm" > <Copy className="h-4 w-4" /> </Button>
                               </div>
                             : <p className="text-sm text-gray-500 text-center">No logs yet.</p>
                           }
                        </div>
                   </div>
        </BaseNode>
     );
   };
export default LoggerNode;
