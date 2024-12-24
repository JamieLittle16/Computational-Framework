export interface NodeInput {
    value: number;
    isConnected: boolean;
  }
  
  export interface Node {
    id: number;
    position: {
      x: number;
      y: number;
    };
    inputs: Record<string, NodeInput>;
    formula: string;
    useMod2: boolean;
    q: number;
  }
  
  export interface Connection {
    sourceId: number;
    targetId: number;
    inputName: string;
  }