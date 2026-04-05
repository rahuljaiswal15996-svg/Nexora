import { useEffect, useRef, useState } from "react";
import { ReactFlow, ReactFlowProvider, MiniMap, Controls, Background } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

export default function DAGEditor({ dagJson, onChange }) {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);

  useEffect(() => {
    try {
      const parsed = typeof dagJson === "string" ? JSON.parse(dagJson) : dagJson || {};
      const dagNodes = (parsed.nodes || []).map((n, i) => ({
        id: n.id || `node_${i}`,
        data: { label: n.id || `node_${i}` },
        position: { x: i * 150, y: 50 },
        type: 'default'
      }));
      const dagEdges = (parsed.edges || []).map((e, i) => ({
        id: `edge_${i}`,
        source: e.source,
        target: e.target,
        type: 'default'
      }));
      setNodes(dagNodes);
      setEdges(dagEdges);
    } catch (e) {
      setNodes([]);
      setEdges([]);
    }
  }, [dagJson]);

  const onNodesChange = (changes) => {
    setNodes((nds) => {
      const updatedNodes = [...nds];
      changes.forEach((change) => {
        if (change.type === 'position' && change.dragging) {
          const nodeIndex = updatedNodes.findIndex((n) => n.id === change.id);
          if (nodeIndex !== -1) {
            updatedNodes[nodeIndex].position = change.position;
          }
        }
      });
      return updatedNodes;
    });
  };

  const onEdgesChange = (changes) => {
    setEdges((eds) => {
      // Handle edge changes if needed
      return eds;
    });
  };

  return (
    <div className="h-80 border border-gray-300 rounded-lg bg-background">
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
        >
          <MiniMap />
          <Controls />
          <Background />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
}
