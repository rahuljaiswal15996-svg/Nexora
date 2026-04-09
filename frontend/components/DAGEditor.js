import { useEffect, useState } from "react";
import { Background, Controls, MarkerType, MiniMap, Position, ReactFlow, ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

const LEGEND = [
  { kind: "dataset", label: "Dataset" },
  { kind: "recipe", label: "Recipe" },
  { kind: "notebook", label: "Notebook" },
  { kind: "model", label: "Model" },
  { kind: "validation", label: "Validation" },
  { kind: "deploy", label: "Deploy" },
];

function nodeTheme(kind, executionStatus, pathState = "idle") {
  const palette = {
    dataset: { background: "#e0f2fe", border: "#0284c7", accent: "#075985" },
    recipe: { background: "#fef3c7", border: "#d97706", accent: "#92400e" },
    notebook: { background: "#cffafe", border: "#0891b2", accent: "#155e75" },
    model: { background: "#dcfce7", border: "#16a34a", accent: "#166534" },
    validation: { background: "#fee2e2", border: "#dc2626", accent: "#991b1b" },
    deploy: { background: "#e0e7ff", border: "#4f46e5", accent: "#3730a3" },
  };
  const theme = palette[kind] || palette.recipe;
  if (executionStatus === "running") {
    return { ...theme, border: "#f59e0b", accent: "#b45309", glow: "0 0 0 3px rgba(245, 158, 11, 0.18)" };
  }
  if (executionStatus === "success") {
    return { ...theme, border: "#22c55e", accent: "#166534", glow: "0 0 0 3px rgba(34, 197, 94, 0.16)" };
  }
  if (executionStatus === "failed") {
    return { ...theme, border: "#ef4444", accent: "#991b1b", glow: "0 0 0 3px rgba(239, 68, 68, 0.18)" };
  }
  if (pathState === "failed") {
    return { ...theme, glow: "0 0 0 3px rgba(239, 68, 68, 0.12)" };
  }
  if (pathState === "running") {
    return { ...theme, glow: "0 0 0 3px rgba(245, 158, 11, 0.1)" };
  }
  return { ...theme, glow: "none" };
}

function normalizeNode(node, index, selectedNodeId, highlightedNodeIds) {
  const kind = node.kind || node.data?.kind || "recipe";
  const label = node.label || node.data?.label || node.id || `node_${index}`;
  const description = node.description || node.data?.description || "";
  const executionStatus = node.executionStatus || node.status || node.data?.executionStatus || "idle";
  const theme = nodeTheme(kind, executionStatus, node.pathState || "idle");
  const x = typeof node.position?.x === "number" ? node.position.x : 80 + (index % 4) * 240;
  const y = typeof node.position?.y === "number" ? node.position.y : 80 + Math.floor(index / 4) * 170;
  const isSelected = node.id === selectedNodeId;
  const isHighlighted = highlightedNodeIds.has(node.id);
  const badges = Array.isArray(node.badges) ? node.badges.slice(0, 3) : [];

  return {
    id: node.id || `node_${index}`,
    type: "default",
    position: { x, y },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    style: {
      width: 220,
      borderRadius: 18,
      border: `1px solid ${theme.border}`,
      background: theme.background,
      boxShadow: isSelected
        ? `0 18px 40px rgba(15, 23, 42, 0.16), ${theme.glow}`
        : isHighlighted
          ? `0 16px 34px rgba(15, 23, 42, 0.12), ${theme.glow}`
          : `0 14px 30px rgba(15, 23, 42, 0.08), ${theme.glow}`,
      padding: 0,
      opacity: isSelected || isHighlighted || !highlightedNodeIds.size ? 1 : 0.78,
    },
    data: {
      executionStatus,
      label: (
        <div className="px-4 py-3 text-left">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: theme.accent }}>{kind}</div>
            <div className="rounded-full bg-white/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">{executionStatus}</div>
          </div>
          <div className="mt-2 text-sm font-semibold text-slate-900">{label}</div>
          {description ? <div className="mt-2 text-xs leading-5 text-slate-600">{description}</div> : null}
          {badges.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {badges.map((badge) => (
                <span key={badge} className="rounded-full bg-white/75 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                  {badge}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ),
    },
  };
}

export default function DAGEditor({
  dagJson,
  onNodeSelect,
  onEdgeSelect,
  onConnect,
  onCanvasClick,
  onNodePositionChange,
  selectedNodeId,
  selectedEdgeId,
  highlightedNodeIds = [],
  highlightedEdgeIds = [],
  overlayMode = "execution",
  showLegend = true,
  heightClass = "h-[28rem]",
  editable = false,
}) {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);

  useEffect(() => {
    try {
      const parsed = typeof dagJson === "string" ? JSON.parse(dagJson) : dagJson || {};
      const highlightedNodeIdSet = new Set(highlightedNodeIds);
      const highlightedEdgeIdSet = new Set(highlightedEdgeIds);
      const statusByNodeId = Object.fromEntries((parsed.nodes || []).map((node) => [node.id, node.executionStatus || node.status || "idle"]));
      const dagNodes = (parsed.nodes || []).map((node, index) => normalizeNode(node, index, selectedNodeId, highlightedNodeIdSet));
      const dagEdges = (parsed.edges || []).map((e, i) => ({
        id: e.id || `edge_${i}`,
        source: e.source,
        target: e.target,
        type: "smoothstep",
        label: overlayMode === "execution" && (e.flowKind || "data") === "data" ? "" : e.label || (e.flowKind || "data"),
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color:
            e.executionStatus === "success"
              ? "#22c55e"
              : e.executionStatus === "failed"
                ? "#ef4444"
                : e.executionStatus === "running"
                  ? "#f59e0b"
                  : e.flowKind === "schema"
                    ? "#f97316"
                    : e.flowKind === "control"
                      ? "#38bdf8"
                      : "#64748b",
        },
        animated: Boolean(e.animated || (overlayMode !== "validation" && (statusByNodeId[e.source] === "running" || statusByNodeId[e.target] === "running"))),
        labelStyle: {
          fill: e.flowKind === "schema" ? "#c2410c" : e.flowKind === "control" ? "#0f766e" : "#475569",
          fontSize: 10,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.14em",
        },
        style: {
          stroke:
            e.executionStatus === "success"
              ? "#22c55e"
              : e.executionStatus === "failed"
                ? "#ef4444"
                : e.executionStatus === "running"
                  ? "#f59e0b"
                  : e.flowKind === "schema"
                    ? "#f97316"
                    : e.flowKind === "control"
                      ? "#38bdf8"
                      : "#64748b",
          strokeDasharray: e.flowKind === "schema" ? "6 4" : e.flowKind === "control" ? "2 6" : undefined,
          strokeWidth: selectedEdgeId === e.id || highlightedEdgeIdSet.has(e.id) || e.isFailurePath ? 3.2 : e.executionStatus === "running" ? 2.6 : 1.8,
          opacity: highlightedEdgeIdSet.size && !highlightedEdgeIdSet.has(e.id) && !e.isRunningPath ? 0.68 : 1,
        },
      }));
      setNodes(dagNodes);
      setEdges(dagEdges);
    } catch {
      setNodes([]);
      setEdges([]);
    }
  }, [dagJson, highlightedEdgeIds, highlightedNodeIds, overlayMode, selectedEdgeId, selectedNodeId]);

  return (
    <div className="space-y-3">
      {showLegend ? (
        <div className="flex flex-wrap gap-2 text-xs text-slate-600">
          {LEGEND.map((item) => {
            const theme = nodeTheme(item.kind, "idle");
            return (
              <div key={item.kind} className="rounded-full border px-3 py-2" style={{ borderColor: theme.border, background: theme.background, color: theme.accent }}>
                {item.label}
              </div>
            );
          })}
        </div>
      ) : null}

      <div className={`${heightClass} rounded-2xl border border-slate-200 bg-[#f8fafc]`}>
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            nodesDraggable={editable}
            nodesConnectable={editable}
            elementsSelectable={editable}
            zoomOnDoubleClick={false}
            onNodeClick={(_event, node) => onNodeSelect?.(node.id)}
            onEdgeClick={(_event, edge) => onEdgeSelect?.(edge.id)}
            onPaneClick={() => onCanvasClick?.()}
            onConnect={(connection) => onConnect?.(connection)}
            onNodeDragStop={(_event, node) => onNodePositionChange?.(node.id, node.position)}
          >
            <MiniMap
              pannable
              zoomable
              nodeColor={(node) => {
                const status = `${node.data?.executionStatus || ""}`.toLowerCase();
                if (status === "success") {
                  return "#22c55e";
                }
                if (status === "failed") {
                  return "#ef4444";
                }
                if (status === "running") {
                  return "#f59e0b";
                }
                return "#0f172a";
              }}
            />
            <Controls />
            <Background color="#cbd5e1" gap={16} />
          </ReactFlow>
        </ReactFlowProvider>
      </div>
    </div>
  );
}
