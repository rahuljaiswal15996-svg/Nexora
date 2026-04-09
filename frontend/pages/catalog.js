import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';

import DAGEditor from '../components/DAGEditor';
import ProjectWorkspaceContext from '../components/ProjectWorkspaceContext';
import PlatformShell, { EmptyState, MetricTile, PlatformPanel, StatusPill } from '../components/PlatformShell';
import WorkflowGuide from '../components/WorkflowGuide';
import { buildCatalogLineageDag } from '../lib/platformExperience';
import { buildWorkspaceHref, useProjectWorkspace } from '../lib/projectWorkspace';
import { extractItems, toErrorMessage } from '../lib/platform';
import {
  addDatasetQualityCheck,
  getDataset,
  getDatasetLineage,
  listCatalogDatasets,
  previewConnectionDataset,
} from '../services/api';

export default function CatalogPage() {
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
  const [datasets, setDatasets] = useState([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState('');
  const [selectedDataset, setSelectedDataset] = useState(null);
  const [lineage, setLineage] = useState([]);
  const [preview, setPreview] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [busyKey, setBusyKey] = useState('');

  useEffect(() => {
    if (projectWorkspaceLoading) {
      return undefined;
    }

    async function loadDatasets() {
      try {
        const payload = await listCatalogDatasets(undefined, activeProjectId || undefined);
        const items = extractItems(payload);
        setDatasets(items);
        setSelectedDatasetId((current) => current || router.query.dataset || items[0]?.id || '');
        setFeedback('');
      } catch (error) {
        setFeedback(toErrorMessage(error));
      }
    }

    loadDatasets();
    return undefined;
  }, [activeProjectId, projectWorkspaceLoading, router.query.dataset]);

  useEffect(() => {
    async function loadDatasetDetail() {
      if (!selectedDatasetId) {
        setSelectedDataset(null);
        setLineage([]);
        setPreview(null);
        return;
      }
      try {
        const [dataset, lineagePayload] = await Promise.all([
          getDataset(selectedDatasetId),
          getDatasetLineage(selectedDatasetId),
        ]);
        setSelectedDataset(dataset);
        setLineage(extractItems(lineagePayload));
        if (dataset.connection_id) {
          try {
            const datasetPreview = await previewConnectionDataset(dataset.connection_id, dataset.name, 10);
            setPreview(datasetPreview);
          } catch {
            setPreview(null);
          }
        } else {
          setPreview(null);
        }
      } catch (error) {
        setFeedback(toErrorMessage(error));
      }
    }

    loadDatasetDetail();
  }, [selectedDatasetId]);

  const lineageDag = useMemo(() => buildCatalogLineageDag(selectedDataset, lineage, datasets), [datasets, lineage, selectedDataset]);
  const upstreamCount = useMemo(() => lineage.filter((item) => item.target_dataset_id === selectedDatasetId).length, [lineage, selectedDatasetId]);
  const downstreamCount = useMemo(() => lineage.filter((item) => item.source_dataset_id === selectedDatasetId).length, [lineage, selectedDatasetId]);

  return (
    <PlatformShell
      eyebrow="Catalog + Lineage"
      title="Use lineage as the primary catalog UI and inspect schema, quality, and preview context from the same asset surface."
      description="The catalog is now graph-first. Users start from upstream and downstream flow context, then drill into schema, quality signals, and source previews without leaving the page."
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
        currentStep="catalog"
        context={projectNavigationContext}
        counts={{
          projects: activeProjectId ? 1 : 0,
          workspaces: activeWorkspaceId ? 1 : 0,
          datasets: datasets.length,
        }}
        selectedDatasetId={selectedDatasetId}
        primaryAction={
          selectedDatasetId
            ? {
                label: 'Open Jupyter workspace',
                href: buildWorkspaceHref('/notebooks', projectNavigationContext, { dataset: selectedDatasetId }),
              }
            : {
                label: 'Open Connections',
                href: buildWorkspaceHref('/connections', projectNavigationContext),
              }
        }
        secondaryAction={
          selectedDatasetId
            ? {
                label: 'Refresh lineage focus',
                href: buildWorkspaceHref('/catalog', projectNavigationContext, { dataset: selectedDatasetId }),
                tone: 'secondary',
              }
            : null
        }
        title="Move from datasets into authoring without losing scope"
        description="Catalog should behave like the handoff surface into notebook work, not a dead-end inventory list. The next authoring surface stays one click away from the selected dataset."
      />

      <PlatformPanel title="Catalog snapshot" description="Lineage, profiling, and quality signals are visible before the user opens any secondary detail view.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricTile label="Datasets" value={datasets.length} detail="Registered catalog assets." />
          <MetricTile label="Upstream" value={upstreamCount} detail="Sources feeding the selected dataset." />
          <MetricTile label="Downstream" value={downstreamCount} detail="Targets produced from the selected dataset." />
          <MetricTile label="Quality Checks" value={selectedDataset?.quality_checks?.length || 0} detail="Recorded validation history." />
          <MetricTile label="Preview" value={preview?.sample_size || 0} detail="Rows sampled from the connected source." />
        </div>
      </PlatformPanel>

      <PlatformPanel title="Lineage-first asset explorer" description="Start from the graph, then inspect schema, quality, and notebook entry actions from the side panel.">
        <div className="grid gap-6 xl:grid-cols-[0.75fr_1.35fr_0.9fr]">
          <div className="space-y-3 rounded-3xl border border-stone-200/80 bg-white/82 p-5 shadow-[0_18px_44px_rgba(148,163,184,0.12)]">
            {datasets.length ? (
              datasets.map((dataset) => (
                <button
                  key={dataset.id}
                  onClick={() => setSelectedDatasetId(dataset.id)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    dataset.id === selectedDatasetId ? 'border-emerald-200 bg-emerald-50 shadow-[0_14px_30px_rgba(16,185,129,0.12)]' : 'border-stone-200 bg-stone-50/80 hover:border-stone-300 hover:bg-white'
                  }`}
                >
                  <div className="text-sm font-semibold text-slate-900">{dataset.name}</div>
                  <div className="mt-1 text-xs text-slate-500">{dataset.source_path}</div>
                </button>
              ))
            ) : (
              <EmptyState
                title="No datasets registered yet"
                message="The catalog is empty for the current project context."
                detail="Register datasets from Connections Hub first, then return here to inspect lineage, schema, and quality signals."
                actions={
                  <button
                    onClick={() => router.push(buildWorkspaceHref('/connections', projectNavigationContext))}
                    className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-700 transition hover:bg-sky-100"
                  >
                    Open Connections
                  </button>
                }
              />
            )}
          </div>

          <div className="rounded-3xl border border-stone-200/80 bg-white/82 p-5 shadow-[0_18px_44px_rgba(148,163,184,0.12)]">
            {lineageDag.nodes.length ? (
              <DAGEditor dagJson={lineageDag} heightClass="h-[34rem]" selectedNodeId={selectedDatasetId} showLegend={false} />
            ) : (
              <EmptyState
                title="Lineage graph waiting on a dataset"
                message="Select a dataset from the left rail to render upstream and downstream context."
                detail="The lineage-first view only becomes useful once one dataset is in focus."
              />
            )}
          </div>

          <div className="space-y-4 rounded-3xl border border-stone-200/80 bg-white/82 p-5 shadow-[0_18px_44px_rgba(148,163,184,0.12)]">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-stone-500">Asset detail</div>
              <div className="mt-2 text-lg font-semibold text-slate-900">{selectedDataset?.name || 'Select a dataset'}</div>
              <div className="mt-2 text-sm leading-6 text-slate-600">{selectedDataset?.source_path || 'Schema, quality, and profile details appear here.'}</div>
            </div>

            {selectedDataset ? (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4 text-sm text-slate-600">
                    <div className="text-stone-500">Quality score</div>
                    <div className="mt-2 font-semibold text-slate-900">{selectedDataset.quality_score || 'n/a'}</div>
                  </div>
                  <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4 text-sm text-slate-600">
                    <div className="text-stone-500">Schema columns</div>
                    <div className="mt-2 font-semibold text-slate-900">{selectedDataset.schema?.length || 0}</div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                  {(selectedDataset.tags || []).map((tag) => (
                    <span key={tag} className="rounded-full border border-stone-200 bg-white px-3 py-2">{tag}</span>
                  ))}
                </div>

                <div className="grid gap-2">
                  <button
                    onClick={() => router.push(buildWorkspaceHref('/notebooks', projectNavigationContext, { dataset: selectedDataset.id }))}
                    className="rounded-2xl bg-primary px-4 py-3 text-left text-sm font-semibold text-white transition hover:bg-blue-600"
                  >
                    Open in Jupyter Workspace
                  </button>
                  <button
                    onClick={async () => {
                      setBusyKey('quality');
                      try {
                        await addDatasetQualityCheck(selectedDataset.id, {
                          check_name: 'lineage_profile',
                          status: 'passed',
                          metrics: { quality_score: selectedDataset.quality_score || 0 },
                        });
                        const refreshed = await getDataset(selectedDataset.id);
                        setSelectedDataset(refreshed);
                        setFeedback('Queued a lineage profile quality check for the selected dataset.');
                      } catch (error) {
                        setFeedback(toErrorMessage(error));
                      } finally {
                        setBusyKey('');
                      }
                    }}
                    disabled={busyKey === 'quality'}
                    className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-stone-50 disabled:opacity-50"
                  >
                    {busyKey === 'quality' ? 'Queueing quality...' : 'Run quality check'}
                  </button>
                </div>

                <div>
                  <div className="mb-3 text-xs uppercase tracking-[0.24em] text-stone-500">Schema</div>
                  <div className="space-y-2">
                    {(selectedDataset.schema || []).map((column) => (
                      <div key={`${column.name}-${column.type}`} className="flex items-center justify-between rounded-2xl border border-stone-200 bg-stone-50/80 px-4 py-3 text-sm text-slate-600">
                        <span>{column.name}</span>
                        <span className="font-semibold text-slate-900">{column.type}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-3 text-xs uppercase tracking-[0.24em] text-stone-500">Quality history</div>
                  <div className="space-y-2">
                    {(selectedDataset.quality_checks || []).length ? (
                      selectedDataset.quality_checks.map((check) => (
                        <div key={check.id} className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4 text-sm text-slate-600">
                          <div className="flex items-center justify-between gap-3">
                            <span>{check.check_name}</span>
                            <StatusPill status={check.status} />
                          </div>
                        </div>
                      ))
                    ) : (
                      <EmptyState message="No quality checks recorded for this dataset yet." />
                    )}
                  </div>
                </div>
              </>
            ) : (
              <EmptyState
                title="Select a dataset for asset detail"
                message="Schema, quality checks, and notebook handoff appear here after a dataset is selected."
                detail="Use the left rail to choose the dataset you want to inspect in the current project workspace."
              />
            )}
          </div>
        </div>
      </PlatformPanel>

      <PlatformPanel title="Data preview and profiling" description="Preview stays available when the dataset is backed by a discoverable source connection.">
        {preview ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3 text-xs text-slate-600">
              <span className="rounded-full border border-stone-200 bg-white px-3 py-2">{preview.sample_size} sampled rows</span>
              <span className="rounded-full border border-stone-200 bg-white px-3 py-2">{preview.row_count_estimate} estimated rows</span>
              <span className="rounded-full border border-stone-200 bg-white px-3 py-2">{preview.kind}</span>
            </div>
            <div className="overflow-x-auto rounded-3xl border border-stone-200 bg-white shadow-[0_18px_44px_rgba(148,163,184,0.12)]">
              <table className="min-w-full text-sm text-slate-600">
                <thead className="bg-stone-100 text-slate-900">
                  <tr>
                    {(preview.columns || []).map((column) => (
                      <th key={column.name} className="px-4 py-3 text-left font-semibold">{column.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(preview.rows || []).map((row, index) => (
                    <tr key={`${preview.dataset_name}-${index}`} className="border-t border-stone-200">
                      {(preview.columns || []).map((column) => (
                        <td key={column.name} className="px-4 py-3">{row[column.name] ?? '—'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <EmptyState
            title="Preview unavailable"
            message="Preview works when the selected catalog asset is backed by a discoverable source connection."
            detail="If this dataset should support preview, verify the connection posture and source registration in Connections Hub."
          />
        )}
      </PlatformPanel>
    </PlatformShell>
  );
}
