import { useRouter } from 'next/router';
import { useEffect, useMemo, useRef, useState } from 'react';

import Cell from '../components/Cell';
import ProjectWorkspaceContext from '../components/ProjectWorkspaceContext';
import PlatformShell, { EmptyState, MetricTile, PlatformPanel, StatusPill } from '../components/PlatformShell';
import WorkflowGuide from '../components/WorkflowGuide';
import { NOTEBOOK_RUNTIME_OPTIONS } from '../lib/platformExperience';
import { buildWorkspaceHref, useProjectWorkspace } from '../lib/projectWorkspace';
import { NOTEBOOK_CELL_LANGUAGES } from '../lib/notebookWorkspace';
import { extractItems, toErrorMessage } from '../lib/platform';
import {
  attachNotebookToFlow,
  createNotebook,
  deleteNotebook,
  executeNotebook,
  getNotebook,
  getRunStatus,
  listCatalogDatasets,
  listRunLogs,
  listRunNodes,
  listNotebooks,
  listPipelines,
  openNotebookWorkspace,
  updateNotebook,
} from '../services/api';

function buildNotebookSource(query) {
  if (query.dataset) {
    return { type: 'dataset', dataset_id: `${query.dataset}` };
  }
  if (query.node) {
    return {
      type: 'flow_node',
      node_id: `${query.node}`,
      pipeline_id: `${query.pipeline || ''}`,
      notebook_id: `${query.notebook || ''}`,
    };
  }
  if (query.mode === 'new') {
    return { type: 'new' };
  }
  if (query.notebook) {
    return { type: 'notebook', notebook_id: `${query.notebook}` };
  }
  return null;
}

function createLocalId(prefix = 'cell') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createDraftCell(type = 'code') {
  return {
    id: createLocalId(type),
    type,
    content: type === 'markdown' ? '# Notes\n\nDescribe the intent of this notebook step.' : '',
    execution_count: null,
    outputs: [],
    metadata: type === 'code' ? { language: 'python' } : { language: 'markdown' },
  };
}

function summarizeNotebookForList(notebook) {
  return {
    id: notebook.id,
    title: notebook.title,
    created_at: notebook.created_at,
    updated_at: notebook.updated_at,
  };
}

function ensureSelectedInventoryItem(items, selectedId, buildFallback) {
  if (!selectedId || items.some((item) => item.id === selectedId)) {
    return items;
  }
  return [buildFallback(selectedId), ...items];
}

function formatPipelineOptionLabel(pipeline) {
  const nodeCount = pipeline?.node_count ?? pipeline?.nodes?.length ?? 0;
  const nodeLabel = nodeCount === 1 ? '1 node' : `${nodeCount} nodes`;
  return `${pipeline?.name || pipeline?.id || 'Untitled flow'} · ${nodeLabel}`;
}

function formatPipelineNodeLabel(node) {
  const kind = node?.kind ? `${node.kind}`.replace(/_/g, ' ') : 'flow node';
  return `${node?.label || node?.id || 'Untitled node'} · ${kind}`;
}

function resolveTabBadge(sourceType, notebook) {
  if (sourceType === 'dataset') {
    return 'Dataset';
  }
  if (sourceType === 'flow_node' || sourceType === 'node') {
    return 'Flow';
  }
  if (notebook?.metadata?.flow_binding?.pipeline_id) {
    return 'Bound';
  }
  return 'Notebook';
}

function mergeNotebookMetadata(notebook, runtimeMode) {
  const metadata = notebook?.metadata || {};
  const kernelName = runtimeMode === 'cluster' ? 'pyspark' : 'python3';
  const kernelLabel = runtimeMode === 'cluster' ? 'PySpark Cluster' : 'Python 3';

  return {
    ...metadata,
    notebook_format: 'jupyter',
    runtime_defaults: {
      ...(metadata.runtime_defaults || {}),
      target: runtimeMode,
      profile: runtimeMode,
    },
    jupyter: {
      ...(metadata.jupyter || {}),
      nbformat: 4,
      nbformat_minor: 5,
      kernelspec: {
        display_name: kernelLabel,
        language: 'python',
        name: kernelName,
      },
      language_info: {
        name: 'python',
      },
    },
  };
}

function splitSource(content = '') {
  if (!content) {
    return [];
  }
  const lines = content.split('\n');
  return lines.map((line, index) => (index < lines.length - 1 ? `${line}\n` : line));
}

function createIpynbDocument(notebook, runtimeMode) {
  const metadata = mergeNotebookMetadata(notebook, runtimeMode);
  return {
    nbformat: 4,
    nbformat_minor: 5,
    metadata: {
      ...metadata.jupyter,
      nexora: {
        flow_binding: notebook?.metadata?.flow_binding || null,
        dataset_links: notebook?.metadata?.dataset_links || [],
      },
    },
    cells: (notebook?.cells || []).map((cell) => {
      if (cell.type === 'markdown') {
        return {
          cell_type: 'markdown',
          metadata: {
            language: 'markdown',
          },
          source: splitSource(cell.content),
        };
      }

      return {
        cell_type: 'code',
        metadata: {
          language: cell.metadata?.language || 'python',
        },
        execution_count: cell.execution_count || null,
        outputs: cell.outputs || [],
        source: splitSource(cell.content),
      };
    }),
  };
}

function downloadIpynb(notebook, runtimeMode) {
  if (typeof window === 'undefined' || !notebook) {
    return;
  }

  const payload = createIpynbDocument(notebook, runtimeMode);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${(notebook.title || 'nexora-notebook').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.ipynb`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

function updateCellInNotebook(notebook, cellId, updater) {
  return {
    ...notebook,
    cells: (notebook.cells || []).map((cell) => (cell.id === cellId ? updater(cell) : cell)),
  };
}

function countCodeCells(cells = []) {
  return cells.filter((cell) => cell.type === 'code').length;
}

const ACTIVE_RUN_STATUSES = new Set(['queued', 'running', 'queued_remote', 'running_remote']);

function isActiveRunStatus(status = '') {
  return ACTIVE_RUN_STATUSES.has(`${status || ''}`.toLowerCase());
}

function buildCellStatusById(runNodes = []) {
  return runNodes.reduce((result, node) => {
    const metadata = node?.metadata || {};
    const cellId = metadata.notebook_cell_id || metadata.source_ref?.cell_id;
    if (!cellId) {
      return result;
    }
    return {
      ...result,
      [cellId]: node.status,
    };
  }, {});
}

function mergeExecutionLogs(existingLogs = [], nextLogs = []) {
  const merged = new Map();
  [...existingLogs, ...nextLogs].forEach((entry) => {
    const key = entry?.id || entry?.cursor || `${entry?.created_at || entry?.timestamp || 'log'}-${entry?.message || ''}`;
    if (!key) {
      return;
    }
    merged.set(key, entry);
  });
  return [...merged.values()];
}

function syncNotebookWithRunNodes(notebook, runNodes = []) {
  if (!notebook) {
    return notebook;
  }

  const executionByCellId = new Map();
  runNodes.forEach((node) => {
    const metadata = node?.metadata || {};
    const cellId = metadata.notebook_cell_id || metadata.source_ref?.cell_id;
    if (!cellId) {
      return;
    }
    executionByCellId.set(cellId, {
      executionCount: metadata.execution_count,
      outputs: metadata.jupyter_outputs,
      status: node.status,
    });
  });

  if (!executionByCellId.size) {
    return notebook;
  }

  return {
    ...notebook,
    cells: (notebook.cells || []).map((cell) => {
      const execution = executionByCellId.get(cell.id);
      if (!execution) {
        return cell;
      }
      return {
        ...cell,
        execution_count: execution.executionCount ?? cell.execution_count,
        outputs: execution.outputs || cell.outputs,
        metadata: {
          ...(cell.metadata || {}),
          execution_status: execution.status,
        },
      };
    }),
  };
}

export default function NotebooksPage() {
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
  const [workspace, setWorkspace] = useState({ notebooks: [], datasets: [], pipelines: [], openContext: null });
  const [selectedNotebookId, setSelectedNotebookId] = useState('');
  const [savedNotebook, setSavedNotebook] = useState(null);
  const [draftNotebook, setDraftNotebook] = useState(null);
  const [selectedDatasetId, setSelectedDatasetId] = useState('');
  const [selectedCellId, setSelectedCellId] = useState('');
  const [runtimeMode, setRuntimeMode] = useState('local');
  const [openTabs, setOpenTabs] = useState([]);
  const [dirtyNotebookIds, setDirtyNotebookIds] = useState([]);
  const [flowBindingDraft, setFlowBindingDraft] = useState({
    pipelineId: '',
    nodeId: '',
    attachMode: 'existing_node',
    upstreamNodeId: '',
    downstreamNodeId: '',
    label: '',
    description: '',
  });
  const [events, setEvents] = useState([]);
  const [feedback, setFeedback] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [execution, setExecution] = useState({
    runId: '',
    pipelineId: '',
    runState: null,
    runNodes: [],
    logs: [],
    cellStatusById: {},
  });
  const executionCursorRef = useRef(0);

  function pushEvent(title, detail) {
    setEvents((current) => [
      {
        id: createLocalId('event'),
        title,
        detail,
        createdAt: new Date().toLocaleTimeString(),
      },
      ...current,
    ].slice(0, 8));
  }

  function resetExecution() {
    executionCursorRef.current = 0;
    setExecution({
      runId: '',
      pipelineId: '',
      runState: null,
      runNodes: [],
      logs: [],
      cellStatusById: {},
    });
  }

  function markNotebookDirty(notebookId, isDirty) {
    if (!notebookId) {
      return;
    }

    setDirtyNotebookIds((current) => {
      const next = new Set(current);
      if (isDirty) {
        next.add(notebookId);
      } else {
        next.delete(notebookId);
      }
      return [...next];
    });
  }

  function syncNotebookSummary(notebook) {
    setWorkspace((current) => {
      const summary = summarizeNotebookForList(notebook);
      const exists = current.notebooks.some((item) => item.id === notebook.id);
      return {
        ...current,
        notebooks: exists
          ? current.notebooks.map((item) => (item.id === notebook.id ? { ...item, ...summary } : item))
          : [summary, ...current.notebooks],
      };
    });
  }

  function registerOpenTab(notebook, sourceType) {
    if (!notebook) {
      return;
    }

    setOpenTabs((current) => {
      const nextTab = {
        notebookId: notebook.id,
        title: notebook.title || 'Untitled Notebook',
        badge: resolveTabBadge(sourceType, notebook),
      };
      return [nextTab, ...current.filter((tab) => tab.notebookId !== notebook.id)].slice(0, 5);
    });
  }

  async function hydrateWorkspace() {
    setBusyKey('hydrate');
    try {
      const source = buildNotebookSource(router.query);
      const scopedSource = source
        ? {
            ...source,
            project_id: activeProjectId || undefined,
            workspace_id: activeWorkspaceId || undefined,
          }
        : null;
      const opened = scopedSource ? await openNotebookWorkspace(scopedSource) : null;
      const [notebooksPayload, datasetsPayload, pipelinesPayload] = await Promise.all([
        listNotebooks(activeProjectId || undefined, activeWorkspaceId || undefined),
        listCatalogDatasets(undefined, activeProjectId || undefined),
        listPipelines(activeProjectId || undefined, activeWorkspaceId || undefined),
      ]);
      const notebookItems = Array.isArray(notebooksPayload) ? notebooksPayload : extractItems(notebooksPayload);
      const datasetItems = extractItems(datasetsPayload);
      const pipelineItems = extractItems(pipelinesPayload);

      let activeNotebook = opened?.notebook || null;
      if (!activeNotebook && notebookItems[0]?.id) {
        activeNotebook = await getNotebook(notebookItems[0].id);
      }

      if (!activeNotebook) {
        const created = await createNotebook('Untitled Notebook', {
          projectId: activeProjectId,
          workspaceId: activeWorkspaceId,
        });
        activeNotebook = created?.notebook || created;
        notebookItems.unshift(summarizeNotebookForList(activeNotebook));
      }

      const linkedDatasetIds = activeNotebook?.metadata?.dataset_links || opened?.open_context?.linked_dataset_ids || [];
      const nextDatasetId = `${router.query.dataset || ''}` || opened?.open_context?.dataset_id || linkedDatasetIds[0] || datasetItems[0]?.id || '';
      const nextRuntime = activeNotebook?.metadata?.runtime_defaults?.profile || opened?.flow_binding?.execution_binding?.runtime_profile || 'local';

      setWorkspace({ notebooks: notebookItems, datasets: datasetItems, pipelines: pipelineItems, openContext: opened?.open_context || null });
      setSelectedNotebookId(activeNotebook.id);
      setSavedNotebook(activeNotebook);
      setDraftNotebook(activeNotebook);
      setSelectedDatasetId(nextDatasetId);
      setSelectedCellId(activeNotebook.cells?.[0]?.id || '');
      setRuntimeMode(nextRuntime);
      registerOpenTab(activeNotebook, opened?.open_context?.source_type);
      markNotebookDirty(activeNotebook.id, false);
      resetExecution();
      setFeedback('');
    } catch (error) {
      setFeedback(toErrorMessage(error));
    } finally {
      setBusyKey('');
    }
  }

  useEffect(() => {
    if (!router.isReady || projectWorkspaceLoading) {
      return;
    }
    hydrateWorkspace();
  }, [
    activeProjectId,
    projectWorkspaceLoading,
    router.isReady,
    router.query.dataset,
    router.query.node,
    router.query.pipeline,
    router.query.notebook,
    router.query.mode,
  ]);

  async function persistNotebookDraft(successMessage = 'Notebook saved.') {
    if (!draftNotebook) {
      return null;
    }

    setBusyKey('save');
    try {
      const response = await updateNotebook(draftNotebook.id, {
        title: draftNotebook.title || 'Untitled Notebook',
        cells: draftNotebook.cells || [],
        metadata: {
          ...mergeNotebookMetadata(draftNotebook, runtimeMode),
          project_id: activeProjectId || draftNotebook?.metadata?.project_id || null,
          workspace_id: activeWorkspaceId || draftNotebook?.metadata?.workspace_id || null,
        },
      });
      const saved = response?.notebook || response;
      setSavedNotebook(saved);
      setDraftNotebook(saved);
      syncNotebookSummary(saved);
      registerOpenTab(saved, workspace.openContext?.source_type);
      markNotebookDirty(saved.id, false);
      setFeedback(successMessage);
      pushEvent('Notebook saved', `${saved.title || 'Notebook'} synced with Jupyter-compatible metadata.`);
      return saved;
    } catch (error) {
      setFeedback(toErrorMessage(error));
      return null;
    } finally {
      setBusyKey('');
    }
  }

  async function openNotebookById(notebookId) {
    if (!notebookId) {
      return;
    }

    if (draftNotebook?.id && dirtyNotebookIds.includes(draftNotebook.id)) {
      const saved = await persistNotebookDraft('Notebook saved before switching tabs.');
      if (!saved && draftNotebook?.id) {
        return;
      }
    }

    setBusyKey(`open-${notebookId}`);
    try {
      const notebook = await getNotebook(notebookId);
      const linkedDatasetIds = notebook?.metadata?.dataset_links || [];
      setSelectedNotebookId(notebook.id);
      setSavedNotebook(notebook);
      setDraftNotebook(notebook);
      setSelectedCellId(notebook.cells?.[0]?.id || '');
      setSelectedDatasetId(linkedDatasetIds[0] || workspace.datasets[0]?.id || '');
      setRuntimeMode(notebook?.metadata?.runtime_defaults?.profile || 'local');
      registerOpenTab(notebook, workspace.openContext?.source_type);
      resetExecution();
      setFeedback('');
    } catch (error) {
      setFeedback(toErrorMessage(error));
    } finally {
      setBusyKey('');
    }
  }

  async function handleCreateNotebook() {
    setBusyKey('create');
    try {
      const created = await createNotebook(`Notebook ${new Date().toLocaleTimeString()}`, {
        projectId: activeProjectId,
        workspaceId: activeWorkspaceId,
      });
      const notebook = created?.notebook || created;
      const notebooksPayload = await listNotebooks(activeProjectId || undefined, activeWorkspaceId || undefined);
      const notebookItems = Array.isArray(notebooksPayload) ? notebooksPayload : extractItems(notebooksPayload);
      setWorkspace((current) => ({ ...current, notebooks: notebookItems }));
      setSelectedNotebookId(notebook.id);
      setSavedNotebook(notebook);
      setDraftNotebook(notebook);
      setSelectedCellId(notebook.cells?.[0]?.id || '');
      markNotebookDirty(notebook.id, false);
      registerOpenTab(notebook, 'new');
      resetExecution();
      setFeedback('Created a new Jupyter workspace.');
      pushEvent('Created notebook', `${notebook.title || 'Notebook'} is ready for authoring.`);
    } catch (error) {
      setFeedback(toErrorMessage(error));
    } finally {
      setBusyKey('');
    }
  }

  async function handleDeleteNotebook() {
    if (!draftNotebook) {
      return;
    }

    setBusyKey('delete');
    try {
      await deleteNotebook(draftNotebook.id);
      let notebooksPayload = await listNotebooks(activeProjectId || undefined, activeWorkspaceId || undefined);
      let notebookItems = Array.isArray(notebooksPayload) ? notebooksPayload : extractItems(notebooksPayload);

      if (!notebookItems.length) {
        const created = await createNotebook('Untitled Notebook', {
          projectId: activeProjectId,
          workspaceId: activeWorkspaceId,
        });
        notebookItems = [summarizeNotebookForList(created?.notebook || created)];
      }

      setWorkspace((current) => ({ ...current, notebooks: notebookItems }));
      setOpenTabs((current) => current.filter((tab) => tab.notebookId !== draftNotebook.id));
      markNotebookDirty(draftNotebook.id, false);
      pushEvent('Deleted notebook', `${draftNotebook.title || 'Notebook'} was removed from the workspace.`);
      setFeedback('Notebook deleted.');
      await openNotebookById(notebookItems[0]?.id || '');
    } catch (error) {
      setFeedback(toErrorMessage(error));
    } finally {
      setBusyKey('');
    }
  }

  function updateDraft(updater) {
    setDraftNotebook((current) => {
      if (!current) {
        return current;
      }
      const next = typeof updater === 'function' ? updater(current) : { ...current, ...updater };
      markNotebookDirty(next.id, true);
      return next;
    });
  }

  function handleAddCell(type, afterCellId) {
    if (!draftNotebook) {
      return;
    }

    const nextCell = createDraftCell(type);
    updateDraft((current) => {
      const cells = [...(current.cells || [])];
      const afterIndex = cells.findIndex((cell) => cell.id === afterCellId);
      if (afterIndex >= 0) {
        cells.splice(afterIndex + 1, 0, nextCell);
      } else {
        cells.push(nextCell);
      }
      return { ...current, cells };
    });
    setSelectedCellId(nextCell.id);
  }

  function handleDeleteCell(cellId) {
    if (!draftNotebook) {
      return;
    }

    updateDraft((current) => {
      const remaining = (current.cells || []).filter((cell) => cell.id !== cellId);
      return {
        ...current,
        cells: remaining.length ? remaining : [createDraftCell('code')],
      };
    });
    setSelectedCellId((current) => {
      if (current !== cellId) {
        return current;
      }
      const remaining = draftNotebook.cells.filter((cell) => cell.id !== cellId);
      return remaining[0]?.id || '';
    });
  }

  function handleCellUpdate(cellId, updates) {
    updateDraft((current) => updateCellInNotebook(current, cellId, (cell) => ({ ...cell, ...updates, metadata: updates.metadata || cell.metadata })));
  }

  function activateExecution(response, nextNotebook, successMessage, eventTitle, eventDetail) {
    const queuedNotebook = nextNotebook || response?.notebook || null;
    if (queuedNotebook) {
      const synchronizedNotebook = syncNotebookWithRunNodes(queuedNotebook, response?.run_nodes || []);
      setSavedNotebook(synchronizedNotebook);
      setDraftNotebook(synchronizedNotebook);
      syncNotebookSummary(synchronizedNotebook);
      registerOpenTab(synchronizedNotebook, workspace.openContext?.source_type);
      markNotebookDirty(synchronizedNotebook.id, false);
      setRuntimeMode(synchronizedNotebook?.metadata?.runtime_defaults?.profile || runtimeMode);
    }

    executionCursorRef.current = 0;
    setExecution({
      runId: response?.run_id || '',
      pipelineId: response?.pipeline_id || '',
      runState: response?.run_id ? { id: response.run_id, status: response.status } : null,
      runNodes: [],
      logs: [],
      cellStatusById: Object.fromEntries((response?.selected_cell_ids || []).map((cellId) => [cellId, response.status || 'queued'])),
    });
    if (response?.selected_cell_ids?.length) {
      setSelectedCellId(response.selected_cell_ids[0]);
    }
    setFeedback(successMessage);
    pushEvent(eventTitle, eventDetail);
  }

  useEffect(() => {
    if (!execution.runId) {
      return undefined;
    }

    let cancelled = false;

    async function syncExecution() {
      try {
        const [runPayload, runNodesPayload, logPayload] = await Promise.all([
          getRunStatus(execution.runId),
          listRunNodes(execution.runId),
          listRunLogs(execution.runId, {
            afterId: executionCursorRef.current,
            limit: 200,
          }),
        ]);

        if (cancelled) {
          return;
        }

        const nextRunNodes = extractItems(runNodesPayload);
        const nextLogs = extractItems(logPayload);
        executionCursorRef.current = logPayload.cursor || executionCursorRef.current || 0;

        setExecution((current) => ({
          ...current,
          runState: runPayload,
          runNodes: nextRunNodes,
          logs: mergeExecutionLogs(current.logs, nextLogs),
          cellStatusById: buildCellStatusById(nextRunNodes),
        }));
        setSavedNotebook((current) => syncNotebookWithRunNodes(current, nextRunNodes));
        setDraftNotebook((current) => syncNotebookWithRunNodes(current, nextRunNodes));
      } catch (error) {
        if (!cancelled) {
          setFeedback(toErrorMessage(error));
        }
      }
    }

    syncExecution();
    if (!isActiveRunStatus(execution.runState?.status || 'queued')) {
      return () => {
        cancelled = true;
      };
    }

    const handle = window.setInterval(syncExecution, 1500);
    return () => {
      cancelled = true;
      window.clearInterval(handle);
    };
  }, [execution.runId, execution.runState?.status]);

  async function handleRunCell(cellId) {
    if (!draftNotebook) {
      return;
    }

    setBusyKey(`run-${cellId}`);
    try {
      const activeNotebook = dirtyNotebookIds.includes(draftNotebook.id)
        ? await persistNotebookDraft('Notebook saved before running the selected cell.')
        : savedNotebook || draftNotebook;
      if (!activeNotebook) {
        return;
      }
      const response = await executeNotebook(activeNotebook.id, {
        mode: 'cell',
        cell_id: cellId,
        runtime_target: runtimeMode,
      });
      const cellIndex = (activeNotebook.cells || []).findIndex((cell) => cell.id === cellId);
      activateExecution(
        response,
        response?.notebook || activeNotebook,
        'Cell queued in the shared runtime.',
        'Queued cell run',
        `Queued ${activeNotebook.title || 'notebook'} cell ${cellIndex >= 0 ? cellIndex + 1 : ''} through the shared pipeline runtime.`
      );
    } catch (error) {
      setFeedback(toErrorMessage(error));
    } finally {
      setBusyKey('');
    }
  }

  async function handleRunAll() {
    if (!draftNotebook) {
      return;
    }

    const runnableCells = (draftNotebook.cells || []).filter((cell) => cell.type === 'code');
    if (!runnableCells.length) {
      setFeedback('Add at least one code cell before running the notebook.');
      return;
    }

    setBusyKey('run-all');
    try {
      const activeNotebook = dirtyNotebookIds.includes(draftNotebook.id)
        ? await persistNotebookDraft('Notebook saved before running all cells.')
        : savedNotebook || draftNotebook;
      if (!activeNotebook) {
        return;
      }
      const response = await executeNotebook(activeNotebook.id, {
        mode: 'all',
        runtime_target: runtimeMode,
      });
      activateExecution(
        response,
        response?.notebook || activeNotebook,
        `Queued ${runnableCells.length} code cells in the shared runtime.`,
        'Queued notebook run',
        `Queued ${runnableCells.length} code cells in ${activeNotebook.title || 'the notebook'} through the shared pipeline runtime.`
      );
    } catch (error) {
      setFeedback(toErrorMessage(error));
    } finally {
      setBusyKey('');
    }
  }

  async function handleAttachToFlow() {
    if (!draftNotebook) {
      return;
    }

    if (!flowBindingDraft.pipelineId) {
      setFeedback('Select a flow before binding this notebook.');
      return;
    }
    if (flowBindingDraft.attachMode === 'existing_node' && !flowBindingDraft.nodeId) {
      setFeedback('Select a flow node to replace or switch to creating a new notebook node.');
      return;
    }

    setBusyKey('bind-flow');
    try {
      const activeNotebook = dirtyNotebookIds.includes(draftNotebook.id)
        ? await persistNotebookDraft('Notebook saved before updating flow binding.')
        : savedNotebook || draftNotebook;
      if (!activeNotebook) {
        return;
      }

      const response = await attachNotebookToFlow(activeNotebook.id, {
        pipeline_id: flowBindingDraft.pipelineId,
        node_id: flowBindingDraft.nodeId || undefined,
        attach_mode: flowBindingDraft.attachMode,
        upstream_node_id: flowBindingDraft.attachMode === 'new_node' ? flowBindingDraft.upstreamNodeId || undefined : undefined,
        downstream_node_id: flowBindingDraft.attachMode === 'new_node' ? flowBindingDraft.downstreamNodeId || undefined : undefined,
        label: flowBindingDraft.label || activeNotebook.title || 'Notebook Step',
        description: flowBindingDraft.description || 'Notebook workspace step compiled from a persisted notebook asset.',
        config: {
          runtime_profile: runtimeMode,
          entrypoint_cell: selectedCell?.id || undefined,
          linked_dataset_ids: notebookDatasetLinks,
        },
      });

      const boundNotebook = response?.notebook || activeNotebook;
      setSavedNotebook(boundNotebook);
      setDraftNotebook(boundNotebook);
      syncNotebookSummary(boundNotebook);
      registerOpenTab(boundNotebook, 'flow_node');
      markNotebookDirty(boundNotebook.id, false);
      setWorkspace((current) => ({
        ...current,
        openContext: {
          ...(current.openContext || {}),
          source_type: 'flow_node',
          flow: {
            pipeline_id: response?.pipeline_id || flowBindingDraft.pipelineId,
            node_id: response?.node_id || flowBindingDraft.nodeId,
          },
        },
      }));
      setFlowBindingDraft((current) => ({
        ...current,
        pipelineId: response?.pipeline_id || current.pipelineId,
        nodeId: response?.node_id || current.nodeId,
        attachMode: 'existing_node',
        label: boundNotebook.title || current.label,
      }));
      setFeedback('Notebook flow binding updated.');
      pushEvent(
        'Notebook bound to flow',
        `Attached ${boundNotebook.title || 'notebook'} to pipeline ${response?.pipeline_id || flowBindingDraft.pipelineId}.`,
      );
    } catch (error) {
      setFeedback(toErrorMessage(error));
    } finally {
      setBusyKey('');
    }
  }

  const notebookDatasetLinks = useMemo(
    () => draftNotebook?.metadata?.dataset_links || workspace.openContext?.linked_dataset_ids || [],
    [draftNotebook?.metadata?.dataset_links, workspace.openContext?.linked_dataset_ids],
  );
  const availablePipelines = useMemo(
    () =>
      ensureSelectedInventoryItem(workspace.pipelines || [], flowBindingDraft.pipelineId, (pipelineId) => ({
        id: pipelineId,
        name: pipelineId,
        node_count: 0,
        notebook_node_count: 0,
        nodes: [],
      })),
    [flowBindingDraft.pipelineId, workspace.pipelines],
  );
  const selectedPipeline = useMemo(
    () => availablePipelines.find((pipeline) => pipeline.id === flowBindingDraft.pipelineId) || null,
    [availablePipelines, flowBindingDraft.pipelineId],
  );
  const selectedPipelineNodes = useMemo(
    () =>
      ensureSelectedInventoryItem(selectedPipeline?.nodes || [], flowBindingDraft.nodeId, (nodeId) => ({
        id: nodeId,
        label: nodeId,
        kind: 'flow',
        notebook_id: null,
      })),
    [flowBindingDraft.nodeId, selectedPipeline?.nodes],
  );
  const preferredExistingNodes = useMemo(() => {
    const notebookNodes = selectedPipelineNodes.filter((node) => node.kind === 'notebook');
    return notebookNodes.length ? notebookNodes : selectedPipelineNodes;
  }, [selectedPipelineNodes]);
  const canBindToFlow = Boolean(
    draftNotebook &&
      flowBindingDraft.pipelineId &&
      (flowBindingDraft.attachMode === 'new_node' || flowBindingDraft.nodeId),
  );
  const linkedDatasets = useMemo(
    () => workspace.datasets.filter((dataset) => notebookDatasetLinks.includes(dataset.id)),
    [notebookDatasetLinks, workspace.datasets],
  );
  const selectedDataset = useMemo(
    () => workspace.datasets.find((dataset) => dataset.id === selectedDatasetId) || linkedDatasets[0] || null,
    [linkedDatasets, selectedDatasetId, workspace.datasets],
  );
  const selectedCell = useMemo(
    () => draftNotebook?.cells?.find((cell) => cell.id === selectedCellId) || draftNotebook?.cells?.[0] || null,
    [draftNotebook?.cells, selectedCellId],
  );
  const visibleTabs = useMemo(
    () => openTabs.map((tab) => ({
      ...tab,
      title: tab.notebookId === draftNotebook?.id ? draftNotebook?.title || tab.title : tab.title,
      isDirty: dirtyNotebookIds.includes(tab.notebookId),
    })),
    [dirtyNotebookIds, draftNotebook?.id, draftNotebook?.title, openTabs],
  );
  const flowBinding = draftNotebook?.metadata?.flow_binding || null;
  const notebookCount = workspace.notebooks.length;
  const codeCellCount = countCodeCells(draftNotebook?.cells || []);
  const currentContextLabel = workspace.openContext?.source_type === 'dataset'
    ? 'Dataset context'
    : workspace.openContext?.source_type === 'flow_node'
    ? 'Flow context'
    : flowBinding?.pipeline_id
    ? 'Flow-bound'
    : 'Notebook context';
  const selectedRuntime = NOTEBOOK_RUNTIME_OPTIONS.find((option) => option.value === runtimeMode);
  const activeRunStatus = execution.runState?.status || '';
  const recentRuntimeLogs = useMemo(() => [...execution.logs].slice(-6).reverse(), [execution.logs]);

  useEffect(() => {
    if (flowBindingDraft.attachMode !== 'existing_node' || !selectedPipeline) {
      return;
    }
    if (flowBindingDraft.nodeId && preferredExistingNodes.some((node) => node.id === flowBindingDraft.nodeId)) {
      return;
    }
    const preferredNode = preferredExistingNodes[0];
    if (!preferredNode) {
      return;
    }
    setFlowBindingDraft((current) => {
      if (current.attachMode !== 'existing_node' || current.pipelineId !== selectedPipeline.id) {
        return current;
      }
      if (current.nodeId && preferredExistingNodes.some((node) => node.id === current.nodeId)) {
        return current;
      }
      return { ...current, nodeId: preferredNode.id };
    });
  }, [flowBindingDraft.attachMode, flowBindingDraft.nodeId, preferredExistingNodes, selectedPipeline]);

  useEffect(() => {
    const pipelineId = flowBinding?.pipeline_id || workspace.openContext?.flow?.pipeline_id || `${router.query.pipeline || ''}`;
    const nodeId = flowBinding?.node_id || workspace.openContext?.flow?.node_id || `${router.query.node || ''}`;
    setFlowBindingDraft({
      pipelineId,
      nodeId,
      attachMode: nodeId ? 'existing_node' : 'new_node',
      upstreamNodeId: '',
      downstreamNodeId: '',
      label: draftNotebook?.title || 'Notebook Step',
      description: 'Notebook workspace step compiled from a persisted notebook asset.',
    });
  }, [draftNotebook?.id, draftNotebook?.title, flowBinding?.node_id, flowBinding?.pipeline_id, router.query.node, router.query.pipeline, workspace.openContext?.flow?.node_id, workspace.openContext?.flow?.pipeline_id]);

  return (
    <PlatformShell
      eyebrow="Jupyter Workspace"
      title="Use notebooks as the primary project workbench, with data context, runtime controls, and flow handoff in one place."
      description="This page now behaves like a focused notebook environment instead of a mixed admin page. Data comes in from Catalog or Flow, cells stay editable in place, and notebook documents can be exported as Jupyter files."
      focus="project"
      navigationContext={projectNavigationContext}
      aside={
        <div className="space-y-4">
          <ProjectWorkspaceContext
            projects={projectOptions}
            activeProject={activeProject}
            activeWorkspaceId={activeWorkspaceId}
            loading={projectWorkspaceLoading}
            error={projectWorkspaceError}
            onProjectChange={setActiveProject}
            onWorkspaceChange={setActiveWorkspace}
          />
          <div className="space-y-3 text-sm text-slate-600">
            <div>
              <div className="text-[10px] uppercase tracking-[0.24em] text-stone-500">Active notebook</div>
              <div className="mt-2 font-semibold text-slate-900">{draftNotebook?.title || 'Notebook workspace'}</div>
            </div>
            <div className="rounded-[24px] border border-stone-200 bg-white px-3 py-3 shadow-[0_12px_28px_rgba(148,163,184,0.08)]">
              <div className="text-[10px] uppercase tracking-[0.24em] text-stone-500">Current context</div>
              <div className="mt-2 font-semibold text-slate-900">{currentContextLabel}</div>
            </div>
            {flowBinding?.pipeline_id ? (
              <div className="rounded-[24px] border border-stone-200 bg-white px-3 py-3 shadow-[0_12px_28px_rgba(148,163,184,0.08)]">
                <div className="text-[10px] uppercase tracking-[0.24em] text-stone-500">Bound flow</div>
                <div className="mt-2 text-slate-900">{flowBinding.pipeline_id}</div>
              </div>
            ) : null}
          </div>
        </div>
      }
      actions={feedback ? <div className="rounded-2xl border border-stone-200 bg-white/80 px-4 py-3 text-sm text-slate-600">{feedback}</div> : null}
    >
      <WorkflowGuide
        currentStep="notebooks"
        context={projectNavigationContext}
        counts={{
          projects: activeProjectId ? 1 : 0,
          workspaces: activeWorkspaceId ? 1 : 0,
          datasets: workspace.datasets.length,
          notebooks: workspace.notebooks.length,
          pipelines: workspace.pipelines.length,
          runs: execution.runId ? 1 : 0,
        }}
        selectedDatasetId={selectedDatasetId}
        selectedNotebookId={selectedNotebookId}
        pipelineId={flowBindingDraft.pipelineId || flowBinding?.pipeline_id || ''}
        primaryAction={{
          label: 'Open Flow Builder',
          href: buildWorkspaceHref('/flow', projectNavigationContext, {
            notebook: selectedNotebookId || undefined,
            pipeline: flowBindingDraft.pipelineId || flowBinding?.pipeline_id || undefined,
          }),
        }}
        secondaryAction={
          selectedDatasetId
            ? {
                label: 'Return to Catalog',
                href: buildWorkspaceHref('/catalog', projectNavigationContext, { dataset: selectedDatasetId }),
                tone: 'secondary',
              }
            : null
        }
        title="Notebook authoring should hand off directly into orchestration"
        description="The notebook workspace is now a true bridge between dataset context and executable flows. Keep the selected notebook and its current dataset attached as you move into Flow Builder."
      />

      <PlatformPanel title="Notebook workspace snapshot" description="Jupyter documents stay connected to datasets, runtime profiles, and flow binding without leaving the project layer.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricTile label="Notebooks" value={notebookCount} detail="Saved notebook assets visible in the current tenant." />
          <MetricTile label="Linked Datasets" value={linkedDatasets.length} detail="Datasets carried into the current notebook context." />
          <MetricTile label="Code Cells" value={codeCellCount} detail="Executable notebook units ready for run or export." />
          <MetricTile label="Kernel" value={selectedRuntime?.label || 'Local Runtime'} detail={currentContextLabel} />
        </div>
      </PlatformPanel>

      <PlatformPanel title="Integrated Jupyter workbench" description="Notebook tabs, save and run actions, a left data rail, a central cell editor, and a right flow or runtime inspector now live in one surface.">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            {visibleTabs.length ? (
              visibleTabs.map((tab) => (
                <button
                  key={tab.notebookId}
                  onClick={() => openNotebookById(tab.notebookId)}
                  className={`rounded-[22px] border px-4 py-3 text-left transition ${
                    tab.notebookId === selectedNotebookId
                      ? 'border-sky-200 bg-sky-50 text-sky-700 shadow-[0_14px_32px_rgba(125,211,252,0.18)]'
                      : 'border-stone-200 bg-white text-slate-600 hover:border-stone-300 hover:bg-stone-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{tab.title}</span>
                    <span className="rounded-full border border-stone-200 bg-stone-100 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-stone-500">{tab.badge}</span>
                    {tab.isDirty ? <span className="h-2 w-2 rounded-full bg-amber-300"></span> : null}
                  </div>
                </button>
              ))
            ) : (
              <EmptyState
                title="No notebook tab is open"
                message="Open an existing notebook or create a new one to start the workbench."
                detail="Once a notebook is active, dataset context, runtime controls, and flow binding all appear on the same screen."
                actions={
                  <button
                    onClick={handleCreateNotebook}
                    className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-700 transition hover:bg-sky-100"
                  >
                    New notebook
                  </button>
                }
              />
            )}
          </div>

          <div className="grid gap-3 rounded-[30px] border border-stone-200/80 bg-white/82 p-4 shadow-[0_18px_44px_rgba(148,163,184,0.12)] xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_200px]">
              <input
                value={draftNotebook?.title || ''}
                onChange={(event) => updateDraft((current) => ({ ...current, title: event.target.value }))}
                className="rounded-[22px] border border-stone-200 bg-white px-4 py-3 text-base font-semibold text-slate-900 outline-none transition focus:border-sky-300"
                placeholder="Notebook title"
              />
              <select
                value={runtimeMode}
                onChange={(event) => {
                  setRuntimeMode(event.target.value);
                  markNotebookDirty(selectedNotebookId, true);
                }}
                className="rounded-[22px] border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none"
              >
                {NOTEBOOK_RUNTIME_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              <button
                onClick={() => persistNotebookDraft()}
                disabled={!draftNotebook || busyKey === 'save'}
                className="rounded-[22px] border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-stone-50 disabled:opacity-50"
              >
                {busyKey === 'save' ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={handleRunAll}
                disabled={!draftNotebook || busyKey === 'run-all'}
                className="rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:opacity-50"
              >
                {busyKey === 'run-all' ? 'Running all...' : 'Run all'}
              </button>
              <button
                onClick={handleCreateNotebook}
                disabled={busyKey === 'create'}
                className="rounded-[22px] border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-stone-50 disabled:opacity-50"
              >
                {busyKey === 'create' ? 'Creating...' : 'New notebook'}
              </button>
              <button
                onClick={() => downloadIpynb(draftNotebook, runtimeMode)}
                disabled={!draftNotebook}
                className="rounded-[22px] border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-700 transition hover:bg-sky-100 disabled:opacity-50"
              >
                Export .ipynb
              </button>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.78fr_1.45fr_0.92fr]">
            <div className="space-y-5 rounded-[30px] border border-stone-200/80 bg-white/82 p-5 shadow-[0_18px_44px_rgba(148,163,184,0.12)]">
              <div>
                <div className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Notebook library</div>
                <div className="mt-2 text-lg font-semibold text-slate-900">Saved documents</div>
              </div>
              <div className="space-y-2">
                {workspace.notebooks.length ? (
                  workspace.notebooks.map((notebook) => (
                    <button
                      key={notebook.id}
                      onClick={() => openNotebookById(notebook.id)}
                      className={`w-full rounded-[22px] border px-4 py-3 text-left transition ${
                        notebook.id === selectedNotebookId
                          ? 'border-sky-200 bg-sky-50 shadow-[0_14px_30px_rgba(125,211,252,0.18)]'
                          : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50'
                      }`}
                    >
                      <div className="text-sm font-semibold text-slate-900">{notebook.title}</div>
                      <div className="mt-1 text-xs text-slate-500">Updated {notebook.updated_at || notebook.created_at || 'recently'}</div>
                    </button>
                  ))
                ) : (
                  <EmptyState
                    title="No notebooks saved yet"
                    message="This workspace has not created its first notebook yet."
                    detail="Create a notebook to begin authoring cells and attach it back into Flow Builder later."
                    actions={
                      <button
                        onClick={handleCreateNotebook}
                        className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-700 transition hover:bg-sky-100"
                      >
                        Create notebook
                      </button>
                    }
                  />
                )}
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Data rail</div>
                <div className="mt-2 text-lg font-semibold text-slate-900">Linked datasets</div>
              </div>
              <div className="space-y-2">
                {(linkedDatasets.length ? linkedDatasets : workspace.datasets.slice(0, 6)).map((dataset) => (
                  <button
                    key={dataset.id}
                    onClick={() => setSelectedDatasetId(dataset.id)}
                    className={`w-full rounded-[22px] border px-4 py-3 text-left transition ${
                      dataset.id === selectedDataset?.id
                        ? 'border-emerald-200 bg-emerald-50 shadow-[0_14px_30px_rgba(16,185,129,0.12)]'
                        : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50'
                    }`}
                  >
                    <div className="text-sm font-semibold text-slate-900">{dataset.name}</div>
                    <div className="mt-1 text-xs text-slate-500">{dataset.source_path || 'Catalog dataset'}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[30px] border border-stone-200/80 bg-white/82 p-5 shadow-[0_18px_44px_rgba(148,163,184,0.12)]">
              {draftNotebook ? (
                <div className="space-y-4">
                  <div className="rounded-[24px] border border-sky-200 bg-sky-50 px-4 py-4 text-sm text-sky-700 shadow-[0_12px_28px_rgba(125,211,252,0.12)]">
                    {workspace.openContext?.source_type === 'dataset'
                      ? `Opened from dataset ${selectedDataset?.name || workspace.openContext.dataset_id || ''}.`
                      : workspace.openContext?.source_type === 'flow_node'
                      ? `Opened from flow node ${workspace.openContext.flow?.node_id || ''}.`
                      : 'Jupyter-style notebook document with inline editing, dataset context, and export support.'}
                  </div>

                  {(draftNotebook.cells || []).map((cell) => (
                    <Cell
                      key={cell.id}
                      cell={cell}
                      isExecuting={busyKey === `run-${cell.id}` || isActiveRunStatus(execution.cellStatusById[cell.id])}
                      isSelected={selectedCell?.id === cell.id}
                      languageOptions={NOTEBOOK_CELL_LANGUAGES}
                      onSelect={() => setSelectedCellId(cell.id)}
                      onUpdate={(updates) => handleCellUpdate(cell.id, updates)}
                      onExecute={() => handleRunCell(cell.id)}
                      onDelete={() => handleDeleteCell(cell.id)}
                      onAddCell={handleAddCell}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="Notebook editor is empty"
                  message="Create or open a notebook to start editing cells."
                  detail="The central canvas becomes the main authoring surface as soon as a notebook is active in this workspace."
                  actions={
                    <button
                      onClick={handleCreateNotebook}
                      className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-700 transition hover:bg-sky-100"
                    >
                      Start a notebook
                    </button>
                  }
                />
              )}
            </div>

            <div className="space-y-4 rounded-[30px] border border-stone-200/80 bg-white/82 p-5 shadow-[0_18px_44px_rgba(148,163,184,0.12)]">
              <div>
                <div className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Inspector</div>
                <div className="mt-2 text-lg font-semibold text-slate-900">Kernel, flow, and data context</div>
              </div>

              <div className="rounded-[24px] border border-stone-200 bg-stone-50/80 p-4 text-sm text-slate-600 shadow-[0_12px_28px_rgba(148,163,184,0.08)]">
                <div className="text-stone-500">Kernel</div>
                <div className="mt-2 font-semibold text-slate-900">{selectedRuntime?.label || 'Local Runtime'}</div>
                <div className="mt-2 leading-6 text-slate-600">{selectedRuntime?.description || 'Fast local notebook execution for authoring.'}</div>
              </div>

              <div className="rounded-[24px] border border-stone-200 bg-stone-50/80 p-4 text-sm text-slate-600 shadow-[0_12px_28px_rgba(148,163,184,0.08)]">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-stone-500">Flow binding</span>
                  <StatusPill status={flowBinding?.pipeline_id ? 'bound' : 'draft'} />
                </div>
                <div className="mt-3 text-slate-900">{flowBinding?.pipeline_id || 'Not yet attached to a pipeline node'}</div>
                <div className="mt-2 text-slate-600">
                  {selectedPipeline
                    ? `${selectedPipeline.node_count || selectedPipeline.nodes?.length || 0} nodes are available in the selected project flow.`
                    : flowBinding?.node_id
                    ? `Node ${flowBinding.node_id}`
                    : 'Use Flow Builder to bind this notebook into the main DAG.'}
                </div>
                <div className="mt-4 space-y-3">
                  {availablePipelines.length ? (
                    <select
                      value={flowBindingDraft.pipelineId}
                      onChange={(event) =>
                        setFlowBindingDraft((current) => ({
                          ...current,
                          pipelineId: event.target.value,
                          nodeId: current.pipelineId === event.target.value ? current.nodeId : '',
                          upstreamNodeId: '',
                          downstreamNodeId: '',
                        }))
                      }
                      className="w-full rounded-[22px] border border-stone-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none"
                    >
                      <option value="">Select project flow</option>
                      {availablePipelines.map((pipeline) => (
                        <option key={pipeline.id} value={pipeline.id}>{formatPipelineOptionLabel(pipeline)}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="rounded-[22px] border border-stone-200 bg-white px-4 py-3 text-sm text-slate-600">
                      No saved flows are available in this project workspace yet. Save a flow in Flow Builder first, then bind this notebook back into it.
                    </div>
                  )}
                  <select
                    value={flowBindingDraft.attachMode}
                    onChange={(event) => setFlowBindingDraft((current) => ({ ...current, attachMode: event.target.value }))}
                    className="w-full rounded-[22px] border border-stone-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none"
                  >
                    <option value="existing_node">Replace existing node</option>
                    <option value="new_node">Create notebook node</option>
                  </select>
                  {flowBindingDraft.attachMode === 'existing_node' ? (
                    <select
                      value={flowBindingDraft.nodeId}
                      onChange={(event) => setFlowBindingDraft((current) => ({ ...current, nodeId: event.target.value }))}
                      className="w-full rounded-[22px] border border-stone-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none"
                    >
                      <option value="">Select flow node</option>
                      {preferredExistingNodes.map((node) => (
                        <option key={node.id} value={node.id}>{formatPipelineNodeLabel(node)}</option>
                      ))}
                    </select>
                  ) : (
                    <>
                      <input
                        value={flowBindingDraft.nodeId}
                        onChange={(event) => setFlowBindingDraft((current) => ({ ...current, nodeId: event.target.value }))}
                        className="w-full rounded-[22px] border border-stone-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none"
                        placeholder="Optional notebook node ID"
                      />
                      <select
                        value={flowBindingDraft.upstreamNodeId}
                        onChange={(event) => setFlowBindingDraft((current) => ({ ...current, upstreamNodeId: event.target.value }))}
                        className="w-full rounded-[22px] border border-stone-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none"
                      >
                        <option value="">Optional upstream node</option>
                        {selectedPipelineNodes.map((node) => (
                          <option key={`upstream-${node.id}`} value={node.id}>{formatPipelineNodeLabel(node)}</option>
                        ))}
                      </select>
                      <select
                        value={flowBindingDraft.downstreamNodeId}
                        onChange={(event) => setFlowBindingDraft((current) => ({ ...current, downstreamNodeId: event.target.value }))}
                        className="w-full rounded-[22px] border border-stone-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none"
                      >
                        <option value="">Optional downstream node</option>
                        {selectedPipelineNodes.map((node) => (
                          <option key={`downstream-${node.id}`} value={node.id}>{formatPipelineNodeLabel(node)}</option>
                        ))}
                      </select>
                    </>
                  )}
                  {selectedPipeline ? (
                    <div className="rounded-[22px] border border-stone-200 bg-white px-4 py-3 text-xs text-slate-600">
                      {selectedPipeline.notebook_node_count
                        ? `${selectedPipeline.notebook_node_count} notebook nodes already exist in this flow. Replace one to keep the graph stable, or add a new notebook node between existing steps.`
                        : 'No notebook nodes exist in this flow yet. Create a new notebook node or replace an existing step.'}
                    </div>
                  ) : null}
                  <button
                    onClick={handleAttachToFlow}
                    disabled={!canBindToFlow || busyKey === 'bind-flow'}
                    className="w-full rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                  >
                    {busyKey === 'bind-flow' ? 'Binding...' : 'Bind notebook to flow'}
                  </button>
                </div>
                <button
                  onClick={() =>
                    router.push(
                      buildWorkspaceHref('/flow', { projectId: activeProjectId, workspaceId: activeWorkspaceId }, {
                        notebook: selectedNotebookId || undefined,
                        pipeline: flowBindingDraft.pipelineId || undefined,
                      }),
                    )
                  }
                  className="mt-4 rounded-[22px] border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-stone-50"
                >
                  Open Flow Builder
                </button>
              </div>

              {execution.runId ? (
                <div className="rounded-[24px] border border-stone-200 bg-stone-50/80 p-4 text-sm text-slate-600 shadow-[0_12px_28px_rgba(148,163,184,0.08)]">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-stone-500">Shared runtime</span>
                    <StatusPill status={activeRunStatus || 'queued'} />
                  </div>
                  <div className="mt-3 text-slate-900">Run {execution.runId}</div>
                  <div className="mt-2 text-slate-600">Transient pipeline {execution.pipelineId || 'pending'} keeps notebook runs inside the same runtime model as Flow Builder.</div>
                  <button
                    onClick={() => router.push(buildWorkspaceHref('/runtime', { projectId: activeProjectId, workspaceId: activeWorkspaceId }))}
                    className="mt-4 rounded-[22px] border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-stone-50"
                  >
                    Open Runtime Ops
                  </button>
                </div>
              ) : null}

              <div className="rounded-[24px] border border-stone-200 bg-stone-50/80 p-4 text-sm text-slate-600 shadow-[0_12px_28px_rgba(148,163,184,0.08)]">
                <div className="text-stone-500">Selected dataset</div>
                <div className="mt-2 font-semibold text-slate-900">{selectedDataset?.name || 'No dataset selected'}</div>
                <div className="mt-2 leading-6 text-slate-600">{selectedDataset?.source_path || 'Choose a linked dataset from the left rail to inspect schema and quality signals.'}</div>
                {selectedDataset?.schema?.length ? (
                  <div className="mt-4 space-y-2">
                    {selectedDataset.schema.slice(0, 5).map((column) => (
                      <div key={`${column.name}-${column.type}`} className="flex items-center justify-between rounded-[20px] border border-stone-200 bg-white px-3 py-2 text-xs text-slate-600">
                        <span>{column.name}</span>
                        <span className="font-semibold text-slate-900">{column.type}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
                {selectedDataset ? (
                  <button
                    onClick={() =>
                      router.push(
                        buildWorkspaceHref('/catalog', { projectId: activeProjectId, workspaceId: activeWorkspaceId }, { dataset: selectedDataset.id }),
                      )
                    }
                    className="mt-4 rounded-[22px] border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-stone-50"
                  >
                    Open in Catalog
                  </button>
                ) : null}
              </div>

              <button
                onClick={handleDeleteNotebook}
                disabled={!draftNotebook || busyKey === 'delete'}
                className="rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
              >
                {busyKey === 'delete' ? 'Deleting...' : 'Delete notebook'}
              </button>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-[30px] border border-stone-200/80 bg-white/82 p-5 shadow-[0_18px_44px_rgba(148,163,184,0.12)]">
              <div className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Output rail</div>
              <div className="mt-2 text-lg font-semibold text-slate-900">Selected cell results</div>
              <div className="mt-4 space-y-3">
                {selectedCell?.outputs?.length ? (
                  selectedCell.outputs.map((output, index) => (
                    <pre key={`${selectedCell.id}-${index}`} className="overflow-x-auto whitespace-pre-wrap rounded-[24px] border border-stone-200 bg-stone-50 p-4 text-sm text-slate-700">
                      {JSON.stringify(output, null, 2)}
                    </pre>
                  ))
                ) : (
                  <EmptyState message="Run a code cell to populate the output rail with execution results." />
                )}
              </div>
            </div>

            <div className="rounded-[30px] border border-stone-200/80 bg-white/82 p-5 shadow-[0_18px_44px_rgba(148,163,184,0.12)]">
              <div className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Notebook events</div>
              <div className="mt-2 text-lg font-semibold text-slate-900">Runtime and action feed</div>

              {execution.runId ? (
                <div className="mt-4 rounded-[24px] border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-slate-600">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-slate-900">Run {execution.runId}</div>
                    <StatusPill status={activeRunStatus || 'queued'} />
                  </div>
                  <div className="mt-2 text-xs text-slate-500">{execution.pipelineId ? `Pipeline ${execution.pipelineId}` : 'Awaiting pipeline metadata'}</div>
                </div>
              ) : null}

              <div className="mt-4 space-y-3">
                {recentRuntimeLogs.length ? (
                  recentRuntimeLogs.map((log) => (
                    <div key={log.id || log.cursor} className="rounded-[24px] border border-stone-200 bg-stone-50 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-slate-900">{log.level || 'info'}</div>
                        <div className="text-xs text-slate-500">{log.created_at || log.timestamp || 'runtime'}</div>
                      </div>
                      <div className="mt-2 text-sm leading-6 text-slate-600">{log.message}</div>
                    </div>
                  ))
                ) : events.length ? (
                  events.map((event) => (
                    <div key={event.id} className="rounded-[24px] border border-stone-200 bg-stone-50 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-slate-900">{event.title}</div>
                        <div className="text-xs text-slate-500">{event.createdAt}</div>
                      </div>
                      <div className="mt-2 text-sm leading-6 text-slate-600">{event.detail}</div>
                    </div>
                  ))
                ) : (
                  <EmptyState message="Notebook events appear here after saves, runs, notebook creation, and export actions." />
                )}
              </div>
            </div>
          </div>
        </div>
      </PlatformPanel>
    </PlatformShell>
  );
}
