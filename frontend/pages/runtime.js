import { useEffect, useMemo, useReducer, useRef, useState } from 'react';

import PlatformShell, { EmptyState, MetricTile, PlatformPanel } from '../components/PlatformShell';
import RuntimeAgentInspector from '../components/runtime/RuntimeAgentInspector';
import RuntimeDeploymentInspector from '../components/runtime/RuntimeDeploymentInspector';
import RuntimeJobInspector from '../components/runtime/RuntimeJobInspector';
import RuntimeRecordList from '../components/runtime/RuntimeRecordList';
import RuntimeRunInspector from '../components/runtime/RuntimeRunInspector';
import RuntimeToolbar from '../components/runtime/RuntimeToolbar';
import WorkflowGuide from '../components/WorkflowGuide';
import { extractItems, toErrorMessage } from '../lib/platform';
import {
  RUNTIME_API_INTEGRATION_POINTS,
  RUNTIME_COMPONENT_STRUCTURE,
  RUNTIME_LAYOUT_BLUEPRINT,
  RUNTIME_STATE_MODEL,
  buildRuntimeRunDag,
  createInitialRuntimeOperationsState,
  createRuntimeEvent,
  filterRuntimeRecords,
  getRecordKey,
  groupJobsByLifecycle,
  isRuntimeActiveStatus,
  runtimeOperationsReducer,
  summarizeRuntimeWorkspace,
} from '../lib/runtimeOperations';
import {
  backfillPipelineScope,
  backfillNotebookScope,
  cancelJob,
  getAgentFleet,
  getNotebookScopeGapReport,
  getDeployment,
  getPipeline,
  getPipelineScopeGapReport,
  getSystemStatus,
  listProjects,
  listProjectWorkspaces,
  listDeployments,
  listJobs,
  listPipelineRuns,
  listRunLogs,
  listRunNodes,
  retryJob,
  rollbackDeployment,
  updatePipelineScope,
} from '../services/api';

export default function RuntimePage() {
  const [state, dispatch] = useReducer(runtimeOperationsReducer, undefined, () => createInitialRuntimeOperationsState());
  const logCursorRef = useRef({});
  const [scopeReport, setScopeReport] = useState({ items: [], summary: null, lastBackfill: null, busyKey: '' });
  const [notebookScopeReport, setNotebookScopeReport] = useState({ items: [], summary: null, lastBackfill: null, busyKey: '' });
  const [pipelineScopeAdmin, setPipelineScopeAdmin] = useState({
    projects: [],
    workspacesByProjectId: {},
    draftsByPipelineId: {},
    busyKey: '',
  });

  async function loadScopeReport() {
    try {
      const report = await getPipelineScopeGapReport(25);
      setScopeReport((current) => ({
        ...current,
        items: extractItems(report),
        summary: report.summary || null,
      }));
    } catch (error) {
      dispatch({ type: 'set-feedback', feedback: toErrorMessage(error) });
    }
  }

  async function loadNotebookScopeReport() {
    try {
      const report = await getNotebookScopeGapReport(25);
      setNotebookScopeReport((current) => ({
        ...current,
        items: extractItems(report),
        summary: report.summary || null,
      }));
    } catch (error) {
      dispatch({ type: 'set-feedback', feedback: toErrorMessage(error) });
    }
  }

  async function loadProjectOptions() {
    try {
      const projectsPayload = await listProjects();
      setPipelineScopeAdmin((current) => ({
        ...current,
        projects: extractItems(projectsPayload),
      }));
    } catch (error) {
      dispatch({ type: 'set-feedback', feedback: toErrorMessage(error) });
    }
  }

  async function ensureProjectWorkspaces(projectId) {
    if (!projectId) {
      return [];
    }
    const cached = pipelineScopeAdmin.workspacesByProjectId[projectId];
    if (cached) {
      return cached;
    }
    const workspacesPayload = await listProjectWorkspaces(projectId);
    const items = extractItems(workspacesPayload);
    setPipelineScopeAdmin((current) => ({
      ...current,
      workspacesByProjectId: {
        ...current.workspacesByProjectId,
        [projectId]: items,
      },
    }));
    return items;
  }

  function updatePipelineScopeDraft(pipelineId, updates) {
    setPipelineScopeAdmin((current) => ({
      ...current,
      draftsByPipelineId: {
        ...current.draftsByPipelineId,
        [pipelineId]: {
          ...(current.draftsByPipelineId[pipelineId] || {}),
          ...updates,
        },
      },
    }));
  }

  async function loadRuntimeSnapshot(includeSystem = false) {
    try {
      const requests = [
        listJobs(state.statusFilter || undefined),
        getAgentFleet(),
        listPipelineRuns(state.statusFilter || undefined),
        listDeployments(),
      ];
      if (includeSystem) {
        requests.push(getSystemStatus());
      }

      const [jobs, agents, runs, deployments, system] = await Promise.all(requests);
      dispatch({
        type: 'hydrate-workspace',
        jobs: extractItems(jobs),
        agents: extractItems(agents),
        runs: extractItems(runs),
        deployments: extractItems(deployments),
        system: includeSystem ? system : state.workspace.system,
        feedback: '',
      });
    } catch (error) {
      dispatch({ type: 'set-feedback', feedback: toErrorMessage(error) });
    }
  }

  useEffect(() => {
    loadRuntimeSnapshot(true);
  }, [state.statusFilter]);

  useEffect(() => {
    loadScopeReport();
    loadNotebookScopeReport();
    loadProjectOptions();
  }, []);

  const filteredJobs = useMemo(
    () => filterRuntimeRecords('jobs', state.workspace.jobs, state.searchText),
    [state.searchText, state.workspace.jobs],
  );
  const filteredRuns = useMemo(
    () => filterRuntimeRecords('runs', state.workspace.runs, state.searchText),
    [state.searchText, state.workspace.runs],
  );
  const filteredAgents = useMemo(
    () => filterRuntimeRecords('agents', state.workspace.agents, state.searchText),
    [state.searchText, state.workspace.agents],
  );
  const filteredDeployments = useMemo(
    () => filterRuntimeRecords('deployments', state.workspace.deployments, state.searchText),
    [state.searchText, state.workspace.deployments],
  );

  const activeItems = useMemo(
    () => ({
      jobs: filteredJobs,
      runs: filteredRuns,
      agents: filteredAgents,
      deployments: filteredDeployments,
    }),
    [filteredAgents, filteredDeployments, filteredJobs, filteredRuns],
  );

  const selectedRecord = useMemo(() => {
    const items = activeItems[state.tab] || [];
    return items.find((item) => getRecordKey(item) === state.selection.recordId) || items[0] || null;
  }, [activeItems, state.selection.recordId, state.tab]);

  useEffect(() => {
    const items = activeItems[state.tab] || [];
    const currentExists = items.some((item) => getRecordKey(item) === state.selection.recordId);
    if (!items.length && state.selection.recordId) {
      dispatch({ type: 'select-record', recordId: '', clearRunNode: true, clearDeploymentRun: true });
      return;
    }
    if (!currentExists && items[0]) {
      dispatch({ type: 'select-record', recordId: getRecordKey(items[0]), clearRunNode: true, clearDeploymentRun: true });
    }
  }, [activeItems, state.selection.recordId, state.tab]);

  const hasActiveRuntime = useMemo(
    () => [...state.workspace.jobs, ...state.workspace.runs, ...state.workspace.deployments].some((item) => isRuntimeActiveStatus(item.status)),
    [state.workspace.deployments, state.workspace.jobs, state.workspace.runs],
  );

  useEffect(() => {
    if (!hasActiveRuntime) {
      return undefined;
    }
    const handle = window.setInterval(() => {
      loadRuntimeSnapshot(false);
    }, 2500);
    return () => window.clearInterval(handle);
  }, [hasActiveRuntime, state.statusFilter]);

  const selectedJob = state.tab === 'jobs' ? selectedRecord : null;
  const selectedRun = state.tab === 'runs' ? selectedRecord : null;
  const selectedAgent = state.tab === 'agents' ? selectedRecord : null;
  const selectedDeployment = state.tab === 'deployments' ? selectedRecord : null;

  const pipeline = selectedRun ? state.detail.pipelinesById[selectedRun.pipeline_id] || null : null;
  const runNodes = selectedRun ? state.detail.runNodesByRunId[selectedRun.id] || [] : [];
  const runDag = useMemo(() => buildRuntimeRunDag(pipeline, runNodes), [pipeline, runNodes]);

  const selectedRunLogKey = selectedRun ? `${selectedRun.id}:${state.selection.runNodeId || 'all'}` : '';
  const selectedRunLogs = selectedRun ? state.detail.logsByRunNodeKey[selectedRunLogKey] || [] : [];
  const deploymentDetail = selectedDeployment ? state.detail.deploymentsById[selectedDeployment.id] || null : null;
  const jobSections = useMemo(() => groupJobsByLifecycle(filteredJobs), [filteredJobs]);
  const summary = useMemo(() => summarizeRuntimeWorkspace(state.workspace), [state.workspace]);

  useEffect(() => {
    if (!selectedRun?.pipeline_id || state.tab !== 'runs') {
      return undefined;
    }

    let cancelled = false;

    async function loadRunDetail() {
      try {
        const [nextPipeline, nextRunNodes] = await Promise.all([
          getPipeline(selectedRun.pipeline_id),
          listRunNodes(selectedRun.id),
        ]);
        if (cancelled) {
          return;
        }
        dispatch({ type: 'receive-pipeline', pipeline: nextPipeline });
        dispatch({ type: 'receive-run-nodes', runId: selectedRun.id, items: extractItems(nextRunNodes) });
      } catch (error) {
        if (!cancelled) {
          dispatch({ type: 'set-feedback', feedback: toErrorMessage(error) });
        }
      }
    }

    loadRunDetail();
    if (!isRuntimeActiveStatus(selectedRun.status)) {
      return () => {
        cancelled = true;
      };
    }

    const handle = window.setInterval(loadRunDetail, 2200);
    return () => {
      cancelled = true;
      window.clearInterval(handle);
    };
  }, [selectedRun?.id, selectedRun?.pipeline_id, selectedRun?.status, state.tab]);

  useEffect(() => {
    if (!selectedRun?.id || !state.selection.runNodeId || state.tab !== 'runs') {
      return undefined;
    }

    let cancelled = false;
    const key = `${selectedRun.id}:${state.selection.runNodeId}`;

    async function loadLogs() {
      try {
        const payload = await listRunLogs(selectedRun.id, {
          nodeId: state.selection.runNodeId,
          afterId: logCursorRef.current[key] || 0,
          limit: 200,
        });
        if (cancelled) {
          return;
        }
        logCursorRef.current[key] = payload.cursor || logCursorRef.current[key] || 0;
        dispatch({
          type: 'append-run-logs',
          runId: selectedRun.id,
          nodeId: state.selection.runNodeId,
          items: extractItems(payload),
          cursor: payload.cursor,
        });
      } catch (error) {
        if (!cancelled) {
          dispatch({ type: 'set-feedback', feedback: toErrorMessage(error) });
        }
      }
    }

    loadLogs();
    if (!isRuntimeActiveStatus(selectedRun.status)) {
      return () => {
        cancelled = true;
      };
    }

    const handle = window.setInterval(loadLogs, 1600);
    return () => {
      cancelled = true;
      window.clearInterval(handle);
    };
  }, [selectedRun?.id, selectedRun?.status, state.selection.runNodeId, state.tab]);

  useEffect(() => {
    if (!selectedDeployment?.id || state.tab !== 'deployments') {
      return undefined;
    }

    let cancelled = false;

    async function loadDeploymentDetail() {
      try {
        const nextDeployment = await getDeployment(selectedDeployment.id);
        if (cancelled) {
          return;
        }
        dispatch({ type: 'receive-deployment-detail', deployment: nextDeployment });
        const runs = nextDeployment.runs || [];
        const currentRunId = state.selection.deploymentRunId;
        const currentExists = runs.some((run, index) => (run.id || `${nextDeployment.id}-run-${index}`) === currentRunId);
        if (!currentExists && runs[0]) {
          dispatch({ type: 'select-deployment-run', runId: runs[0].id || `${nextDeployment.id}-run-0` });
        }
      } catch (error) {
        if (!cancelled) {
          dispatch({ type: 'set-feedback', feedback: toErrorMessage(error) });
        }
      }
    }

    loadDeploymentDetail();
    if (!isRuntimeActiveStatus(selectedDeployment.status)) {
      return () => {
        cancelled = true;
      };
    }

    const handle = window.setInterval(loadDeploymentDetail, 2600);
    return () => {
      cancelled = true;
      window.clearInterval(handle);
    };
  }, [selectedDeployment?.id, selectedDeployment?.status, state.selection.deploymentRunId, state.tab]);

  async function handleCancelJob(job) {
    dispatch({ type: 'set-busy-key', busyKey: `cancel-${job.id}` });
    try {
      await cancelJob(job.id);
      await loadRuntimeSnapshot(false);
      dispatch({ type: 'set-feedback', feedback: `Cancelled job ${job.id}.` });
      dispatch({
        type: 'append-event',
        event: createRuntimeEvent('runtime.job.cancelled', 'Job cancelled', `Cancelled ${job.job_type} ${job.resource_id || job.id}.`, { jobId: job.id }),
      });
    } catch (error) {
      dispatch({ type: 'set-feedback', feedback: toErrorMessage(error) });
    } finally {
      dispatch({ type: 'set-busy-key', busyKey: '' });
    }
  }

  async function handleRetryJob(job) {
    dispatch({ type: 'set-busy-key', busyKey: `retry-${job.id}` });
    try {
      const response = await retryJob(job.id);
      await loadRuntimeSnapshot(false);
      const nextJobId = response?.job?.id;
      if (nextJobId) {
        dispatch({ type: 'set-tab', tab: 'jobs' });
        dispatch({ type: 'select-record', recordId: nextJobId, clearRunNode: true, clearDeploymentRun: true });
      }
      dispatch({ type: 'set-feedback', feedback: `Retried job ${job.id}.` });
      dispatch({
        type: 'append-event',
        event: createRuntimeEvent('runtime.job.retried', 'Job retried', `Requeued ${job.job_type} ${job.resource_id || job.id}.`, { jobId: job.id, nextJobId }),
      });
    } catch (error) {
      dispatch({ type: 'set-feedback', feedback: toErrorMessage(error) });
    } finally {
      dispatch({ type: 'set-busy-key', busyKey: '' });
    }
  }

  async function handleRollbackDeployment(deployment) {
    dispatch({ type: 'set-busy-key', busyKey: `rollback-${deployment.id}` });
    try {
      const response = await rollbackDeployment(deployment.id, { run_mode: 'local' });
      await loadRuntimeSnapshot(false);
      const nextJobId = response?.job?.id;
      if (nextJobId) {
        dispatch({ type: 'set-tab', tab: 'jobs' });
        dispatch({ type: 'select-record', recordId: nextJobId, clearRunNode: true, clearDeploymentRun: true });
      }
      dispatch({ type: 'set-feedback', feedback: `Queued rollback for deployment ${deployment.id}.` });
      dispatch({
        type: 'append-event',
        event: createRuntimeEvent('runtime.deployment.rollback', 'Rollback queued', `Queued rollback for deployment ${deployment.id}.`, { deploymentId: deployment.id, jobId: nextJobId }),
      });
    } catch (error) {
      dispatch({ type: 'set-feedback', feedback: toErrorMessage(error) });
    } finally {
      dispatch({ type: 'set-busy-key', busyKey: '' });
    }
  }

  async function handleBackfillScope(includeExisting = false) {
    setScopeReport((current) => ({ ...current, busyKey: includeExisting ? 'backfill-all' : 'backfill-missing' }));
    try {
      const result = await backfillPipelineScope(includeExisting);
      await loadScopeReport();
      setScopeReport((current) => ({
        ...current,
        lastBackfill: result,
      }));
      dispatch({
        type: 'set-feedback',
        feedback: `Pipeline scope backfill completed. Updated ${result.updated} records and skipped ${result.skipped}.`,
      });
      dispatch({
        type: 'append-event',
        event: createRuntimeEvent(
          'runtime.pipeline_scope.backfill',
          'Pipeline scope backfill completed',
          `Updated ${result.updated} pipeline records and skipped ${result.skipped}.`,
          result,
        ),
      });
    } catch (error) {
      dispatch({ type: 'set-feedback', feedback: toErrorMessage(error) });
    } finally {
      setScopeReport((current) => ({ ...current, busyKey: '' }));
    }
  }

  async function handleAssignPipelineScope(item) {
    const draft = pipelineScopeAdmin.draftsByPipelineId[item.id] || {};
    if (!draft.projectId || !draft.workspaceId) {
      dispatch({ type: 'set-feedback', feedback: 'Select both a project and a workspace before saving pipeline scope.' });
      return;
    }

    setPipelineScopeAdmin((current) => ({ ...current, busyKey: `assign-${item.id}` }));
    try {
      await updatePipelineScope(item.id, draft.projectId, draft.workspaceId);
      await loadScopeReport();
      dispatch({
        type: 'set-feedback',
        feedback: `Updated pipeline ${item.name || item.id} to project ${draft.projectId} and workspace ${draft.workspaceId}.`,
      });
      dispatch({
        type: 'append-event',
        event: createRuntimeEvent(
          'runtime.pipeline_scope.assigned',
          'Pipeline scope assigned',
          `Assigned ${item.name || item.id} to project ${draft.projectId} and workspace ${draft.workspaceId}.`,
          { pipelineId: item.id, projectId: draft.projectId, workspaceId: draft.workspaceId },
        ),
      });
    } catch (error) {
      dispatch({ type: 'set-feedback', feedback: toErrorMessage(error) });
    } finally {
      setPipelineScopeAdmin((current) => ({ ...current, busyKey: '' }));
    }
  }

  async function handleBackfillNotebookScope(includeExisting = false) {
    setNotebookScopeReport((current) => ({ ...current, busyKey: includeExisting ? 'backfill-all' : 'backfill-missing' }));
    try {
      const result = await backfillNotebookScope(includeExisting);
      await loadNotebookScopeReport();
      setNotebookScopeReport((current) => ({
        ...current,
        lastBackfill: result,
      }));
      dispatch({
        type: 'set-feedback',
        feedback: `Notebook scope backfill completed. Updated ${result.updated} records and skipped ${result.skipped}.`,
      });
      dispatch({
        type: 'append-event',
        event: createRuntimeEvent(
          'runtime.notebook_scope.backfill',
          'Notebook scope backfill completed',
          `Updated ${result.updated} notebook records and skipped ${result.skipped}.`,
          result,
        ),
      });
    } catch (error) {
      dispatch({ type: 'set-feedback', feedback: toErrorMessage(error) });
    } finally {
      setNotebookScopeReport((current) => ({ ...current, busyKey: '' }));
    }
  }

  return (
    <PlatformShell
      eyebrow="Runtime Operations"
      title="Operate jobs, runs, agents, and deployments from one live control center."
      description="Runtime Ops now behaves like the canonical operator console: grouped work queues, run graph debugging, live node logs, remote fleet visibility, and deployment rollback stay in one surface."
      focus="global"
      actions={state.feedback ? <div className="rounded-2xl border border-stone-200 bg-white/80 px-4 py-3 text-sm text-slate-600">{state.feedback}</div> : null}
    >
      <WorkflowGuide
        currentStep="runtime"
        counts={{
          pipelines: state.workspace.runs.length,
          runs: state.workspace.jobs.length + state.workspace.runs.length + state.workspace.deployments.length,
        }}
        primaryAction={{
          label: 'Open Flow Builder',
          href: '/flow',
        }}
        secondaryAction={{
          label: 'Open Jupyter workspace',
          href: '/notebooks',
          tone: 'secondary',
        }}
        title="Runtime should close the loop and send the user back into authoring fast"
        description="The operator console is the end of the execution path, but not the end of the workflow. From here the user should be able to jump back into Flow Builder or notebook authoring without rebuilding the mental model of what just happened."
      />

      <PlatformPanel title="Control center snapshot" description="Live service posture across jobs, runs, agent fleet capacity, and deployment state.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricTile label="Service" value={state.workspace.system?.status || 'unknown'} detail={state.workspace.system?.detail || 'Backend heartbeat'} />
          <MetricTile label="Jobs" value={summary.activeJobs} detail="Queued, running, or rollback work items." />
          <MetricTile label="Runs" value={summary.activeRuns} detail="Pipeline executions currently in flight." />
          <MetricTile label="Agents" value={summary.activeAgents} detail="Workers with a live lease and heartbeat." />
          <MetricTile label="Deployments" value={summary.activeDeployments} detail="Active or recently successful rollout records." />
        </div>
      </PlatformPanel>

      <PlatformPanel
        title="Pipeline scope maintenance"
        description="Run project/workspace backfill from the app and inspect any pipeline records that still cannot be scoped automatically."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={loadScopeReport}
              disabled={scopeReport.busyKey !== ''}
              className="rounded-2xl border border-stone-200 bg-white px-4 py-3 font-semibold text-slate-700 transition hover:bg-stone-50 disabled:opacity-50"
            >
              Refresh report
            </button>
            <button
              onClick={() => handleBackfillScope(false)}
              disabled={scopeReport.busyKey !== ''}
              className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
            >
              {scopeReport.busyKey === 'backfill-missing' ? 'Backfilling...' : 'Backfill missing scope'}
            </button>
            <button
              onClick={() => handleBackfillScope(true)}
              disabled={scopeReport.busyKey !== ''}
              className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 font-semibold text-sky-700 transition hover:bg-sky-100 disabled:opacity-50"
            >
              {scopeReport.busyKey === 'backfill-all' ? 'Revalidating...' : 'Revalidate all scope'}
            </button>
          </div>
        }
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricTile label="Unscoped" value={scopeReport.summary?.total ?? 0} detail="Pipeline records still missing a project or workspace column." />
          <MetricTile label="Recoverable" value={scopeReport.summary?.recoverable_count ?? 0} detail="Rows that still have enough DAG metadata to be promoted automatically." />
          <MetricTile label="Needs Cleanup" value={scopeReport.summary?.unrecoverable_count ?? 0} detail="Rows missing scope metadata entirely and requiring manual enrichment or resave." />
          <MetricTile
            label="Last Backfill"
            value={scopeReport.lastBackfill ? scopeReport.lastBackfill.updated : 'none'}
            detail={
              scopeReport.lastBackfill
                ? `Updated ${scopeReport.lastBackfill.updated}, skipped ${scopeReport.lastBackfill.skipped}, scanned ${scopeReport.lastBackfill.scanned}.`
                : 'No manual backfill run from Runtime Ops yet.'
            }
          />
        </div>

        <div className="mt-6 rounded-[30px] border border-stone-200/80 bg-white/82 p-5 shadow-[0_18px_44px_rgba(148,163,184,0.12)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-accent/45">Remaining scope gaps</div>
              <div className="mt-2 text-sm leading-6 text-accent/68">Rows listed here still need project/workspace cleanup after the current backfill pass.</div>
            </div>
            <div className="text-xs uppercase tracking-[0.2em] text-accent/45">Top {scopeReport.summary?.limit ?? 25}</div>
          </div>

          <div className="mt-4 space-y-3">
            {scopeReport.items.length ? (
              scopeReport.items.map((item) => (
                <div key={item.id} className="rounded-[26px] border border-stone-200 bg-stone-50/80 p-4 shadow-[0_12px_28px_rgba(148,163,184,0.08)]">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{item.name || item.id}</div>
                      <div className="mt-1 text-xs text-slate-500">{item.id}</div>
                    </div>
                    <div className={`rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] ${item.recoverable ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                      {item.recoverable ? 'recoverable' : 'manual cleanup'}
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4 text-sm text-accent/68">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.2em] text-accent/45">Project column</div>
                      <div className="mt-1 text-slate-900">{item.project_id || 'missing'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.2em] text-accent/45">Workspace column</div>
                      <div className="mt-1 text-slate-900">{item.workspace_id || 'missing'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.2em] text-accent/45">Derived project</div>
                      <div className="mt-1 text-slate-900">{item.derived_project_id || 'none in DAG metadata'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.2em] text-accent/45">Derived workspace</div>
                      <div className="mt-1 text-slate-900">{item.derived_workspace_id || 'none in DAG metadata'}</div>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-accent/55">Reasons: {(item.reasons || []).join(', ') || 'none'}</div>
                  {!item.recoverable ? (
                    <div className="mt-4 grid gap-3 rounded-[24px] border border-stone-200 bg-white p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.2em] text-accent/45">Assign project</div>
                        <select
                          value={(pipelineScopeAdmin.draftsByPipelineId[item.id] || {}).projectId || ''}
                          onChange={async (event) => {
                            const nextProjectId = event.target.value;
                            updatePipelineScopeDraft(item.id, { projectId: nextProjectId, workspaceId: '' });
                            if (nextProjectId) {
                              await ensureProjectWorkspaces(nextProjectId);
                            }
                          }}
                          className="mt-2 w-full rounded-[22px] border border-stone-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none"
                        >
                          <option value="">Select project</option>
                          {pipelineScopeAdmin.projects.map((project) => (
                            <option key={project.id} value={project.id}>{project.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.2em] text-accent/45">Assign workspace</div>
                        <select
                          value={(pipelineScopeAdmin.draftsByPipelineId[item.id] || {}).workspaceId || ''}
                          onChange={(event) => updatePipelineScopeDraft(item.id, { workspaceId: event.target.value })}
                          disabled={!(pipelineScopeAdmin.draftsByPipelineId[item.id] || {}).projectId}
                          className="mt-2 w-full rounded-[22px] border border-stone-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none disabled:opacity-50"
                        >
                          <option value="">Select workspace</option>
                          {(pipelineScopeAdmin.workspacesByProjectId[(pipelineScopeAdmin.draftsByPipelineId[item.id] || {}).projectId] || []).map((workspace) => (
                            <option key={workspace.id} value={workspace.id}>{workspace.name}</option>
                          ))}
                        </select>
                      </div>
                      <button
                        onClick={() => handleAssignPipelineScope(item)}
                        disabled={pipelineScopeAdmin.busyKey !== ''}
                        className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-700 transition hover:bg-sky-100 disabled:opacity-50"
                      >
                        {pipelineScopeAdmin.busyKey === `assign-${item.id}` ? 'Saving...' : 'Assign scope'}
                      </button>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
                      This row is recoverable from DAG metadata. Use backfill instead of manual assignment.
                    </div>
                  )}
                </div>
              ))
            ) : (
              <EmptyState
                title="No pipeline scope gaps"
                message="All pipeline records are currently scoped, or no pipelines match the current tenant."
                detail="This panel only lights up when backfill or manual assignment work is still required."
              />
            )}
          </div>
        </div>
      </PlatformPanel>

      <PlatformPanel
        title="Notebook scope maintenance"
        description="Backfill notebook project/workspace columns and inspect any notebook assets that still cannot be scoped automatically."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={loadNotebookScopeReport}
              disabled={notebookScopeReport.busyKey !== ''}
              className="rounded-2xl border border-stone-200 bg-white px-4 py-3 font-semibold text-slate-700 transition hover:bg-stone-50 disabled:opacity-50"
            >
              Refresh report
            </button>
            <button
              onClick={() => handleBackfillNotebookScope(false)}
              disabled={notebookScopeReport.busyKey !== ''}
              className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
            >
              {notebookScopeReport.busyKey === 'backfill-missing' ? 'Backfilling...' : 'Backfill missing scope'}
            </button>
            <button
              onClick={() => handleBackfillNotebookScope(true)}
              disabled={notebookScopeReport.busyKey !== ''}
              className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 font-semibold text-sky-700 transition hover:bg-sky-100 disabled:opacity-50"
            >
              {notebookScopeReport.busyKey === 'backfill-all' ? 'Revalidating...' : 'Revalidate all scope'}
            </button>
          </div>
        }
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricTile label="Unscoped" value={notebookScopeReport.summary?.total ?? 0} detail="Notebook records still missing a project or workspace column." />
          <MetricTile label="Recoverable" value={notebookScopeReport.summary?.recoverable_count ?? 0} detail="Rows that still have enough notebook metadata to be promoted automatically." />
          <MetricTile label="Needs Cleanup" value={notebookScopeReport.summary?.unrecoverable_count ?? 0} detail="Rows missing scope metadata entirely and requiring manual enrichment or resave." />
          <MetricTile
            label="Last Backfill"
            value={notebookScopeReport.lastBackfill ? notebookScopeReport.lastBackfill.updated : 'none'}
            detail={
              notebookScopeReport.lastBackfill
                ? `Updated ${notebookScopeReport.lastBackfill.updated}, skipped ${notebookScopeReport.lastBackfill.skipped}, scanned ${notebookScopeReport.lastBackfill.scanned}.`
                : 'No manual backfill run from Runtime Ops yet.'
            }
          />
        </div>

        <div className="mt-6 rounded-[30px] border border-stone-200/80 bg-white/82 p-5 shadow-[0_18px_44px_rgba(148,163,184,0.12)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-accent/45">Remaining notebook scope gaps</div>
              <div className="mt-2 text-sm leading-6 text-accent/68">Rows listed here still need project/workspace cleanup after the current notebook backfill pass.</div>
            </div>
            <div className="text-xs uppercase tracking-[0.2em] text-accent/45">Top {notebookScopeReport.summary?.limit ?? 25}</div>
          </div>

          <div className="mt-4 space-y-3">
            {notebookScopeReport.items.length ? (
              notebookScopeReport.items.map((item) => (
                <div key={item.id} className="rounded-[26px] border border-stone-200 bg-stone-50/80 p-4 shadow-[0_12px_28px_rgba(148,163,184,0.08)]">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{item.title || item.id}</div>
                      <div className="mt-1 text-xs text-slate-500">{item.id}</div>
                    </div>
                    <div className={`rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] ${item.recoverable ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                      {item.recoverable ? 'recoverable' : 'manual cleanup'}
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4 text-sm text-accent/68">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.2em] text-accent/45">Project column</div>
                      <div className="mt-1 text-slate-900">{item.project_id || 'missing'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.2em] text-accent/45">Workspace column</div>
                      <div className="mt-1 text-slate-900">{item.workspace_id || 'missing'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.2em] text-accent/45">Derived project</div>
                      <div className="mt-1 text-slate-900">{item.derived_project_id || 'none in notebook metadata'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.2em] text-accent/45">Derived workspace</div>
                      <div className="mt-1 text-slate-900">{item.derived_workspace_id || 'none in notebook metadata'}</div>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-accent/55">Reasons: {(item.reasons || []).join(', ') || 'none'}</div>
                </div>
              ))
            ) : (
              <EmptyState
                title="No notebook scope gaps"
                message="All notebook records are currently scoped, or no notebooks match the current tenant."
                detail="Notebook scope maintenance only appears when metadata is missing or inconsistent with the current tenant model."
              />
            )}
          </div>
        </div>
      </PlatformPanel>

      <PlatformPanel title="Operator console" description="Search, filter, and drill into jobs, runs, agents, and deployments without leaving Runtime Ops.">
        <RuntimeToolbar
          tab={state.tab}
          statusFilter={state.statusFilter}
          searchText={state.searchText}
          lastUpdatedAt={state.lastUpdatedAt}
          onTabChange={(tab) => dispatch({ type: 'set-tab', tab })}
          onStatusFilterChange={(value) => dispatch({ type: 'set-status-filter', value })}
          onSearchChange={(value) => dispatch({ type: 'set-search-text', value })}
        />

        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[30px] border border-stone-200/80 bg-white/82 p-5 shadow-[0_18px_44px_rgba(148,163,184,0.12)]">
            <RuntimeRecordList
              tab={state.tab}
              items={activeItems[state.tab] || []}
              sections={state.tab === 'jobs' ? jobSections : null}
              selectedId={getRecordKey(selectedRecord)}
              onSelect={(recordId) => dispatch({ type: 'select-record', recordId, clearRunNode: true, clearDeploymentRun: true })}
            />
          </div>

          <div className="rounded-[30px] border border-stone-200/80 bg-white/82 p-5 shadow-[0_18px_44px_rgba(148,163,184,0.12)]">
            {selectedRecord ? (
              <>
                {state.tab === 'jobs' ? (
                  <RuntimeJobInspector job={selectedJob} busyKey={state.busyKey} onCancel={handleCancelJob} onRetry={handleRetryJob} />
                ) : null}
                {state.tab === 'runs' ? (
                  <RuntimeRunInspector
                    run={selectedRun}
                    pipeline={pipeline}
                    dag={runDag}
                    runNodes={runNodes}
                    selectedRunNodeId={state.selection.runNodeId}
                    logs={selectedRunLogs}
                    onSelectRunNode={(nodeId) => dispatch({ type: 'select-run-node', nodeId })}
                  />
                ) : null}
                {state.tab === 'agents' ? <RuntimeAgentInspector agent={selectedAgent} /> : null}
                {state.tab === 'deployments' ? (
                  <RuntimeDeploymentInspector
                    deployment={selectedDeployment}
                    detail={deploymentDetail}
                    busyKey={state.busyKey}
                    onRollback={handleRollbackDeployment}
                    onSelectRun={(runId) => dispatch({ type: 'select-deployment-run', runId })}
                    selectedRunId={state.selection.deploymentRunId}
                  />
                ) : null}
              </>
            ) : (
              <EmptyState
                title="Select a runtime record"
                message="Choose a job, run, agent, or deployment to inspect logs, state, workload assignment, or rollout history."
                detail="The right-hand inspector follows the selected record and stays empty until one runtime object is in focus."
              />
            )}
          </div>
        </div>
      </PlatformPanel>

      <PlatformPanel title="Console architecture" description="The runtime page now documents its own UI structure, reducer slices, and backend touchpoints so the operator surface stays aligned with the platform model.">
        <div className="grid gap-4 xl:grid-cols-3">
          <div className="rounded-[30px] border border-stone-200/80 bg-white/82 p-5 shadow-[0_18px_44px_rgba(148,163,184,0.12)]">
            <div className="text-xs uppercase tracking-[0.24em] text-accent/45">React components</div>
            <div className="mt-4 space-y-3">
              {RUNTIME_COMPONENT_STRUCTURE.map((item) => (
                <div key={item.name} className="rounded-[24px] border border-stone-200 bg-stone-50/80 p-4 shadow-[0_12px_28px_rgba(148,163,184,0.08)]">
                  <div className="text-sm font-semibold text-slate-900">{item.name}</div>
                  <div className="mt-2 text-sm leading-6 text-slate-600">{item.role}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] border border-stone-200/80 bg-white/82 p-5 shadow-[0_18px_44px_rgba(148,163,184,0.12)]">
            <div className="text-xs uppercase tracking-[0.24em] text-accent/45">State management</div>
            <div className="mt-4 space-y-3">
              {RUNTIME_STATE_MODEL.map((item) => (
                <div key={item.slice} className="rounded-[24px] border border-stone-200 bg-stone-50/80 p-4 shadow-[0_12px_28px_rgba(148,163,184,0.08)]">
                  <div className="text-sm font-semibold text-slate-900">{item.slice}</div>
                  <div className="mt-2 text-xs uppercase tracking-[0.2em] text-accent/45">{item.fields.join(' · ')}</div>
                  <div className="mt-3 text-sm leading-6 text-slate-600">{item.purpose}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] border border-stone-200/80 bg-white/82 p-5 shadow-[0_18px_44px_rgba(148,163,184,0.12)]">
            <div className="text-xs uppercase tracking-[0.24em] text-accent/45">API mapping</div>
            <div className="mt-4 space-y-3">
              {RUNTIME_API_INTEGRATION_POINTS.map((item) => (
                <div key={item.intent} className="rounded-[24px] border border-stone-200 bg-stone-50/80 p-4 shadow-[0_12px_28px_rgba(148,163,184,0.08)]">
                  <div className="text-sm font-semibold text-slate-900">{item.intent}</div>
                  <div className="mt-2 text-xs uppercase tracking-[0.2em] text-accent/45">{item.endpoint}</div>
                  <div className="mt-3 text-sm leading-6 text-slate-600">{item.outcome}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </PlatformPanel>

      <PlatformPanel title="UI layout" description="The operator console keeps inventory, drill-down, and live execution tracing visible at once.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {RUNTIME_LAYOUT_BLUEPRINT.map((item) => (
            <div key={item.zone} className="rounded-[28px] border border-stone-200/80 bg-white/82 p-5 shadow-[0_18px_44px_rgba(148,163,184,0.12)]">
              <div className="text-xs uppercase tracking-[0.24em] text-accent/45">{item.zone}</div>
              <div className="mt-3 text-sm leading-6 text-slate-600">{item.purpose}</div>
            </div>
          ))}
        </div>
      </PlatformPanel>
    </PlatformShell>
  );
}