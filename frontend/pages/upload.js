import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import CodeEditor from "../components/CodeEditor";
import DAGEditor from "../components/DAGEditor";
import MonacoEditorWrapper from "../components/MonacoEditorWrapper";
import DiffViewer from "../components/DiffViewer";
import ProjectWorkspaceContext from "../components/ProjectWorkspaceContext";
import PlatformShell, { MetricTile, PlatformPanel } from "../components/PlatformShell";
import { buildWorkspaceHref, useProjectWorkspace } from "../lib/projectWorkspace";
import { saveFlowDraft } from "../lib/workspaceState";
import { parseFile, parseText, convertFile, convertText } from "../services/api";

const SOURCE_LANGUAGE_OPTIONS = [
  { value: "auto", label: "Auto-detect" },
  { value: "sas", label: "SAS / PROC SQL" },
  { value: "sql", label: "SQL" },
  { value: "python", label: "Python" },
  { value: "r", label: "R" },
  { value: "spark_sql", label: "Spark SQL" },
  { value: "scala", label: "Scala" },
  { value: "shell", label: "Shell" },
];

const TARGET_LANGUAGE_OPTIONS = [
  { value: "python", label: "Python" },
  { value: "sql", label: "SQL" },
  { value: "pyspark", label: "PySpark" },
  { value: "dbt", label: "dbt Model SQL" },
];

function getEditorLanguage(sourceLanguage) {
  if (["python", "pyspark"].includes(sourceLanguage)) {
    return "python";
  }
  if (["sql", "sas", "spark_sql"].includes(sourceLanguage)) {
    return "sql";
  }
  if (sourceLanguage === "r") {
    return "r";
  }
  return "plaintext";
}

function PipelineCard({ title, pipeline, tone }) {
  if (!pipeline) {
    return null;
  }

  const summary = pipeline.summary || {};
  const executionPlan = pipeline.dag?.metadata?.execution_plan || null;
  const pillClass =
    tone === "source"
      ? "bg-sky-100 text-sky-700"
      : "bg-emerald-100 text-emerald-700";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg font-semibold text-primary">{title}</h3>
          <p className="text-sm text-accent mt-1">{pipeline.name}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className={`rounded-full px-3 py-2 font-medium ${pillClass}`}>
            {summary.language || "auto"}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-2 font-medium text-slate-700">
            {summary.operation_count || 0} steps
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-2 font-medium text-slate-700">
            {summary.input_count || 0} inputs
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-2 font-medium text-slate-700">
            {summary.output_count || 0} outputs
          </span>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 mb-4 text-sm text-accent">
        <div className="rounded-xl bg-slate-50 px-4 py-3 border border-slate-200">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-2">Artifact</div>
          <div className="font-medium text-slate-900">{summary.artifact || "Uploaded Code"}</div>
        </div>
        <div className="rounded-xl bg-slate-50 px-4 py-3 border border-slate-200">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-2">Pipeline record</div>
          <div className="font-medium text-slate-900 break-all">{pipeline.pipeline_id || "Preview only"}</div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2 text-xs text-slate-600">
        {(summary.inputs || []).length > 0 ? (
          (summary.inputs || []).map((inputName) => (
            <span key={inputName} className="rounded-full border border-slate-200 bg-white px-3 py-2">
              {inputName}
            </span>
          ))
        ) : (
          <span className="rounded-full border border-slate-200 bg-white px-3 py-2">No explicit inputs detected</span>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-2 text-xs text-slate-600">
        {(summary.outputs || []).length > 0 ? (
          (summary.outputs || []).map((outputName) => (
            <span key={outputName} className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">
              {outputName}
            </span>
          ))
        ) : (
          <span className="rounded-full border border-slate-200 bg-white px-3 py-2">No explicit outputs detected</span>
        )}
      </div>

      <DAGEditor dagJson={pipeline.dag} />

      <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 border border-slate-200">
        <div className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-2">Detected execution path</div>
        <div className="text-sm text-slate-700">
          {(summary.operations || []).length > 0 ? summary.operations.join(" -> ") : "Nexora created a single generic execution step."}
        </div>
      </div>

      {(summary.lineage_paths || []).length > 0 ? (
        <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 border border-slate-200">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-2">Lineage paths</div>
          <div className="space-y-2 text-sm text-slate-700">
            {summary.lineage_paths.slice(0, 4).map((path, index) => (
              <div key={`${path.source}-${path.target}-${index}`}>
                {path.source}{" -> "}{path.target}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {executionPlan ? (
        <div className="mt-4 rounded-xl bg-slate-950 px-4 py-3 text-white">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-300 mb-2">Runtime plan</div>
          <div className="grid gap-3 md:grid-cols-3 text-sm">
            <div>
              <div className="text-slate-400">Runtime</div>
              <div className="font-medium">{executionPlan.runtime}</div>
            </div>
            <div>
              <div className="text-slate-400">Target</div>
              <div className="font-medium">{executionPlan.target_platform}</div>
            </div>
            <div>
              <div className="text-slate-400">Schedule</div>
              <div className="font-medium">{executionPlan.schedule?.cron || "manual"}</div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MigrationProgramCard({ program }) {
  if (!program) {
    return null;
  }

  const project = program.project || {};
  const workspaces = program.workspaces || [];
  const catalog = program.catalog || {};
  const sourceDatasets = catalog.source_datasets || [];
  const targetDatasets = catalog.target_datasets || [];
  const lineage = catalog.lineage || [];
  const qualityCheck = catalog.quality_check || null;
  const notebook = program.notebook || {};
  const executionPlan = program.execution_plan || {};
  const handoff = program.deployment_handoff || {};
  const datasetNameById = Object.fromEntries(
    [...sourceDatasets, ...targetDatasets].map((dataset) => [dataset.id, dataset.name])
  );

  return (
    <section className="bg-white shadow-md rounded-lg p-6 mt-6">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h3 className="text-xl font-semibold text-primary">Auto-created migration program</h3>
          <p className="text-sm text-accent mt-1">Nexora combined project setup, catalog lineage, notebook seeding, and runtime handoff into one conversion workflow.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-primary/10 px-3 py-2 font-medium text-primary">Project {project.id}</span>
          <span className="rounded-full bg-slate-100 px-3 py-2 font-medium text-slate-700">{workspaces.length} workspaces</span>
          <span className="rounded-full bg-slate-100 px-3 py-2 font-medium text-slate-700">{sourceDatasets.length + targetDatasets.length} datasets</span>
          <span className="rounded-full bg-slate-100 px-3 py-2 font-medium text-slate-700">Deployment {handoff.mode || "draft"}</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-2">Project and workspaces</div>
          <div className="text-lg font-semibold text-slate-900 mb-2">{project.name}</div>
          <div className="space-y-2 text-sm text-slate-700">
            {workspaces.map((workspace) => (
              <div key={workspace.id} className="rounded-xl bg-white border border-slate-200 px-3 py-2">
                <div className="font-medium">{workspace.name}</div>
                <div className="text-xs text-slate-500">{workspace.description}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-2">Catalog and lineage</div>
          <div className="space-y-3 text-sm text-slate-700">
            <div>
              <div className="font-medium text-slate-900 mb-1">Source datasets</div>
              <div className="flex flex-wrap gap-2">
                {sourceDatasets.map((dataset) => (
                  <span key={dataset.id} className="rounded-full border border-sky-200 bg-sky-50 px-3 py-2 text-sky-700">{dataset.name}</span>
                ))}
              </div>
            </div>
            <div>
              <div className="font-medium text-slate-900 mb-1">Target datasets</div>
              <div className="flex flex-wrap gap-2">
                {targetDatasets.map((dataset) => (
                  <span key={dataset.id} className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">{dataset.name}</span>
                ))}
              </div>
            </div>
            <div>
              <div className="font-medium text-slate-900 mb-1">Lineage</div>
              <div className="space-y-2">
                {lineage.map((item) => (
                  <div key={item.id} className="rounded-xl bg-white border border-slate-200 px-3 py-2">
                    {(datasetNameById[item.source_dataset_id] || item.source_dataset_id)}{" -> "}{(datasetNameById[item.target_dataset_id] || item.target_dataset_id)}
                  </div>
                ))}
              </div>
            </div>
            {qualityCheck ? (
              <div className="rounded-xl bg-white border border-slate-200 px-3 py-2">
                <div className="font-medium text-slate-900">Quality gate: {qualityCheck.status}</div>
                <div className="text-xs text-slate-500">Similarity ratio {qualityCheck.metrics?.similarity_ratio ?? "n/a"}</div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-2">Notebook and runtime handoff</div>
          <div className="space-y-3 text-sm text-slate-700">
            <div className="rounded-xl bg-white border border-slate-200 px-3 py-2">
              <div className="font-medium text-slate-900">Notebook</div>
              <div>{notebook.title}</div>
              <div className="text-xs text-slate-500 break-all">{notebook.id}</div>
            </div>
            <div className="rounded-xl bg-white border border-slate-200 px-3 py-2">
              <div className="font-medium text-slate-900">Runtime</div>
              <div>{executionPlan.runtime} on {executionPlan.target_platform}</div>
              <div className="text-xs text-slate-500">Schedule {executionPlan.schedule?.cron || "manual"}</div>
              <div className="text-xs text-slate-500">Retries {executionPlan.retries?.max_attempts || 0}</div>
            </div>
            <div className="rounded-xl bg-white border border-slate-200 px-3 py-2">
              <div className="font-medium text-slate-900">Deployment handoff</div>
              <div>Mode: {handoff.mode || "draft"}</div>
              <div className="text-xs text-slate-500">Recommended target {handoff.recommended_target || executionPlan.target_platform}</div>
              {handoff.deployment?.id ? <div className="text-xs text-slate-500 break-all">Deployment {handoff.deployment.id}</div> : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function UploadPage() {
  const router = useRouter();
  const {
    activeProject,
    activeProjectId,
    activeWorkspaceId,
    context: projectNavigationContext,
    error: projectWorkspaceError,
    loading: projectWorkspaceLoading,
    projects: projectOptions,
    setActiveProject,
    setActiveWorkspace,
  } = useProjectWorkspace();
  const [file, setFile] = useState(null);
  const [code, setCode] = useState("PROC SQL\nSELECT * FROM users;");
  const [sourceLanguage, setSourceLanguage] = useState("sas");
  const [targetLanguage, setTargetLanguage] = useState("python");
  const [analysis, setAnalysis] = useState(null);
  const [result, setResult] = useState(null);
  const [loadingState, setLoadingState] = useState("");
  const [error, setError] = useState("");

  const loading = loadingState !== "";
  const sourcePipeline = analysis?.source_pipeline || result?.source_pipeline || null;
  const convertedPipeline = result?.converted_pipeline || null;
  const migrationSummary = result?.meta?.migration_summary || null;
  const migrationProgram = result?.migration_program || null;
  const migrationProjectContext = useMemo(
    () => ({
      projectId: migrationProgram?.project?.id || activeProjectId || "",
      workspaceId:
        migrationProgram?.project_context?.active_workspace_id ||
        activeWorkspaceId ||
        migrationProgram?.workspaces?.[0]?.id ||
        "",
    }),
    [activeProjectId, activeWorkspaceId, migrationProgram],
  );
  const sourceStepCount = sourcePipeline?.summary?.operation_count || 0;
  const convertedStepCount = convertedPipeline?.summary?.operation_count || 0;
  const linkedDatasetCount = (migrationProgram?.catalog?.source_datasets || []).length + (migrationProgram?.catalog?.target_datasets || []).length;

  useEffect(() => {
    if (!analysis && !result) {
      return;
    }
    saveFlowDraft({
      analysis,
      result,
      source_pipeline: analysis?.source_pipeline || result?.source_pipeline || null,
      converted_pipeline: result?.converted_pipeline || null,
      migration_program: result?.migration_program || null,
      meta: {
        source_language: result?.source_language || analysis?.source_language || sourceLanguage,
        target_language: result?.target_language || targetLanguage,
      },
      project_context: {
        project_id: migrationProjectContext.projectId || activeProjectId || "",
        workspace_id: migrationProjectContext.workspaceId || activeWorkspaceId || "",
      },
      saved_at: new Date().toISOString(),
    });
  }, [activeProjectId, activeWorkspaceId, analysis, migrationProjectContext.projectId, migrationProjectContext.workspaceId, result, sourceLanguage, targetLanguage]);

  const resetAnalysis = ({ keepFile = true } = {}) => {
    setAnalysis(null);
    setResult(null);
    setError("");
    if (!keepFile) {
      setFile(null);
    }
  };

  const analyzeSource = async ({ preserveLoadingState = false, suppressError = false } = {}) => {
    setError("");
    setResult(null);
    if (!preserveLoadingState) {
      setLoadingState("analyzing");
    }
    try {
      const data = file
        ? await parseFile(file, { sourceLanguage, projectId: activeProjectId, workspaceId: activeWorkspaceId })
        : await parseText(code, { sourceLanguage, projectId: activeProjectId, workspaceId: activeWorkspaceId });
      setAnalysis(data);
      return data;
    } catch (err) {
      const message = err.message || "Source flow analysis failed";
      setError(message);
      if (!suppressError) {
        throw err;
      }
      return null;
    } finally {
      if (!preserveLoadingState) {
        setLoadingState("");
      }
    }
  };

  const handleConvert = async () => {
    setError("");
    setResult(null);
    setLoadingState("converting");
    try {
      if (!analysis) {
        await analyzeSource({ preserveLoadingState: true });
      }
      const data = file
        ? await convertFile(file, { sourceLanguage, targetLanguage, projectId: activeProjectId, workspaceId: activeWorkspaceId })
        : await convertText(code, { sourceLanguage, targetLanguage, projectId: activeProjectId, workspaceId: activeWorkspaceId });
      setResult(data);
    } catch (err) {
      setError(err.message || "Convert failed");
    } finally {
      setLoadingState("");
    }
  };

  useEffect(() => {
    if (!file) {
      return undefined;
    }

    let cancelled = false;
    const runAutoAnalysis = async () => {
      setError("");
      setResult(null);
      setLoadingState("analyzing");
      try {
        const data = await parseFile(file, { sourceLanguage, projectId: activeProjectId, workspaceId: activeWorkspaceId });
        if (!cancelled) {
          setAnalysis(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Source flow analysis failed");
        }
      } finally {
        if (!cancelled) {
          setLoadingState("");
        }
      }
    };

    runAutoAnalysis();
    return () => {
      cancelled = true;
    };
  }, [activeProjectId, activeWorkspaceId, file, sourceLanguage]);

  return (
    <PlatformShell
      eyebrow="Migration Studio"
      title="Convert legacy assets inside the active project instead of generating disconnected migration output."
      description="The conversion surface now follows the same project and workspace model as Flow Builder and Notebook Workspace, so generated assets stay attached to a real program context."
      focus="project"
      navigationContext={projectNavigationContext}
      aside={
        <ProjectWorkspaceContext
          projects={projectOptions}
          activeProject={activeProject}
          activeWorkspaceId={activeWorkspaceId}
          loading={projectWorkspaceLoading}
          error={projectWorkspaceError}
          onProjectChange={setActiveProject}
          onWorkspaceChange={setActiveWorkspace}
        />
      }
      actions={
        <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-accent/72">
          <div>
            {activeProject
              ? `Active program: ${activeProject.name}. New conversion artifacts will attach to this project and workspace.`
              : "No active program is selected. A conversion run will bootstrap a new project context."}
          </div>
          {error ? <div className="text-rose-200">{error}</div> : null}
        </div>
      }
    >
      <PlatformPanel title="Studio snapshot" description="Migration Studio now shares the same scoped operating model as the rest of the project layer.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricTile
            label="Program"
            value={activeProject?.name || "New migration program"}
            detail={activeProject ? "Conversion assets will land in the current program context." : "A new project will be created from the conversion output."}
          />
          <MetricTile label="Source Steps" value={sourceStepCount} detail="Detected operations in the source flow preview." />
          <MetricTile label="Converted Steps" value={convertedStepCount} detail="Generated operations in the target flow." />
          <MetricTile label="Program Assets" value={linkedDatasetCount} detail="Catalog datasets materialized from the migration run." />
        </div>
      </PlatformPanel>

      <PlatformPanel title="Program-bound conversion" description="Analyze and convert once, then move directly into the scoped flow and notebook workspaces that own the result.">
        <div className="rounded-[28px] border border-white/10 bg-white p-6 shadow-md">
          <div className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-accent mb-2">Source language</label>
              <select
                value={sourceLanguage}
                onChange={(event) => {
                  setSourceLanguage(event.target.value);
                  setAnalysis(null);
                  setResult(null);
                  setError("");
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                {SOURCE_LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-accent mb-2">Target language</label>
              <select
                value={targetLanguage}
                onChange={(event) => {
                  setTargetLanguage(event.target.value);
                  setResult(null);
                  setError("");
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                {TARGET_LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-accent mb-2">Upload file</label>
            <input
              type="file"
              accept=".sql,.sas,.py,.r,.scala,.sh,.txt"
              onChange={(event) => {
                const nextFile = event.target.files?.[0] || null;
                setFile(nextFile);
                resetAnalysis();
              }}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-blue-700"
            />
            <p className="mt-2 text-xs text-accent/80">Selecting a file triggers source-flow analysis automatically. If a file is present, it takes precedence over pasted code.</p>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-accent mb-2">Paste code</label>
            <MonacoEditorWrapper
              value={code}
              onChange={(value) => {
                setCode(value);
                setAnalysis(null);
                setResult(null);
                setError("");
              }}
              language={getEditorLanguage(sourceLanguage)}
              height={180}
            />
          </div>

          <div className="flex flex-wrap gap-4 mb-4">
            <button
              onClick={() => analyzeSource()}
              disabled={loading}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loadingState === "analyzing" ? "Building source flow..." : "Analyze source flow"}
            </button>
            <button
              onClick={handleConvert}
              disabled={loading}
              className="px-4 py-2 bg-secondary text-accent rounded-lg hover:bg-gray-200 disabled:opacity-50"
            >
              {loadingState === "converting" ? "Converting and building target flow..." : "Convert and build target flow"}
            </button>
          </div>

          {error ? (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          ) : null}
        </div>
      </PlatformPanel>

      {sourcePipeline && !result ? (
        <PlatformPanel title="Source flow preview" description="The source pipeline preview is produced in the same project context that will own the converted assets.">
          <PipelineCard title="Auto-generated source flow" pipeline={sourcePipeline} tone="source" />
        </PlatformPanel>
      ) : null}

      {analysis?.uir ? (
        <PlatformPanel title="UIR" description="Inspect the intermediate representation before conversion or promotion.">
          <div className="rounded-[28px] border border-white/10 bg-white p-6 shadow-md">
            <h3 className="text-xl font-semibold text-primary mb-4">UIR (Universal Intermediate Representation)</h3>
            <div className="mb-3 text-sm text-accent">
              Parsed source language: <span className="font-semibold text-primary">{analysis.source_language || sourceLanguage}</span>
            </div>
            <MonacoEditorWrapper value={JSON.stringify(analysis.uir, null, 2)} readOnly language={"json"} height={240} />
          </div>
        </PlatformPanel>
      ) : null}

      {result ? (
        <PlatformPanel title="Conversion result" description="Open the generated flow and notebook inside the same project workspace that owns the migration output.">
          <div className="rounded-[28px] border border-white/10 bg-white p-6 shadow-md">
            <h3 className="text-xl font-semibold text-primary mb-4">Conversion Result</h3>
            <div className="mb-4 flex flex-wrap gap-2 text-sm">
              <span className="rounded-full bg-primary/10 px-3 py-2 text-primary">
                Source: {result.source_language || sourceLanguage}
              </span>
              <span className="rounded-full bg-green-100 px-3 py-2 text-green-700">
                Target: {result.target_language || targetLanguage}
              </span>
              <span className="rounded-full bg-surface px-3 py-2 text-accent border border-surface-hover">
                Engine: {result.meta?.engine_version || 'n/a'}
              </span>
            </div>

            {migrationSummary ? (
              <div className="grid gap-4 md:grid-cols-3 mb-6 text-sm">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-2">Source operations</div>
                  <div className="text-2xl font-semibold text-slate-900">{migrationSummary.source_operations || 0}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-2">Converted operations</div>
                  <div className="text-2xl font-semibold text-slate-900">{migrationSummary.converted_operations || 0}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-2">Shared inputs</div>
                  <div className="text-sm font-medium text-slate-900">
                    {(migrationSummary.shared_inputs || []).length > 0 ? migrationSummary.shared_inputs.join(", ") : "No explicit inputs detected"}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mb-6 flex flex-wrap gap-3">
              <button
                onClick={() => router.push(buildWorkspaceHref("/flow", migrationProjectContext))}
                className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Open in Flow Builder
              </button>
              <button
                onClick={() =>
                  router.push(
                    buildWorkspaceHref(
                      "/notebooks",
                      migrationProjectContext,
                      migrationProgram?.notebook?.id ? { notebook: migrationProgram.notebook.id } : {},
                    ),
                  )
                }
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Open Jupyter workspace
              </button>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {migrationProgram?.project_context?.mode === "reused"
                  ? "Migration Studio output was attached to the active project and persisted as the latest Flow Builder draft."
                  : "Migration Studio output bootstrapped a new project context and was persisted as the latest Flow Builder draft."}
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-2 mb-6">
              <PipelineCard title="Source flow before migration" pipeline={sourcePipeline} tone="source" />
              <PipelineCard title="Converted flow after migration" pipeline={convertedPipeline} tone="converted" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div>
                <h4 className="text-lg font-medium text-gray-800 mb-2">Original</h4>
                <CodeEditor value={result.original} readOnly label="" />
              </div>
              <div>
                <h4 className="text-lg font-medium text-gray-800 mb-2">Converted</h4>
                <CodeEditor value={result.converted} readOnly label="" />
              </div>
            </div>
            <div>
              <h4 className="text-lg font-medium text-gray-800 mb-2">Diff</h4>
              <DiffViewer original={result.original} converted={result.converted} />
            </div>
          </div>
        </PlatformPanel>
      ) : null}

      {migrationProgram ? (
        <PlatformPanel title="Program handoff" description="Project, workspace, catalog, notebook, and deployment handoff are now part of one conversion result instead of follow-up navigation.">
          <MigrationProgramCard program={migrationProgram} />
        </PlatformPanel>
      ) : null}
    </PlatformShell>
  );
}
