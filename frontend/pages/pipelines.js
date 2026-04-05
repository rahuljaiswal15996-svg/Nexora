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
    <div className="bg-secondary min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">Pipelines</h1>
          <p className="text-accent">Create and manage DAG-based data pipelines with visual editing and execution.</p>
        </div>

        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-accent mb-2">Pipeline DAG JSON</label>
            <MonacoEditorWrapper value={dagText} onChange={(v) => setDagText(v)} language={"json"} height={220} />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-accent mb-2">Visual DAG</label>
            <DAGEditor dagJson={dagText} onChange={(v) => setDagText(v)} />
          </div>

          <div className="flex gap-4 mb-4">
            <button
              onClick={handleCreate}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700"
            >
              Create pipeline
            </button>
            <button
              onClick={handleRun}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700"
            >
              Run pipeline
            </button>
            <button
              onClick={handleStatus}
              className="px-4 py-2 bg-secondary text-accent rounded-lg hover:bg-gray-200"
            >
              Get run status
            </button>
            <button
              onClick={handleLoadPipeline}
              className="px-4 py-2 bg-secondary text-accent rounded-lg hover:bg-gray-200"
            >
              Load pipeline
            </button>
          </div>

          <div className="space-y-2">
            <div><strong>Pipeline id:</strong> {pipelineId}</div>
            <div><strong>Run id:</strong> {runId}</div>
            {status && (
              <pre className="bg-gray-50 p-4 rounded-lg border text-sm overflow-auto">{JSON.stringify(status, null, 2)}</pre>
            )}
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
