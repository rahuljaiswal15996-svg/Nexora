import { useEffect, useState } from 'react';

import PlatformShell, { EmptyState, PlatformPanel, StatusPill } from '../components/PlatformShell';
import { extractItems, isJobActive, toErrorMessage } from '../lib/platform';
import {
  createExperiment,
  createExperimentRun,
  getJob,
  listExperimentRuns,
  listExperiments,
  listJobs,
  listModelServing,
  listProjects,
  registerModelServing,
} from '../services/api';

function parseJsonInput(value, fallback = {}) {
  if (!value.trim()) {
    return fallback;
  }
  return JSON.parse(value);
}

export default function MLPage() {
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
      const [projectPayload, experimentPayload, jobPayload, servingPayload] = await Promise.all([
        listProjects(),
        listExperiments(),
        listJobs(undefined, 'experiment_run'),
        listModelServing(),
      ]);
      const projectItems = extractItems(projectPayload);
      const experimentItems = extractItems(experimentPayload);
      setProjects(projectItems);
      setExperiments(experimentItems);
      setJobs(extractItems(jobPayload));
      setModelServing(extractItems(servingPayload));
      setSelectedExperimentId((current) => current || experimentItems[0]?.id || '');
      setForms((current) => ({ ...current, experimentProjectId: current.experimentProjectId || projectItems[0]?.id || '' }));
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
    loadML();
  }, []);

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

  return (
    <PlatformShell
      title="ML lifecycle and serving"
      description="Experiments and serving endpoints have their own workspace now, and experiment runs execute through the shared async job queue."
      actions={feedback ? <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-accent/75">{feedback}</div> : null}
    >
      <PlatformPanel title="Experiments" description="Create experiments separately from operational scenario work, then queue experiment runs and watch them complete.">
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <div className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="text-lg font-semibold text-white">Create experiment</div>
            <input
              value={forms.experimentName}
              onChange={(event) => setForms((current) => ({ ...current, experimentName: event.target.value }))}
              placeholder="Migration quality benchmark"
              className="w-full rounded-2xl border border-white/10 bg-background/70 px-4 py-3 text-white outline-none"
            />
            <select
              value={forms.experimentProjectId}
              onChange={(event) => setForms((current) => ({ ...current, experimentProjectId: event.target.value }))}
              className="w-full rounded-2xl border border-white/10 bg-background/70 px-4 py-3 text-white outline-none"
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
              className="w-full rounded-2xl border border-white/10 bg-background/70 px-4 py-3 text-white outline-none"
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

          <div className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="text-lg font-semibold text-white">Queue experiment run</div>
            <select
              value={selectedExperimentId}
              onChange={(event) => setSelectedExperimentId(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-background/70 px-4 py-3 text-white outline-none"
            >
              <option value="">Select experiment</option>
              {experiments.map((experiment) => (
                <option key={experiment.id} value={experiment.id}>{experiment.name}</option>
              ))}
            </select>
            <select
              value={forms.runStatus}
              onChange={(event) => setForms((current) => ({ ...current, runStatus: event.target.value }))}
              className="w-full rounded-2xl border border-white/10 bg-background/70 px-4 py-3 text-white outline-none"
            >
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
            <textarea
              rows={4}
              value={forms.runMetrics}
              onChange={(event) => setForms((current) => ({ ...current, runMetrics: event.target.value }))}
              className="w-full rounded-2xl border border-white/10 bg-background/70 px-4 py-3 font-mono text-sm text-white outline-none"
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
              className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-5 py-3 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-300/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busyKey === 'run' ? 'Queueing...' : 'Queue run'}
            </button>
            {activeJob ? (
              <div className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-accent/75">
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
          <div className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="text-lg font-semibold text-white">Experiment runs</div>
            {runs.length ? (
              runs.map((run) => (
                <div key={run.id} className="rounded-2xl border border-white/10 bg-black/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm text-white">{run.id}</div>
                    <StatusPill status={run.status} />
                  </div>
                  <pre className="mt-3 overflow-auto rounded-2xl bg-black/20 p-3 text-xs text-accent/65">{JSON.stringify(run.metrics || {}, null, 2)}</pre>
                </div>
              ))
            ) : (
              <EmptyState message="No experiment runs yet for the selected experiment." />
            )}

            <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
              <div className="text-sm font-semibold text-white">Recent experiment jobs</div>
              <div className="mt-3 space-y-2">
                {jobs.length ? (
                  jobs.slice(0, 4).map((job) => (
                    <div key={job.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                      <div className="text-xs text-accent/70">{job.resource_id || job.id}</div>
                      <StatusPill status={job.status} />
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-accent/55">No experiment jobs yet.</div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="text-lg font-semibold text-white">Register serving endpoint</div>
            <input
              value={forms.modelVersionId}
              onChange={(event) => setForms((current) => ({ ...current, modelVersionId: event.target.value }))}
              placeholder="model-version-001"
              className="w-full rounded-2xl border border-white/10 bg-background/70 px-4 py-3 text-white outline-none"
            />
            <input
              value={forms.endpointUrl}
              onChange={(event) => setForms((current) => ({ ...current, endpointUrl: event.target.value }))}
              className="w-full rounded-2xl border border-white/10 bg-background/70 px-4 py-3 text-white outline-none"
            />
            <select
              value={forms.servingStatus}
              onChange={(event) => setForms((current) => ({ ...current, servingStatus: event.target.value }))}
              className="w-full rounded-2xl border border-white/10 bg-background/70 px-4 py-3 text-white outline-none"
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
                  <div key={endpoint.id} className="rounded-2xl border border-white/10 bg-black/10 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm text-white">{endpoint.endpoint_url}</div>
                      <StatusPill status={endpoint.status} />
                    </div>
                    <div className="mt-2 text-xs text-accent/55">Model version {endpoint.model_version_id}</div>
                  </div>
                ))
              ) : (
                <EmptyState message="No serving endpoints yet." />
              )}
            </div>
          </div>
        </div>
      </PlatformPanel>
    </PlatformShell>
  );
}