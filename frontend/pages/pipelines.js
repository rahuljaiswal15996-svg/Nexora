import { useState } from "react";
import CodeEditor from "../components/CodeEditor";
import DAGEditor from "../components/DAGEditor";
import MonacoEditorWrapper from "../components/MonacoEditorWrapper";
import { createPipeline, runPipeline, getRunStatus, getPipeline } from "../services/api";

export default function PipelinesPage() {
  const [dagText, setDagText] = useState(JSON.stringify({ nodes: [] }, null, 2));
  const [pipelineId, setPipelineId] = useState("");
  const [runId, setRunId] = useState("");
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    setError("");
    try {
      const dag = JSON.parse(dagText);
      const res = await createPipeline(dag, "mvp-pipeline");
      setPipelineId(res.pipeline_id);
    } catch (err) {
      setError(err.message || "Failed to create pipeline");
    }
  };

  const handleRun = async () => {
    setError("");
    try {
      if (!pipelineId) throw new Error("Create or provide pipeline id first");
      const res = await runPipeline(pipelineId, {});
      setRunId(res.run_id || res.runId || "");
      setStatus({ status: "queued" });
    } catch (err) {
      setError(err.message || "Failed to start run");
    }
  };

  const handleStatus = async () => {
    setError("");
    try {
      if (!runId) throw new Error("No run id available");
      const s = await getRunStatus(runId);
      setStatus(s);
    } catch (err) {
      setError(err.message || "Failed to fetch status");
    }
  };

  const handleLoadPipeline = async () => {
    setError("");
    try {
      if (!pipelineId) throw new Error("No pipeline id provided");
      const p = await getPipeline(pipelineId);
      setDagText(JSON.stringify(p.dag_json || {}, null, 2));
    } catch (err) {
      setError(err.message || "Failed to load pipeline");
    }
  };

  return (
    <main style={{ padding: "2rem", fontFamily: "Arial, sans-serif" }}>
      <h1>Pipelines (MVP)</h1>
      <p>Create a DAG JSON, persist as a pipeline, run and query run status.</p>

      <div style={{ maxWidth: "1000px", display: "grid", gap: "1rem" }}>
        <div>
          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>Pipeline DAG JSON</label>
          <MonacoEditorWrapper value={dagText} onChange={(v) => setDagText(v)} language={"json"} height={220} />
        </div>

        <div>
          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>Visual DAG</label>
          <DAGEditor dagJson={dagText} onChange={(v) => setDagText(v)} />
        </div>

        <div style={{ display: "flex", gap: "1rem" }}>
          <button onClick={handleCreate} style={{ padding: "0.6rem 1rem", borderRadius: "8px" }}>Create pipeline</button>
          <button onClick={handleRun} style={{ padding: "0.6rem 1rem", borderRadius: "8px" }}>Run pipeline</button>
          <button onClick={handleStatus} style={{ padding: "0.6rem 1rem", borderRadius: "8px" }}>Get run status</button>
          <button onClick={handleLoadPipeline} style={{ padding: "0.6rem 1rem", borderRadius: "8px" }}>Load pipeline</button>
        </div>

        <div>
          <div><strong>Pipeline id:</strong> {pipelineId}</div>
          <div><strong>Run id:</strong> {runId}</div>
          {status && (
            <pre style={{ background: "#f8fafc", padding: "1rem", borderRadius: "8px" }}>{JSON.stringify(status, null, 2)}</pre>
          )}
          {error && <div style={{ color: "#b91c1c", fontWeight: 600 }}>{error}</div>}
        </div>
      </div>
    </main>
  );
}
