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
      <div style={{ height: 360, border: "1px solid #e5e7eb", borderRadius: 8 }}>
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
      <div style={{ marginBottom: 8, color: "#6b7280" }}>DAG editor (JSON)</div>
      <textarea value={typeof dagJson === "string" ? dagJson : JSON.stringify(dagJson || {}, null, 2)} onChange={(e) => onChange && onChange(e.target.value)} rows={8} style={{ width: "100%", fontFamily: "monospace", padding: "1rem" }} />
    </div>
  );
}
