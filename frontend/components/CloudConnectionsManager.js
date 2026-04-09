import Link from 'next/link';
import { useEffect, useState } from 'react';

import DatasetPreview from './DatasetPreview';
import { EmptyState, MetricTile, StatusPill } from './PlatformShell';
import {
  createConnection,
  deleteConnection,
  getConnectionDatasetSchema,
  getConnectionStats,
  listConnectionDatasets,
  listConnections,
  previewConnectionDataset,
  registerDataset,
  testConnection,
} from '../services/api';
import { buildWorkspaceHref } from '../lib/projectWorkspace';

const CONNECTION_TYPES = [
  { value: 'aws_s3', label: 'AWS S3', shortLabel: 'S3' },
  { value: 'gcp_gcs', label: 'Google Cloud Storage', shortLabel: 'GCS' },
  { value: 'azure_blob', label: 'Azure Blob Storage', shortLabel: 'Blob' },
  { value: 'snowflake', label: 'Snowflake', shortLabel: 'Snowflake' },
  { value: 'bigquery', label: 'BigQuery', shortLabel: 'BQ' },
  { value: 'redshift', label: 'Redshift', shortLabel: 'Redshift' },
];

const OBJECT_STORAGE_TYPES = new Set(['aws_s3', 'gcp_gcs', 'azure_blob']);
const EMPTY_STATS = {
  total_connections: 0,
  active_connections: 0,
  successful_tests: 0,
};

function createEmptyConnection(type = 'aws_s3') {
  return {
    name: '',
    type,
    config: {
      region: '',
      bucket_name: '',
      access_key_id: '',
      secret_access_key: '',
    },
  };
}

function normalizeConnections(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }
  return Array.isArray(payload?.items) ? payload.items : [];
}

function normalizeColumns(columns) {
  if (!Array.isArray(columns)) {
    return [];
  }

  return columns.map((column, index) => ({
    name: column?.name || `column_${index + 1}`,
    type: column?.type || 'unknown',
  }));
}

function normalizeDatasets(payload) {
  const datasets = Array.isArray(payload?.datasets)
    ? payload.datasets
    : Array.isArray(payload)
      ? payload
      : [];

  return datasets.map((dataset, index) => ({
    ...dataset,
    name: dataset?.name || `dataset_${index + 1}`,
    kind: dataset?.kind || 'table',
    description: dataset?.description || 'Source dataset available for browsing.',
    column_count: Number.isFinite(Number(dataset?.column_count))
      ? Number(dataset.column_count)
      : normalizeColumns(dataset?.columns).length,
    row_count_estimate: Number.isFinite(Number(dataset?.row_count_estimate))
      ? Number(dataset.row_count_estimate)
      : 0,
  }));
}

function normalizePreview(payload) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const columns = normalizeColumns(payload.columns);
  const rows = Array.isArray(payload.rows) ? payload.rows : [];

  return {
    ...payload,
    dataset_name: payload.dataset_name || '',
    description: payload.description || 'Source dataset preview',
    kind: payload.kind || 'table',
    columns,
    rows,
    sample_size: Number.isFinite(Number(payload.sample_size)) ? Number(payload.sample_size) : rows.length,
    row_count_estimate: Number.isFinite(Number(payload.row_count_estimate)) ? Number(payload.row_count_estimate) : rows.length,
  };
}

function normalizeSchema(payload) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const columns = normalizeColumns(payload.columns || payload.schema);
  return {
    ...payload,
    columns,
    schema: columns,
  };
}

function deriveDatasetPath(connection, datasetName) {
  if (!connection || !datasetName) {
    return '';
  }

  if (OBJECT_STORAGE_TYPES.has(String(connection.type || '').toLowerCase())) {
    return datasetName;
  }

  return `${connection.name}/${datasetName}`;
}

function deriveDatasetTags(connection, datasetName, kind) {
  return [connection?.type, kind, datasetName?.includes('/') ? 'file-backed' : 'table-backed']
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());
}

function resolveConnectionType(type) {
  return CONNECTION_TYPES.find((item) => item.value === type) || { label: type || 'Unknown', shortLabel: type || 'Unknown' };
}

function resolveConnectionStatus(connection) {
  if (connection?.last_test_result?.success) {
    return 'active';
  }
  if (connection?.last_tested) {
    return 'failed';
  }
  return connection?.status || 'created';
}

function formatDate(value) {
  if (!value) {
    return 'Never';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

export default function CloudConnectionsManager({ projectContext = { projectId: '', workspaceId: '' } }) {
  const [connections, setConnections] = useState([]);
  const [connectionStats, setConnectionStats] = useState(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newConnection, setNewConnection] = useState(createEmptyConnection());
  const [testingConnectionId, setTestingConnectionId] = useState('');
  const [selectedConnectionId, setSelectedConnectionId] = useState('');
  const [datasets, setDatasets] = useState([]);
  const [selectedDatasetName, setSelectedDatasetName] = useState('');
  const [datasetPreview, setDatasetPreview] = useState(null);
  const [datasetSchema, setDatasetSchema] = useState(null);
  const [loadingDatasets, setLoadingDatasets] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [registeringDataset, setRegisteringDataset] = useState('');
  const [registeredDataset, setRegisteredDataset] = useState(null);

  const selectedConnection = connections.find((connection) => connection.id === selectedConnectionId) || null;
  const scopedCatalogHref = buildWorkspaceHref('/catalog', projectContext, {
    dataset: registeredDataset?.id || undefined,
  });
  const scopedNotebookHref = buildWorkspaceHref('/notebooks', projectContext, {
    dataset: registeredDataset?.id || undefined,
  });
  const scopedProjectsHref = buildWorkspaceHref('/projects', projectContext);

  function resetDatasetState() {
    setDatasets([]);
    setSelectedDatasetName('');
    setDatasetPreview(null);
    setDatasetSchema(null);
    setRegisteredDataset(null);
  }

  async function loadConnections(preferredConnectionId = selectedConnectionId) {
    try {
      setLoading(true);
      setError('');
      const [connectionPayload, statsPayload] = await Promise.all([listConnections(), getConnectionStats()]);
      const nextConnections = normalizeConnections(connectionPayload);

      setConnections(nextConnections);
      setConnectionStats({
        ...EMPTY_STATS,
        ...(statsPayload || {}),
      });

      if (preferredConnectionId && nextConnections.some((connection) => connection.id === preferredConnectionId)) {
        setSelectedConnectionId(preferredConnectionId);
      } else if (!nextConnections.some((connection) => connection.id === selectedConnectionId)) {
        setSelectedConnectionId('');
        resetDatasetState();
      }
    } catch (requestError) {
      setError(requestError.message || 'Failed to load connections.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadConnections();
  }, []);

  async function handleCreateConnection(event) {
    event.preventDefault();

    try {
      setError('');
      setFeedback('');
      const created = await createConnection(newConnection);
      const createdConnectionId = created?.connection?.id || created?.id || '';

      setNewConnection(createEmptyConnection(newConnection.type));
      setShowCreateForm(false);
      setFeedback('Connection created. Test it, then browse source datasets for catalog handoff.');
      await loadConnections(createdConnectionId);
    } catch (requestError) {
      setError(requestError.message || 'Failed to create connection.');
    }
  }

  async function handleTestConnection(connectionId) {
    try {
      setTestingConnectionId(connectionId);
      setError('');
      setFeedback('');

      const result = await testConnection(connectionId);
      setConnections((current) => current.map((connection) => (
        connection.id === connectionId
          ? {
              ...connection,
              status: result?.success ? 'active' : 'failed',
              last_tested: new Date().toISOString(),
              last_test_result: result,
            }
          : connection
      )));

      try {
        const refreshedStats = await getConnectionStats();
        setConnectionStats({
          ...EMPTY_STATS,
          ...(refreshedStats || {}),
        });
      } catch {
        // Keep the locally updated state even if the stats refresh fails.
      }

      setFeedback(result?.success ? 'Connection test succeeded.' : 'Connection test finished with warnings or failures.');
    } catch (requestError) {
      setError(requestError.message || 'Failed to test connection.');
    } finally {
      setTestingConnectionId('');
    }
  }

  async function handleDeleteConnection(connectionId) {
    if (typeof window !== 'undefined' && !window.confirm('Are you sure you want to delete this connection?')) {
      return;
    }

    try {
      setError('');
      setFeedback('');
      await deleteConnection(connectionId);

      const nextSelectedConnectionId = selectedConnectionId === connectionId ? '' : selectedConnectionId;
      if (!nextSelectedConnectionId) {
        resetDatasetState();
      }

      setSelectedConnectionId(nextSelectedConnectionId);
      setFeedback('Connection removed.');
      await loadConnections(nextSelectedConnectionId);
    } catch (requestError) {
      setError(requestError.message || 'Failed to delete connection.');
    }
  }

  async function handleSelectDataset(datasetName, connectionId = selectedConnectionId) {
    if (!connectionId || !datasetName) {
      return;
    }

    try {
      setError('');
      setFeedback('');
      setRegisteringDataset('');
      setRegisteredDataset(null);
      setSelectedDatasetName(datasetName);
      setLoadingPreview(true);

      const [previewPayload, schemaPayload] = await Promise.all([
        previewConnectionDataset(connectionId, datasetName, 20),
        getConnectionDatasetSchema(connectionId, datasetName),
      ]);

      setDatasetPreview(normalizePreview(previewPayload));
      setDatasetSchema(normalizeSchema(schemaPayload));
    } catch (requestError) {
      setError(requestError.message || 'Failed to preview dataset.');
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleBrowseData(connection) {
    try {
      setError('');
      setFeedback('');
      setSelectedConnectionId(connection.id);
      setLoadingDatasets(true);
      resetDatasetState();

      const response = await listConnectionDatasets(connection.id);
      const nextDatasets = normalizeDatasets(response);
      setDatasets(nextDatasets);

      if (nextDatasets.length) {
        await handleSelectDataset(nextDatasets[0].name, connection.id);
        setFeedback(`Loaded ${nextDatasets.length} datasets from ${connection.name}.`);
      } else {
        setFeedback(`No datasets were discovered for ${connection.name}.`);
      }
    } catch (requestError) {
      setError(requestError.message || 'Failed to load datasets for this connection.');
    } finally {
      setLoadingDatasets(false);
    }
  }

  async function handleRegisterDataset() {
    if (!selectedConnection || !selectedDatasetName || !datasetPreview) {
      return;
    }

    try {
      setRegisteringDataset(selectedDatasetName);
      setError('');
      setFeedback('');

      const created = await registerDataset({
        name: selectedDatasetName.split('/').pop() || selectedDatasetName,
        source_path: deriveDatasetPath(selectedConnection, selectedDatasetName),
        project_id: projectContext.projectId || undefined,
        connection_id: selectedConnection.id,
        schema: datasetSchema?.columns || datasetPreview.columns || [],
        metadata: {
          connection_name: selectedConnection.name,
          source_kind: datasetPreview.kind,
          source_description: datasetPreview.description,
          sample_size: datasetPreview.sample_size,
        },
        tags: deriveDatasetTags(selectedConnection, selectedDatasetName, datasetPreview.kind),
        row_count: datasetPreview.row_count_estimate,
      });

      setRegisteredDataset(created);
      setFeedback(`Registered ${created?.name || selectedDatasetName} in the catalog.`);
    } catch (requestError) {
      setError(requestError.message || 'Failed to register dataset.');
    } finally {
      setRegisteringDataset('');
    }
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}
      {feedback ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {feedback}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="Connections" value={connectionStats.total_connections} detail="Defined sources and warehouses available to this tenant." />
        <MetricTile label="Active" value={connectionStats.active_connections} detail="Connections that currently report a healthy active state." />
        <MetricTile label="Successful Tests" value={connectionStats.successful_tests} detail="Connections that most recently passed the health check." />
        <MetricTile label="Browsable Datasets" value={datasets.length} detail="Datasets discovered on the selected connection." />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[28px] border border-stone-200/80 bg-white/88 p-6 shadow-[0_18px_44px_rgba(148,163,184,0.12)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Connection inventory</div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Source discovery and connector health</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Keep connection setup, health testing, and source browsing on one controlled surface before datasets enter Catalog or Notebook workspaces.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowCreateForm((current) => !current)}
              className="inline-flex rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-700 transition hover:bg-sky-100"
            >
              {showCreateForm ? 'Hide connection form' : 'Add connection'}
            </button>
          </div>

          {showCreateForm ? (
            <form onSubmit={handleCreateConnection} className="mt-6 rounded-[24px] border border-stone-200 bg-stone-50/80 p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Connection name</label>
                  <input
                    type="text"
                    value={newConnection.name}
                    onChange={(event) => setNewConnection((current) => ({ ...current, name: event.target.value }))}
                    className="w-full rounded-2xl border border-stone-200 bg-white px-3 py-3 text-slate-700 outline-none"
                    placeholder="Sales lakehouse"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Connection type</label>
                  <select
                    value={newConnection.type}
                    onChange={(event) => setNewConnection(createEmptyConnection(event.target.value))}
                    className="w-full rounded-2xl border border-stone-200 bg-white px-3 py-3 text-slate-700 outline-none"
                  >
                    {CONNECTION_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {OBJECT_STORAGE_TYPES.has(newConnection.type) ? (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Region</label>
                    <input
                      type="text"
                      value={newConnection.config.region}
                      onChange={(event) => setNewConnection((current) => ({
                        ...current,
                        config: {
                          ...current.config,
                          region: event.target.value,
                        },
                      }))}
                      className="w-full rounded-2xl border border-stone-200 bg-white px-3 py-3 text-slate-700 outline-none"
                      placeholder="us-east-1"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Bucket or container</label>
                    <input
                      type="text"
                      value={newConnection.config.bucket_name}
                      onChange={(event) => setNewConnection((current) => ({
                        ...current,
                        config: {
                          ...current.config,
                          bucket_name: event.target.value,
                        },
                      }))}
                      className="w-full rounded-2xl border border-stone-200 bg-white px-3 py-3 text-slate-700 outline-none"
                      placeholder="customer-data"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Access key id</label>
                    <input
                      type="password"
                      value={newConnection.config.access_key_id}
                      onChange={(event) => setNewConnection((current) => ({
                        ...current,
                        config: {
                          ...current.config,
                          access_key_id: event.target.value,
                        },
                      }))}
                      className="w-full rounded-2xl border border-stone-200 bg-white px-3 py-3 text-slate-700 outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Secret access key</label>
                    <input
                      type="password"
                      value={newConnection.config.secret_access_key}
                      onChange={(event) => setNewConnection((current) => ({
                        ...current,
                        config: {
                          ...current.config,
                          secret_access_key: event.target.value,
                        },
                      }))}
                      className="w-full rounded-2xl border border-stone-200 bg-white px-3 py-3 text-slate-700 outline-none"
                    />
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-stone-300 bg-white/80 px-4 py-4 text-sm leading-6 text-slate-600">
                  Warehouse connectors currently use the backend defaults for demo discovery. Create the connection, test it, then browse datasets to continue into Catalog or Notebook workspaces.
                </div>
              )}

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="submit"
                  className="rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-600"
                >
                  Create connection
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-stone-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : null}

          <div className="mt-6">
            {loading ? (
              <div className="flex h-48 items-center justify-center">
                <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
              </div>
            ) : !connections.length ? (
              <EmptyState
                title="No connections yet"
                message="Create your first cloud connection to start integrating with external data sources."
                detail="Once a connector exists, this workspace can test it, browse datasets, and register selected sources into the catalog."
                actions={
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(true)}
                    className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-700 transition hover:bg-sky-100"
                  >
                    Add connection
                  </button>
                }
              />
            ) : (
              <div className="space-y-4">
                {connections.map((connection) => {
                  const typeMeta = resolveConnectionType(connection.type);
                  const isSelected = connection.id === selectedConnectionId;

                  return (
                    <div
                      key={connection.id}
                      className={`rounded-[24px] border p-4 transition ${
                        isSelected
                          ? 'border-sky-200 bg-sky-50/70 shadow-[0_14px_30px_rgba(125,211,252,0.16)]'
                          : 'border-stone-200 bg-stone-50/80 hover:border-stone-300 hover:bg-white'
                      }`}
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-3">
                            <div className="rounded-full border border-stone-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-600">
                              {typeMeta.shortLabel}
                            </div>
                            <StatusPill status={resolveConnectionStatus(connection)} />
                          </div>
                          <div className="mt-3 text-lg font-semibold text-slate-900">{connection.name}</div>
                          <div className="mt-1 text-sm text-slate-600">{typeMeta.label}</div>
                          <div className="mt-3 text-xs uppercase tracking-[0.18em] text-stone-500">
                            Last tested: {formatDate(connection.last_tested)}
                          </div>
                          <div className="mt-2 text-sm text-slate-600">
                            {connection.last_test_result?.success
                              ? 'Most recent health check passed. This connection is ready for source browsing.'
                              : connection.last_tested
                                ? 'Most recent health check failed or returned warnings. Review the connector before promoting data into the project workflow.'
                                : 'No health check recorded yet. Test the connector before browsing or registering datasets.'}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void handleTestConnection(connection.id)}
                            disabled={testingConnectionId === connection.id}
                            className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-stone-50 disabled:opacity-60"
                          >
                            {testingConnectionId === connection.id ? 'Testing...' : 'Test connection'}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleBrowseData(connection)}
                            className="rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-600"
                          >
                            {isSelected ? 'Refresh sources' : 'Browse data'}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteConnection(connection.id)}
                            className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[28px] border border-stone-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(248,250,252,0.9))] p-6 shadow-[0_18px_44px_rgba(148,163,184,0.12)]">
          <div className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Connection handoff</div>
          <div className="mt-2 text-xl font-semibold tracking-tight text-slate-900">Route discovered sources into the scoped project flow</div>
          <div className="mt-3 text-sm leading-6 text-slate-600">
            Connections owns source discovery. Catalog owns durable registration and lineage, while Notebook owns interactive inspection once a dataset is selected.
          </div>

          <div className="mt-5 grid gap-3">
            <Link href={scopedProjectsHref} className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-stone-50">
              Manage active project context
            </Link>
            <Link href={scopedCatalogHref} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-white">
              {registeredDataset?.id ? 'Open Catalog + Lineage' : 'Open Catalog workspace'}
            </Link>
            <Link href={scopedNotebookHref} className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-700 transition hover:bg-sky-100">
              {registeredDataset?.id ? 'Open Notebook Workspace' : 'Open Notebook workspace'}
            </Link>
          </div>

          <div className="mt-6 rounded-2xl border border-stone-200 bg-white/82 p-4">
            <div className="text-sm font-semibold text-slate-900">Current selection</div>
            <div className="mt-2 text-sm leading-6 text-slate-600">
              {selectedConnection
                ? `${selectedConnection.name} is active${selectedDatasetName ? ` and ${selectedDatasetName} is ${registeredDataset?.id ? 'registered for handoff.' : 'ready for registration.'}` : '. Browse a dataset to continue.'}`
                : 'Select a connection and browse its datasets to activate the handoff actions.'}
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-dashed border-stone-300 bg-stone-50/80 p-4 text-sm leading-6 text-slate-600">
            The browser intentionally avoids exposing raw credentials after creation. This page focuses on connection health, source discovery, and the handoff into project-scoped catalog and notebook workflows.
          </div>
        </div>
      </div>

      {selectedConnection ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-[28px] border border-stone-200/80 bg-white/86 p-6 shadow-[0_18px_44px_rgba(148,163,184,0.12)]">
            <div className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Credential posture</div>
            <div className="mt-2 text-xl font-semibold tracking-tight text-slate-900">Connection-level security summary</div>
            <div className="mt-3 text-sm leading-6 text-slate-600">
              Credentials stay server-side after creation. The workspace exposes only connection state, recent test results, and browsable datasets so source onboarding does not leak secrets into the UI.
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-stone-200 bg-stone-50/80 px-4 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-stone-500">Connection state</div>
                <div className="mt-2 text-lg font-semibold text-slate-900">{resolveConnectionStatus(selectedConnection)}</div>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-stone-50/80 px-4 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-stone-500">Testing posture</div>
                <div className="mt-2 text-lg font-semibold text-slate-900">
                  {selectedConnection.last_test_result?.success ? 'Healthy after latest check' : selectedConnection.last_tested ? 'Needs follow-up' : 'Awaiting first test'}
                </div>
              </div>
            </div>

            <div className="mt-4 text-sm text-slate-600">
              Last tested: {formatDate(selectedConnection.last_tested)}
            </div>
          </div>

          <div className="rounded-[28px] border border-stone-200/80 bg-white/86 p-6 shadow-[0_18px_44px_rgba(148,163,184,0.12)]">
            <div className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Schema discovery</div>
            <div className="mt-2 text-xl font-semibold tracking-tight text-slate-900">Inspect selected source structure</div>
            <div className="mt-3 text-sm leading-6 text-slate-600">
              Previewed schema appears here after a dataset is selected. Use it to verify shape before registering the source into Catalog.
            </div>

            {datasetSchema?.columns?.length ? (
              <div className="mt-5 space-y-2">
                {datasetSchema.columns.map((column) => (
                  <div key={`${column.name}-${column.type}`} className="flex items-center justify-between rounded-2xl border border-stone-200 bg-stone-50/80 px-4 py-3 text-sm">
                    <span className="font-medium text-slate-900">{column.name}</span>
                    <span className="text-stone-500">{column.type}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-5">
                <EmptyState
                  title="No schema selected"
                  message="Browse a connection dataset to load schema metadata."
                  detail="Schema discovery is attached to the currently selected connection and dataset preview."
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        <EmptyState
          title="Select a connection to continue"
          message="Browse a connector to discover source datasets, preview schema, and activate catalog registration actions."
          detail="The right-hand handoff panel remains available, but dataset registration requires an active connection and dataset selection."
        />
      )}

      <DatasetPreview
        connection={selectedConnection}
        datasets={datasets}
        selectedDatasetName={selectedDatasetName}
        preview={datasetPreview}
        loadingDatasets={loadingDatasets}
        loadingPreview={loadingPreview}
        onSelectDataset={handleSelectDataset}
        actions={selectedDatasetName ? (
          <>
            <button
              type="button"
              onClick={() => void handleRegisterDataset()}
              disabled={registeringDataset === selectedDatasetName}
              className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-700 transition hover:bg-sky-100 disabled:opacity-60"
            >
              {registeringDataset === selectedDatasetName ? 'Registering...' : 'Register in Catalog'}
            </button>
            <Link href={scopedCatalogHref} className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-stone-50">
              {registeredDataset?.id ? 'Open Catalog' : 'Open Catalog workspace'}
            </Link>
            <Link href={scopedNotebookHref} className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-stone-50">
              {registeredDataset?.id ? 'Open Notebook' : 'Open Notebook workspace'}
            </Link>
          </>
        ) : null}
      />
    </div>
  );
}
