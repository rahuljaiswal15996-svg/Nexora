import { useEffect, useMemo, useState } from 'react';

import PlatformShell, { EmptyState, PlatformPanel, StatusPill } from '../components/PlatformShell';
import { extractItems, isJobActive, toErrorMessage } from '../lib/platform';
import {
  compareScenarioVersions,
  createDeployTarget,
  createScenario,
  createScenarioVersion,
  deployPipelineAsset,
  getJob,
  getScenario,
  listDeployTargets,
  listDeployments,
  listJobs,
  listScenarios,
} from '../services/api';

function parseJsonInput(value, fallback = {}) {
  if (!value.trim()) {
    return fallback;
  }
  return JSON.parse(value);
}

export default function OperationsPage() {
  const [scenarios, setScenarios] = useState([]);
  const [targets, setTargets] = useState([]);
  const [deployments, setDeployments] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [comparison, setComparison] = useState(null);
  const [activeJob, setActiveJob] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [forms, setForms] = useState({
    scenarioName: '',
    scenarioDescription: '',
    versionScenarioId: '',
    versionTag: 'v1',
    versionCode: 'SELECT customer_id, COUNT(*) AS order_count FROM orders GROUP BY customer_id;',
    compareA: '',
    compareB: '',
    targetName: '',
    targetPlatform: 'databricks',
    targetConfig: '{"workspace_url": "https://workspace.cloud.databricks.com"}',
    pipelineId: '',
    deploymentTargetId: '',
    deploymentPlatform: 'container',
    deploymentNotes: 'Promote candidate runtime configuration',
    deploymentCost: '42.5',
  });

  async function loadOperations() {
    try {
      const [scenarioPayload, targetPayload, deploymentPayload, jobPayload] = await Promise.all([
        listScenarios(),
        listDeployTargets(),
        listDeployments(),
        listJobs(undefined, 'deployment'),
      ]);
      const scenarioItems = extractItems(scenarioPayload);
      const detailedScenarios = await Promise.all(
        scenarioItems.map(async (scenario) => getScenario(scenario.id).catch(() => scenario)),
      );
      const targetItems = extractItems(targetPayload);
      setScenarios(detailedScenarios);
      setTargets(targetItems);
      setDeployments(extractItems(deploymentPayload));
      setJobs(extractItems(jobPayload));
      setForms((current) => ({
        ...current,
        versionScenarioId: current.versionScenarioId || detailedScenarios[0]?.id || '',
        deploymentTargetId: current.deploymentTargetId || targetItems[0]?.id || '',
      }));
      setFeedback('');
    } catch (error) {
      setFeedback(toErrorMessage(error));
    }
  }

  useEffect(() => {
    loadOperations();
  }, []);

  useEffect(() => {
    if (!activeJob || !isJobActive(activeJob)) {
      return undefined;
    }
    const handle = window.setInterval(async () => {
      try {
        const nextJob = await getJob(activeJob.id);
        setActiveJob(nextJob);
        if (!isJobActive(nextJob)) {
          await loadOperations();
        }
      } catch (error) {
        setFeedback(toErrorMessage(error));
      }
    }, 2500);
    return () => window.clearInterval(handle);
  }, [activeJob]);

  const versionOptions = useMemo(
    () => scenarios.flatMap((scenario) => (scenario.versions || []).map((version) => ({ id: version.id, label: `${scenario.name} / ${version.version}` }))),
    [scenarios],
  );

  useEffect(() => {
    setForms((current) => ({
      ...current,
      compareA: current.compareA || versionOptions[0]?.id || '',
      compareB: current.compareB || versionOptions[1]?.id || '',
    }));
  }, [versionOptions]);

  return (
    <PlatformShell
      title="Operations and release flow"
      description="Own the migration decision path here: scenario variants, deployment targets, queued promotions, and live deployment job polling."
      actions={feedback ? <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-accent/75">{feedback}</div> : null}
    >
      <PlatformPanel title="Scenario lab" description="Capture alternatives before promotion, then compare versions directly from the split operations workspace.">
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <div className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="text-lg font-semibold text-white">Create scenario</div>
            <input
              value={forms.scenarioName}
              onChange={(event) => setForms((current) => ({ ...current, scenarioName: event.target.value }))}
              placeholder="Customer aggregation migration"
              className="w-full rounded-2xl border border-white/10 bg-background/70 px-4 py-3 text-white outline-none"
            />
            <textarea
              rows={3}
              value={forms.scenarioDescription}
              onChange={(event) => setForms((current) => ({ ...current, scenarioDescription: event.target.value }))}
              placeholder="Compare SQL and PySpark conversion targets for the same business logic."
              className="w-full rounded-2xl border border-white/10 bg-background/70 px-4 py-3 text-white outline-none"
            />
            <button
              onClick={async () => {
                setBusyKey('scenario');
                try {
                  await createScenario({ name: forms.scenarioName, description: forms.scenarioDescription });
                  setForms((current) => ({ ...current, scenarioName: '', scenarioDescription: '' }));
                  setFeedback('Scenario created.');
                  await loadOperations();
                } catch (error) {
                  setFeedback(toErrorMessage(error));
                } finally {
                  setBusyKey('');
                }
              }}
              disabled={busyKey === 'scenario' || !forms.scenarioName.trim()}
              className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busyKey === 'scenario' ? 'Creating...' : 'Create scenario'}
            </button>
          </div>

          <div className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="text-lg font-semibold text-white">Version snapshot</div>
            <select
              value={forms.versionScenarioId}
              onChange={(event) => setForms((current) => ({ ...current, versionScenarioId: event.target.value }))}
              className="w-full rounded-2xl border border-white/10 bg-background/70 px-4 py-3 text-white outline-none"
            >
              <option value="">Select scenario</option>
              {scenarios.map((scenario) => (
                <option key={scenario.id} value={scenario.id}>{scenario.name}</option>
              ))}
            </select>
            <input
              value={forms.versionTag}
              onChange={(event) => setForms((current) => ({ ...current, versionTag: event.target.value }))}
              className="w-full rounded-2xl border border-white/10 bg-background/70 px-4 py-3 text-white outline-none"
            />
            <textarea
              rows={5}
              value={forms.versionCode}
              onChange={(event) => setForms((current) => ({ ...current, versionCode: event.target.value }))}
              className="w-full rounded-2xl border border-white/10 bg-background/70 px-4 py-3 font-mono text-sm text-white outline-none"
            />
            <button
              onClick={async () => {
                setBusyKey('version');
                try {
                  await createScenarioVersion(forms.versionScenarioId, {
                    version: forms.versionTag,
                    converted_code: forms.versionCode,
                    metadata: { source: 'operations-page' },
                  });
                  setFeedback('Scenario version saved.');
                  await loadOperations();
                } catch (error) {
                  setFeedback(toErrorMessage(error));
                } finally {
                  setBusyKey('');
                }
              }}
              disabled={busyKey === 'version' || !forms.versionScenarioId}
              className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busyKey === 'version' ? 'Saving...' : 'Save version'}
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="text-lg font-semibold text-white">Compare versions</div>
          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
            <select
              value={forms.compareA}
              onChange={(event) => setForms((current) => ({ ...current, compareA: event.target.value }))}
              className="rounded-2xl border border-white/10 bg-background/70 px-4 py-3 text-white outline-none"
            >
              <option value="">Select version A</option>
              {versionOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
            <select
              value={forms.compareB}
              onChange={(event) => setForms((current) => ({ ...current, compareB: event.target.value }))}
              className="rounded-2xl border border-white/10 bg-background/70 px-4 py-3 text-white outline-none"
            >
              <option value="">Select version B</option>
              {versionOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
            <button
              onClick={async () => {
                setBusyKey('compare');
                try {
                  const payload = await compareScenarioVersions(forms.compareA, forms.compareB);
                  setComparison(payload);
                  setFeedback('Scenario comparison refreshed.');
                } catch (error) {
                  setFeedback(toErrorMessage(error));
                } finally {
                  setBusyKey('');
                }
              }}
              disabled={busyKey === 'compare' || !forms.compareA || !forms.compareB}
              className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-5 py-3 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-300/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busyKey === 'compare' ? 'Comparing...' : 'Compare'}
            </button>
          </div>
          {comparison ? (
            <pre className="mt-4 overflow-auto rounded-2xl bg-black/20 p-4 text-xs text-accent/70">{JSON.stringify(comparison.comparison, null, 2)}</pre>
          ) : null}
        </div>
      </PlatformPanel>

      <PlatformPanel title="Deployments and queue" description="Deployments now queue in background jobs and update status over time instead of returning as completed immediately.">
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <div className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="text-lg font-semibold text-white">Create deployment target</div>
            <input
              value={forms.targetName}
              onChange={(event) => setForms((current) => ({ ...current, targetName: event.target.value }))}
              placeholder="Databricks Prod"
              className="w-full rounded-2xl border border-white/10 bg-background/70 px-4 py-3 text-white outline-none"
            />
            <select
              value={forms.targetPlatform}
              onChange={(event) => setForms((current) => ({ ...current, targetPlatform: event.target.value }))}
              className="w-full rounded-2xl border border-white/10 bg-background/70 px-4 py-3 text-white outline-none"
            >
              <option value="databricks">Databricks</option>
              <option value="container">Container</option>
              <option value="spark">Spark</option>
              <option value="dbt">dbt</option>
            </select>
            <textarea
              rows={3}
              value={forms.targetConfig}
              onChange={(event) => setForms((current) => ({ ...current, targetConfig: event.target.value }))}
              className="w-full rounded-2xl border border-white/10 bg-background/70 px-4 py-3 font-mono text-sm text-white outline-none"
            />
            <button
              onClick={async () => {
                setBusyKey('target');
                try {
                  await createDeployTarget({
                    name: forms.targetName,
                    platform_type: forms.targetPlatform,
                    endpoint_config: parseJsonInput(forms.targetConfig),
                  });
                  setForms((current) => ({ ...current, targetName: '' }));
                  setFeedback('Deployment target created.');
                  await loadOperations();
                } catch (error) {
                  setFeedback(toErrorMessage(error));
                } finally {
                  setBusyKey('');
                }
              }}
              disabled={busyKey === 'target' || !forms.targetName.trim()}
              className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busyKey === 'target' ? 'Creating...' : 'Create target'}
            </button>
          </div>

          <div className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="text-lg font-semibold text-white">Queue deployment</div>
            <input
              value={forms.pipelineId}
              onChange={(event) => setForms((current) => ({ ...current, pipelineId: event.target.value }))}
              placeholder="pipeline-001"
              className="w-full rounded-2xl border border-white/10 bg-background/70 px-4 py-3 text-white outline-none"
            />
            <div className="grid gap-4 md:grid-cols-2">
              <select
                value={forms.deploymentTargetId}
                onChange={(event) => setForms((current) => ({ ...current, deploymentTargetId: event.target.value }))}
                className="rounded-2xl border border-white/10 bg-background/70 px-4 py-3 text-white outline-none"
              >
                <option value="">Select target</option>
                {targets.map((target) => (
                  <option key={target.id} value={target.id}>{target.name}</option>
                ))}
              </select>
              <select
                value={forms.deploymentPlatform}
                onChange={(event) => setForms((current) => ({ ...current, deploymentPlatform: event.target.value }))}
                className="rounded-2xl border border-white/10 bg-background/70 px-4 py-3 text-white outline-none"
              >
                <option value="container">Container</option>
                <option value="spark">Spark</option>
                <option value="databricks">Databricks</option>
                <option value="dbt">dbt</option>
              </select>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <input
                value={forms.deploymentCost}
                onChange={(event) => setForms((current) => ({ ...current, deploymentCost: event.target.value }))}
                placeholder="42.5"
                className="rounded-2xl border border-white/10 bg-background/70 px-4 py-3 text-white outline-none"
              />
              <input
                value={forms.deploymentNotes}
                onChange={(event) => setForms((current) => ({ ...current, deploymentNotes: event.target.value }))}
                className="rounded-2xl border border-white/10 bg-background/70 px-4 py-3 text-white outline-none"
              />
            </div>
            <button
              onClick={async () => {
                setBusyKey('deploy');
                try {
                  const payload = await deployPipelineAsset({
                    pipeline_id: forms.pipelineId,
                    target_id: forms.deploymentTargetId || undefined,
                    target_platform: forms.deploymentPlatform,
                    estimated_cost: Number(forms.deploymentCost || 0),
                    notes: forms.deploymentNotes,
                    target_config: { triggered_from: 'operations-page' },
                  });
                  setActiveJob(payload.job);
                  setFeedback('Deployment queued. Polling job status.');
                  await loadOperations();
                } catch (error) {
                  setFeedback(toErrorMessage(error));
                } finally {
                  setBusyKey('');
                }
              }}
              disabled={busyKey === 'deploy' || !forms.pipelineId.trim()}
              className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-5 py-3 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-300/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busyKey === 'deploy' ? 'Queueing...' : 'Queue deployment'}
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

        <div className="mt-6 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="text-lg font-semibold text-white">Recent deployment jobs</div>
            <div className="mt-4 space-y-3">
              {jobs.length ? (
                jobs.slice(0, 5).map((job) => (
                  <div key={job.id} className="rounded-2xl border border-white/10 bg-black/10 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm text-white">{job.resource_id || job.id}</div>
                      <StatusPill status={job.status} />
                    </div>
                    <div className="mt-2 text-xs text-accent/55">{job.created_at}</div>
                  </div>
                ))
              ) : (
                <EmptyState message="No deployment jobs yet." />
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="text-lg font-semibold text-white">Recent deployments</div>
            <div className="mt-4 space-y-3">
              {deployments.length ? (
                deployments.slice(0, 6).map((deployment) => (
                  <div key={deployment.id} className="rounded-2xl border border-white/10 bg-black/10 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm text-white">Pipeline {deployment.pipeline_id}</div>
                        <div className="mt-1 text-xs uppercase tracking-[0.2em] text-accent/45">{deployment.target_platform}</div>
                      </div>
                      <StatusPill status={deployment.status} />
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState message="No deployments recorded yet." />
              )}
            </div>
          </div>
        </div>
      </PlatformPanel>
    </PlatformShell>
  );
}