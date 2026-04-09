import { useEffect, useState } from 'react';

import ProjectWorkspaceContext from '../components/ProjectWorkspaceContext';
import PlatformShell, { EmptyState, MetricTile, PlatformPanel, StatusPill } from '../components/PlatformShell';
import WorkflowGuide from '../components/WorkflowGuide';
import { buildWorkspaceHref, useProjectWorkspace } from '../lib/projectWorkspace';
import { extractItems, isJobActive, toErrorMessage } from '../lib/platform';
import {
  createExperiment,
  createExperimentRun,
  getJob,
  listExperimentRuns,
  listExperiments,
  listJobs,
  listModelServing,
  registerModelServing,
} from '../services/api';

function parseJsonInput(value, fallback = {}) {
  if (!value.trim()) {
    return fallback;
  }
  return JSON.parse(value);
}

export default function MLPage() {
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
  const [projects, setProjects] = useState([]);
  const [experiments, setExperiments] = useState([]);
  const [runs, setRuns] = useState([]);
  const [modelServing, setModelServing] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [selectedExperimentId, setSelectedExperimentId] = useState('');
  const [activeJob, setActiveJob] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [forms, setForms] = useState({
    experimentName: '',
    experimentDescription: '',
    experimentProjectId: '',
    runStatus: 'completed',
    runMetrics: '{"accuracy": 0.91, "latency_ms": 128}',
    modelVersionId: '',
    endpointUrl: 'https://inference.nexora.local/model/v1',
    servingStatus: 'active',
  });

  async function loadML() {
    try {
      const [experimentPayload, jobPayload, servingPayload] = await Promise.all([
        listExperiments(activeProjectId || undefined),
        listJobs(undefined, 'experiment_run'),
        listModelServing(),
      ]);
      const experimentItems = extractItems(experimentPayload);
      setProjects(projectOptions);
      setExperiments(experimentItems);
      setJobs(extractItems(jobPayload));
      setModelServing(extractItems(servingPayload));
      setSelectedExperimentId((current) => (experimentItems.some((experiment) => experiment.id === current) ? current : experimentItems[0]?.id || ''));
      setForms((current) => ({
        ...current,
        experimentProjectId: activeProjectId || current.experimentProjectId || projectOptions[0]?.id || '',
      }));
      setFeedback('');
    } catch (error) {
      setFeedback(toErrorMessage(error));
    }
  }

  async function loadRuns(experimentId) {
    if (!experimentId) {
      setRuns([]);
      return;
    }
    try {
      const payload = await listExperimentRuns(experimentId);
      setRuns(extractItems(payload));
    } catch (error) {
      setFeedback(toErrorMessage(error));
    }
  }

  useEffect(() => {
    if (projectWorkspaceLoading) {
      return;
    }
    loadML();
  }, [activeProjectId, projectOptions, projectWorkspaceLoading]);

  useEffect(() => {
    setProjects(projectOptions);
  }, [projectOptions]);

  useEffect(() => {
    loadRuns(selectedExperimentId);
  }, [selectedExperimentId]);

  useEffect(() => {
    if (!activeJob || !isJobActive(activeJob)) {
      return undefined;
    }
    const handle = window.setInterval(async () => {
      try {
        const nextJob = await getJob(activeJob.id);
        setActiveJob(nextJob);
        if (!isJobActive(nextJob)) {
          await loadML();
          await loadRuns(selectedExperimentId);
        }
      } catch (error) {
        setFeedback(toErrorMessage(error));
      }
    }, 2500);
    return () => window.clearInterval(handle);
  }, [activeJob, selectedExperimentId]);

  const activeExperimentJobCount = jobs.filter((job) => isJobActive(job)).length;
  const mlGuideSteps = [
    {
      key: 'project',
      label: 'Project',
      description: 'Keep experiment work scoped to the active delivery context.',
      state: activeProjectId && activeWorkspaceId ? 'complete' : 'next',
      value: activeProject?.name || 'Select an active project',
      href: '/projects',
    },
    {
      key: 'notebook',
      label: 'Notebook',
      description: 'Prepare features, evaluation logic, or candidate assets for experiment work.',
      state: experiments.length || runs.length ? 'complete' : 'upcoming',
      value: `${runs.length} experiment runs tracked`,
      href: buildWorkspaceHref('/notebooks', projectNavigationContext),
    },
    {
      key: 'flow',
      label: 'Flow',
      description: 'Promote validated candidates back into orchestration and deployment paths.',
      state: experiments.length ? 'complete' : 'next',
      value: `${experiments.length} experiments registered`,
      href: buildWorkspaceHref('/flow', projectNavigationContext),
    },
    {
      key: 'ml',
      label: 'ML',
      description: 'Track experiments, async runs, and serving endpoints from one project surface.',
      state: 'current',
      value: `${modelServing.length} endpoints active`,
      href: buildWorkspaceHref('/ml', projectNavigationContext),
    },
    {
      key: 'runtime',
      label: 'Runtime',
      description: 'Inspect queued jobs and rollout state once experiment work leaves this page.',
      state: activeExperimentJobCount || activeJob ? 'next' : 'upcoming',
      value: `${jobs.length} runtime jobs visible`,
      href: '/runtime',
    },
  ];

  return (
    <PlatformShell
      eyebrow="ML Studio"
      title="ML lifecycle and serving"
      description="Experiments and serving endpoints have their own workspace now, and experiment runs execute through the shared async job queue."
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
      actions={feedback ? <div className="rounded-2xl border border-stone-200 bg-white/80 px-4 py-3 text-sm text-slate-600">{feedback}</div> : null}
    >
      <WorkflowGuide
        currentStep="ml"
        steps={mlGuideSteps}
        primaryAction={{ label: 'Open Runtime Ops', href: '/runtime' }}
        secondaryAction={{ label: 'Open Flow Builder', href: buildWorkspaceHref('/flow', projectNavigationContext), tone: 'secondary' }}
        title="Use ML Studio as the experiment and serving branch of the main delivery flow"
        description="ML work should not feel detached from notebooks, flows, and runtime. This workspace now shows where experiment creation, run tracking, and serving registration fit in the broader product path."
      />

      <PlatformPanel title="ML snapshot" description="Experiment creation, run history, serving registration, and background job progress are visible before the user drills into any single panel.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricTile label="Experiments" value={experiments.length} detail="Tracked evaluation or training definitions in the active project." />
          <MetricTile label="Runs" value={runs.length} detail="Recorded experiment runs for the selected experiment." />
          <MetricTile label="Endpoints" value={modelServing.length} detail="Registered serving endpoints under active lifecycle control." />
          <MetricTile label="Active Jobs" value={activeExperimentJobCount} detail="Background experiment jobs still moving through the async queue." />
        </div>
      </PlatformPanel>

      <PlatformPanel title="Experiments" description="Create experiments separately from operational scenario work, then queue experiment runs and watch them complete.">
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <div className="space-y-4 rounded-3xl border border-stone-200/80 bg-white/82 p-5 shadow-[0_18px_44px_rgba(148,163,184,0.12)]">
            <div className="text-lg font-semibold text-slate-900">Create experiment</div>
            <input
              value={forms.experimentName}
              onChange={(event) => setForms((current) => ({ ...current, experimentName: event.target.value }))}
              placeholder="Migration quality benchmark"
              className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-slate-700 outline-none"
            />
            <select
              value={forms.experimentProjectId}
              onChange={(event) => setForms((current) => ({ ...current, experimentProjectId: event.target.value }))}
              className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-slate-700 outline-none"
            >
              <option value="">No project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
            <textarea
              rows={3}
              value={forms.experimentDescription}
              onChange={(event) => setForms((current) => ({ ...current, experimentDescription: event.target.value }))}
              placeholder="Track conversion quality and runtime latency across targets."
              className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-slate-700 outline-none"
            />
            <button
              onClick={async () => {
                setBusyKey('experiment');
                try {
                  await createExperiment({
                    name: forms.experimentName,
                    description: forms.experimentDescription,
                    project_id: forms.experimentProjectId || undefined,
                  });
                  setForms((current) => ({ ...current, experimentName: '', experimentDescription: '' }));
                  setFeedback('Experiment created.');
                  await loadML();
                } catch (error) {
                  setFeedback(toErrorMessage(error));
                } finally {
                  setBusyKey('');
                }
              }}
              disabled={busyKey === 'experiment' || !forms.experimentName.trim()}
              className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busyKey === 'experiment' ? 'Creating...' : 'Create experiment'}
            </button>
          </div>

          <div className="space-y-4 rounded-3xl border border-stone-200/80 bg-white/82 p-5 shadow-[0_18px_44px_rgba(148,163,184,0.12)]">
            <div className="text-lg font-semibold text-slate-900">Queue experiment run</div>
            <select
              value={selectedExperimentId}
              onChange={(event) => setSelectedExperimentId(event.target.value)}
              className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-slate-700 outline-none"
            >
              <option value="">Select experiment</option>
              {experiments.map((experiment) => (
                <option key={experiment.id} value={experiment.id}>{experiment.name}</option>
              ))}
            </select>
            {!experiments.length ? (
              <EmptyState
                title="No experiments available yet"
                message="Create an experiment in the left panel before queueing a run."
                detail="The run panel becomes actionable as soon as the project has at least one experiment definition."
              />
            ) : null}
            <select
              value={forms.runStatus}
              onChange={(event) => setForms((current) => ({ ...current, runStatus: event.target.value }))}
              className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-slate-700 outline-none"
            >
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
            <textarea
              rows={4}
              value={forms.runMetrics}
              onChange={(event) => setForms((current) => ({ ...current, runMetrics: event.target.value }))}
              className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 font-mono text-sm text-slate-700 outline-none"
            />
            <button
              onClick={async () => {
                setBusyKey('run');
                try {
                  const payload = await createExperimentRun(selectedExperimentId, {
                    status: forms.runStatus,
                    metrics: parseJsonInput(forms.runMetrics),
                    artifacts: { report: 's3://tenant/reports/experiment.json' },
                  });
                  setActiveJob(payload.job);
                  setFeedback('Experiment run queued. Polling job status.');
                  await loadRuns(selectedExperimentId);
                  await loadML();
                } catch (error) {
                  setFeedback(toErrorMessage(error));
                } finally {
                  setBusyKey('');
                }
              }}
              disabled={busyKey === 'run' || !selectedExperimentId}
              className="rounded-2xl border border-sky-200 bg-sky-50 px-5 py-3 text-sm font-semibold text-sky-700 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busyKey === 'run' ? 'Queueing...' : 'Queue run'}
            </button>
            {activeJob ? (
              <div className="rounded-2xl border border-stone-200 bg-stone-50/80 px-4 py-3 text-sm text-slate-600">
                <div className="flex items-center justify-between gap-3">
                  <div>Job {activeJob.id}</div>
                  <StatusPill status={activeJob.status} />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </PlatformPanel>

      <PlatformPanel title="Experiment history and serving endpoints" description="Serving registration stays here with experiment tracking so model lifecycle work has a dedicated surface.">
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-4 rounded-3xl border border-stone-200/80 bg-white/82 p-5 shadow-[0_18px_44px_rgba(148,163,184,0.12)]">
            <div className="text-lg font-semibold text-slate-900">Experiment runs</div>
            {runs.length ? (
              runs.map((run) => (
                <div key={run.id} className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm text-slate-900">{run.id}</div>
                    <StatusPill status={run.status} />
                  </div>
                  <pre className="mt-3 overflow-auto rounded-2xl border border-stone-200 bg-white p-3 text-xs text-slate-600">{JSON.stringify(run.metrics || {}, null, 2)}</pre>
                </div>
              ))
            ) : (
              <EmptyState
                title="No experiment runs yet"
                message="The selected experiment has no recorded runs yet."
                detail="Queue a run from the upper panel to generate metrics and background job activity for this workspace."
              />
            )}

            <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4">
              <div className="text-sm font-semibold text-slate-900">Recent experiment jobs</div>
              <div className="mt-3 space-y-2">
                {jobs.length ? (
                  jobs.slice(0, 4).map((job) => (
                    <div key={job.id} className="flex items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white px-3 py-2">
                      <div className="text-xs text-slate-600">{job.resource_id || job.id}</div>
                      <StatusPill status={job.status} />
                    </div>
                  ))
                ) : (
                  <EmptyState
                    title="No experiment jobs yet"
                    message="Background experiment work has not been queued from this project yet."
                    detail="Once a run is queued, the job queue and status updates appear here automatically."
                  />
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-3xl border border-stone-200/80 bg-white/82 p-5 shadow-[0_18px_44px_rgba(148,163,184,0.12)]">
            <div className="text-lg font-semibold text-slate-900">Register serving endpoint</div>
            <input
              value={forms.modelVersionId}
              onChange={(event) => setForms((current) => ({ ...current, modelVersionId: event.target.value }))}
              placeholder="model-version-001"
              className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-slate-700 outline-none"
            />
            <input
              value={forms.endpointUrl}
              onChange={(event) => setForms((current) => ({ ...current, endpointUrl: event.target.value }))}
              className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-slate-700 outline-none"
            />
            <select
              value={forms.servingStatus}
              onChange={(event) => setForms((current) => ({ ...current, servingStatus: event.target.value }))}
              className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-slate-700 outline-none"
            >
              <option value="active">Active</option>
              <option value="canary">Canary</option>
              <option value="paused">Paused</option>
            </select>
            <button
              onClick={async () => {
                setBusyKey('serving');
                try {
                  await registerModelServing({
                    model_version_id: forms.modelVersionId,
                    endpoint_url: forms.endpointUrl,
                    status: forms.servingStatus,
                    metadata: { owner: 'ml-page' },
                  });
                  setFeedback('Serving endpoint registered.');
                  await loadML();
                } catch (error) {
                  setFeedback(toErrorMessage(error));
                } finally {
                  setBusyKey('');
                }
              }}
              disabled={busyKey === 'serving' || !forms.modelVersionId || !forms.endpointUrl}
              className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busyKey === 'serving' ? 'Registering...' : 'Register endpoint'}
            </button>

            <div className="space-y-3">
              {modelServing.length ? (
                modelServing.map((endpoint) => (
                  <div key={endpoint.id} className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm text-slate-900">{endpoint.endpoint_url}</div>
                      <StatusPill status={endpoint.status} />
                    </div>
                    <div className="mt-2 text-xs text-slate-500">Model version {endpoint.model_version_id}</div>
                  </div>
                ))
              ) : (
                <EmptyState
                  title="No serving endpoints yet"
                  message="This project has not registered a serving endpoint yet."
                  detail="Use the form above to connect a model version to an inference URL and bring serving under lifecycle control."
                />
              )}
            </div>
          </div>
        </div>
      </PlatformPanel>
    </PlatformShell>
  );
}