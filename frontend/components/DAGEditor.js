import { useEffect, useRef, useState } from "react";

export default function DAGEditor({ dagJson, onChange }) {
  const [loaded, setLoaded] = useState(false);
  const [ReactFlow, setReactFlow] = useState(null);
  const [elements, setElements] = useState([]);

  useEffect(() => {
    let mounted = true;
    import("react-flow-renderer").then((rf) => {
      if (!mounted) return;
      setReactFlow(rf);
      setLoaded(true);
    }).catch(() => {
      setLoaded(false);
    });
    return () => (mounted = false);
  }, []);

  useEffect(() => {
    try {
      const parsed = typeof dagJson === "string" ? JSON.parse(dagJson) : dagJson || {};
      const nodes = (parsed.nodes || []).map((n, i) => ({ id: n.id || `node_${i}`, data: { label: n.id || `node_${i}` }, position: { x: i * 100, y: 50 } }));
      setElements(nodes);
    } catch (e) {
      setElements([]);
    }
  }, [dagJson]);

  if (loaded && ReactFlow) {
    const { ReactFlowProvider, ReactFlow: RF, MiniMap, Controls } = ReactFlow;
    return (
      <div className="h-80 border border-gray-300 rounded-lg">
        <ReactFlowProvider>
          <RF elements={elements}>
            <MiniMap />
            <Controls />
          </RF>
        </ReactFlowProvider>
      </div>
    );
  }

  // Fallback: show JSON editor
  return (
    <div>
      <div className="mb-2 text-gray-500">DAG editor (JSON)</div>
      <textarea
        value={typeof dagJson === "string" ? dagJson : JSON.stringify(dagJson || {}, null, 2)}
        onChange={(e) => onChange && onChange(e.target.value)}
        rows={8}
        className="w-full p-4 border border-gray-300 rounded-lg font-mono focus:ring-2 focus:ring-primary focus:border-transparent"
      />
    </div>
  );
}
