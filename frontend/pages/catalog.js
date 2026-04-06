import { useEffect, useMemo, useState } from 'react';

import PlatformShell, { EmptyState, PlatformPanel, StatusPill } from '../components/PlatformShell';
import { extractItems, isJobActive, toErrorMessage } from '../lib/platform';
import { addDatasetQualityCheck, getDatasetQuality, getJob, listCatalogDatasets, listProjects, registerDataset } from '../services/api';

function parseMetrics(value) {
  if (!value.trim()) {
    return {};
  }
  return JSON.parse(value);
}

export default function CatalogPage() {
  const [projects, setProjects] = useState([]);
  const [datasets, setDatasets] = useState([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState('');
  const [qualityChecks, setQualityChecks] = useState([]);
  const [activeJob, setActiveJob] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [datasetForm, setDatasetForm] = useState({
    name: '',
    sourcePath: '',
    projectId: '',
    tags: 'gold, migration',
  });
  const [qualityForm, setQualityForm] = useState({
    checkName: 'row_count',
    finalStatus: 'passed',
    metrics: '{"row_count": 18231}',
  });

  async function loadCatalog() {
    try {
      const [projectPayload, datasetPayload] = await Promise.all([listProjects(), listCatalogDatasets()]);
      const nextProjects = extractItems(projectPayload);
      const nextDatasets = extractItems(datasetPayload);
      setProjects(nextProjects);
      setDatasets(nextDatasets);
      if (!datasetForm.projectId && nextProjects[0]?.id) {
        setDatasetForm((current) => ({ ...current, projectId: nextProjects[0].id }));
      }
      if (!selectedDatasetId && nextDatasets[0]?.id) {
        setSelectedDatasetId(nextDatasets[0].id);
      }
      setFeedback('');
    } catch (error) {
      setFeedback(toErrorMessage(error));
    }
  }

  async function loadQualityChecks(datasetId) {
    if (!datasetId) {
      setQualityChecks([]);
      return;
    }
    try {
      const payload = await getDatasetQuality(datasetId);
      setQualityChecks(extractItems(payload));
    } catch (error) {
      setFeedback(toErrorMessage(error));
    }
  }

  useEffect(() => {
    loadCatalog();
  }, []);

  useEffect(() => {
    loadQualityChecks(selectedDatasetId);
  }, [selectedDatasetId]);

  useEffect(() => {
    if (!activeJob || !isJobActive(activeJob)) {
      return undefined;
    }
    const handle = window.setInterval(async () => {
      try {
        const nextJob = await getJob(activeJob.id);
        setActiveJob(nextJob);
        if (!isJobActive(nextJob)) {
          await loadCatalog();
          await loadQualityChecks(selectedDatasetId || nextJob.resource_id);
        }
      } catch (error) {
        setFeedback(toErrorMessage(error));
      }
    }, 2500);
    return () => window.clearInterval(handle);
  }, [activeJob, selectedDatasetId]);

  const selectedDataset = useMemo(
    () => datasets.find((dataset) => dataset.id === selectedDatasetId) || null,
    [datasets, selectedDatasetId],
  );

  return (
    <PlatformShell
      title="Catalog and quality operations"
      description="Register datasets into the tenant catalog, then queue background quality checks and poll them to completion."
      actions={feedback ? <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-accent/75">{feedback}</div> : null}
    >
      <PlatformPanel title="Register dataset" description="The catalog page focuses on data assets and their health signals, separate from portfolio and governance views.">
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_auto]">
          <input
            value={datasetForm.name}
            onChange={(event) => setDatasetForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="orders_curated"
            className="rounded-2xl border border-white/10 bg-background/70 px-4 py-3 text-white outline-none"
          />
          <input
            value={datasetForm.sourcePath}
            onChange={(event) => setDatasetForm((current) => ({ ...current, sourcePath: event.target.value }))}
            placeholder="s3://tenant/orders/curated.parquet"
            className="rounded-2xl border border-white/10 bg-background/70 px-4 py-3 text-white outline-none"
          />
          <select
            value={datasetForm.projectId}
            onChange={(event) => setDatasetForm((current) => ({ ...current, projectId: event.target.value }))}
            className="rounded-2xl border border-white/10 bg-background/70 px-4 py-3 text-white outline-none"
          >
            <option value="">No project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>
          <button
            onClick={async () => {
              setBusyKey('dataset');
              try {
                await registerDataset({
                  name: datasetForm.name,
                  source_path: datasetForm.sourcePath,
                  project_id: datasetForm.projectId || undefined,
                  tags: datasetForm.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
                  schema: [
                    { name: 'customer_id', type: 'string' },
                    { name: 'order_total', type: 'double' },
                  ],
                  metadata: { owner: 'catalog-page', domain: 'migration' },
                  quality_score: 0.94,
                });
                setDatasetForm((current) => ({ ...current, name: '', sourcePath: '' }));
                setFeedback('Dataset registered.');
                await loadCatalog();
              } catch (error) {
                setFeedback(toErrorMessage(error));
              } finally {
                setBusyKey('');
              }
            }}
            disabled={busyKey === 'dataset' || !datasetForm.name.trim() || !datasetForm.sourcePath.trim()}
            className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busyKey === 'dataset' ? 'Registering...' : 'Register'}
          </button>
        </div>
      </PlatformPanel>

      <PlatformPanel title="Queue a quality check" description="Quality checks now run through the background job queue instead of completing synchronously in the request.">
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_auto]">
          <select
            value={selectedDatasetId}
            onChange={(event) => setSelectedDatasetId(event.target.value)}
            className="rounded-2xl border border-white/10 bg-background/70 px-4 py-3 text-white outline-none"
          >
            <option value="">Select dataset</option>
            {datasets.map((dataset) => (
              <option key={dataset.id} value={dataset.id}>{dataset.name}</option>
            ))}
          </select>
          <input
            value={qualityForm.checkName}
            onChange={(event) => setQualityForm((current) => ({ ...current, checkName: event.target.value }))}
            className="rounded-2xl border border-white/10 bg-background/70 px-4 py-3 text-white outline-none"
          />
          <select
            value={qualityForm.finalStatus}
            onChange={(event) => setQualityForm((current) => ({ ...current, finalStatus: event.target.value }))}
            className="rounded-2xl border border-white/10 bg-background/70 px-4 py-3 text-white outline-none"
          >
            <option value="passed">Passed</option>
            <option value="failed">Failed</option>
          </select>
          <button
            onClick={async () => {
              setBusyKey('quality');
              try {
                const payload = await addDatasetQualityCheck(selectedDatasetId, {
                  check_name: qualityForm.checkName,
                  status: qualityForm.finalStatus,
                  metrics: parseMetrics(qualityForm.metrics),
                });
                setActiveJob(payload.job);
                setFeedback('Quality check queued. Polling job status.');
                await loadQualityChecks(selectedDatasetId);
              } catch (error) {
                setFeedback(toErrorMessage(error));
              } finally {
                setBusyKey('');
              }
            }}
            disabled={busyKey === 'quality' || !selectedDatasetId}
            className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busyKey === 'quality' ? 'Queueing...' : 'Queue check'}
          </button>
        </div>
        <textarea
          rows={3}
          value={qualityForm.metrics}
          onChange={(event) => setQualityForm((current) => ({ ...current, metrics: event.target.value }))}
          className="mt-4 w-full rounded-2xl border border-white/10 bg-background/70 px-4 py-3 font-mono text-sm text-white outline-none"
        />
        {activeJob ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-accent/75">
            <div className="flex items-center justify-between gap-3">
              <div>Job {activeJob.id}</div>
              <StatusPill status={activeJob.status} />
            </div>
          </div>
        ) : null}
      </PlatformPanel>

      <PlatformPanel title="Dataset inventory" description="Pick a dataset to inspect the latest quality history returned by the backend platform tables.">
        {datasets.length ? (
          <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="space-y-3">
              {datasets.map((dataset) => (
                <button
                  key={dataset.id}
                  onClick={() => setSelectedDatasetId(dataset.id)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    dataset.id === selectedDatasetId ? 'border-cyan-300/25 bg-cyan-300/10' : 'border-white/10 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <div className="text-sm font-semibold text-white">{dataset.name}</div>
                  <div className="mt-1 break-all text-xs text-accent/55">{dataset.source_path}</div>
                </button>
              ))}
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="text-lg font-semibold text-white">{selectedDataset?.name || 'Select a dataset'}</div>
              <div className="mt-2 text-sm text-accent/65">{selectedDataset?.source_path || 'Quality results will appear here.'}</div>
              <div className="mt-4 space-y-3">
                {qualityChecks.length ? (
                  qualityChecks.map((check) => (
                    <div key={check.id} className="rounded-2xl border border-white/10 bg-black/10 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm text-white">{check.check_name}</div>
                        <StatusPill status={check.status} />
                      </div>
                      <pre className="mt-3 overflow-auto rounded-2xl bg-black/20 p-3 text-xs text-accent/65">{JSON.stringify(check.metrics || {}, null, 2)}</pre>
                    </div>
                  ))
                ) : (
                  <EmptyState message="No quality checks recorded yet for the selected dataset." />
                )}
              </div>
            </div>
          </div>
        ) : (
          <EmptyState message="No datasets registered yet. Add a dataset above to start catalog and quality workflows." />
        )}
      </PlatformPanel>
    </PlatformShell>
  );
}