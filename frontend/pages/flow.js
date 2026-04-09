import { useRouter } from 'next/router';
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';

import DAGEditor from '../components/DAGEditor';
import FlowAuthoringPanel from '../components/flow/FlowAuthoringPanel';
import FlowInspectorPanel from '../components/flow/FlowInspectorPanel';
import FlowNodePalette from '../components/flow/FlowNodePalette';
import FlowToolbar from '../components/flow/FlowToolbar';
import ProjectWorkspaceContext from '../components/ProjectWorkspaceContext';
import PlatformShell, { EmptyState, MetricTile, PlatformPanel, StatusPill } from '../components/PlatformShell';
import WorkflowGuide from '../components/WorkflowGuide';
import {
  FLOW_INTERACTIONS,
  buildUnifiedFlowDag,
  summarizeNodeKinds,
} from '../lib/platformExperience';
import { buildWorkspaceHref, useProjectWorkspace } from '../lib/projectWorkspace';
import {
  FLOW_API_INTEGRATION_POINTS,
  FLOW_COMPONENT_STRUCTURE,
  FLOW_EDGE_BEHAVIORS,
  FLOW_EVENT_SYSTEM,
  FLOW_LAYOUT_BLUEPRINT,
  FLOW_STATE_MODEL,
  buildFlowExecutionState,
  buildInspectorModel,
  createFlowEvent,
  createInitialFlowUiState,
  flowUiReducer,
  getFlowSelectionState,
  isFlowRunActive,
  summarizeExecutionStates,
} from '../lib/flowBuilder';
import {
  createInitialFlowAuthoringState,
  createNodeFromDefinition,
  flowAuthoringReducer,
  getGraphIssueCounts,
  getNodeDefinition,
  getNodeValidation,
  validateDraftGraphLocally,
} from '../lib/flowAuthoring';
import { clearFlowDraft, loadFlowDraft, saveFlowDraft } from '../lib/workspaceState';
import { extractItems, toErrorMessage } from '../lib/platform';
import {
  createPipeline,
  getRunStatus,
  listCatalogDatasets,
  listDeployments,
  listExperiments,
  listNotebooks,
  listPipelineNodeCatalog,
  listPipelineRuns,
  listRunLogs,
  listRunNodes,
  runPipeline,
  updatePipeline,
  validatePipelineGraph,
} from '../services/api';

function summarizeValidationOverlay(nodes = []) {
  return nodes.reduce(
    (summary, node) => {
      if (node.validationStatus === 'pass') {
        summary.pass += 1;
      } else if (node.validationStatus === 'fail') {
        summary.fail += 1;
      } else if (node.validationStatus === 'pending') {
        summary.pending += 1;
      }
      return summary;
    },
    { pass: 0, fail: 0, pending: 0 },
  );
}

function uniqueItems(values) {
  return [...new Set(values.filter(Boolean))];
}

function createEmptyRuntimeTelemetry() {
  return {
    runNodes: [],
    nodeLogsByNodeId: {},
    nodeLogCursorByNodeId: {},
  };
}

function mergeLogEntries(existingLogs = [], nextLogs = []) {
  const merged = new Map();
  [...existingLogs, ...nextLogs].forEach((log) => {
    const key = log?.id || log?.cursor || `${log?.level || 'info'}-${log?.created_at || log?.timestamp || 'log'}-${log?.message || ''}`;
    if (!key) {
      return;
    }
    merged.set(key, log);
  });
  return [...merged.values()];
}

function pipelineKeyForView(viewMode) {
  return `${viewMode}_pipeline`;
}

function pipelineNameForView(viewMode) {
  return `nexora-${viewMode}-flow`;
}

function firstValidationMessage(validation) {
  return validation?.errors?.[0]?.message || validation?.warnings?.[0]?.message || '';
}

export default function FlowPage() {
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
  const [workspace, setWorkspace] = useState({
    flowDraft: null,
    datasets: [],
    notebooks: [],
    deployments: [],
    experiments: [],
    runs: [],
  });
  const [pipelineId, setPipelineId] = useState('');
  const [runtimeTelemetry, setRuntimeTelemetry] = useState(() => createEmptyRuntimeTelemetry());
  const logCursorRef = useRef({});
  const [uiState, dispatch] = useReducer(flowUiReducer, undefined, () => createInitialFlowUiState('converted'));
  const [authoringState, authoringDispatch] = useReducer(flowAuthoringReducer, undefined, () => createInitialFlowAuthoringState());

  useEffect(() => {
    if (projectWorkspaceLoading) {
      return undefined;
    }

    async function loadWorkspace() {
      try {
        const [datasets, notebooks, deployments, experiments, runs, nodeCatalog] = await Promise.all([
          listCatalogDatasets(undefined, activeProjectId || undefined),
          listNotebooks(activeProjectId || undefined, activeWorkspaceId || undefined),
          listDeployments(),
          listExperiments(activeProjectId || undefined),
          listPipelineRuns(),
          listPipelineNodeCatalog(),
        ]);
        const flowDraft = loadFlowDraft();
        const normalizedWorkspace = {
          flowDraft,
          datasets: extractItems(datasets),
          notebooks: Array.isArray(notebooks) ? notebooks : extractItems(notebooks),
          deployments: extractItems(deployments),
          experiments: extractItems(experiments),
          runs: extractItems(runs),
        };
        const nextViewMode = flowDraft?.converted_pipeline ? 'converted' : flowDraft?.source_pipeline ? 'source' : 'converted';

        setWorkspace(normalizedWorkspace);
        authoringDispatch({ type: 'hydrate-catalog', items: extractItems(nodeCatalog) });
        dispatch({ type: 'hydrate', viewMode: nextViewMode, feedback: '' });
      } catch (error) {
        dispatch({ type: 'set-feedback', feedback: toErrorMessage(error) });
      }
    }

    loadWorkspace();
    return undefined;
  }, [activeProjectId, projectWorkspaceLoading]);

  useEffect(() => {
    const nextPipelineId = workspace.flowDraft?.[pipelineKeyForView(uiState.viewMode)]?.pipeline_id || '';
    setPipelineId(nextPipelineId);
  }, [uiState.viewMode, workspace.flowDraft]);

  useEffect(() => {
    if (!uiState.selectedRunId) {
      logCursorRef.current = {};
      setRuntimeTelemetry(createEmptyRuntimeTelemetry());
      return undefined;
    }

    let cancelled = false;

    async function syncRunTelemetry() {
      try {
        const [nextRun, nextRunNodes] = await Promise.all([getRunStatus(uiState.selectedRunId), listRunNodes(uiState.selectedRunId)]);
        if (cancelled) {
          return;
        }
        dispatch({ type: 'run-updated', run: nextRun });
        setRuntimeTelemetry((current) => ({
          ...current,
          runNodes: extractItems(nextRunNodes),
        }));
        if (!isFlowRunActive(nextRun)) {
          const refreshedRuns = await listPipelineRuns();
          if (cancelled) {
            return;
          }
          setWorkspace((current) => ({ ...current, runs: extractItems(refreshedRuns) }));
        }
      } catch (error) {
        if (!cancelled) {
          dispatch({ type: 'set-feedback', feedback: toErrorMessage(error) });
        }
      }
    }

    logCursorRef.current = {};
    setRuntimeTelemetry(createEmptyRuntimeTelemetry());
    syncRunTelemetry();
    const handle = window.setInterval(syncRunTelemetry, 2200);

    return () => {
      cancelled = true;
      window.clearInterval(handle);
    };
  }, [uiState.selectedRunId]);

  useEffect(() => {
    if (!uiState.runState || !isFlowRunActive(uiState.runState)) {
      return undefined;
    }

    const handle = window.setInterval(() => {
      dispatch({ type: 'tick' });
    }, 1100);

    return () => window.clearInterval(handle);
  }, [uiState.runState]);

  const baseDag = useMemo(
    () =>
      buildUnifiedFlowDag(
        workspace.flowDraft,
        {
          datasets: workspace.datasets,
          notebooks: workspace.notebooks,
          deployments: workspace.deployments,
          experiments: workspace.experiments,
        },
        uiState.viewMode,
      ),
    [uiState.viewMode, workspace.datasets, workspace.deployments, workspace.experiments, workspace.flowDraft, workspace.notebooks],
  );
  const baseDagHash = useMemo(() => JSON.stringify(baseDag), [baseDag]);

  useEffect(() => {
    const localValidation = validateDraftGraphLocally(baseDag, authoringState.nodeCatalog);
    authoringDispatch({
      type: 'hydrate-dag',
      dag: baseDag,
      validation: { ...localValidation, sourceHash: baseDagHash },
    });
  }, [authoringState.nodeCatalog, baseDag, baseDagHash]);

  const draftDag = authoringState.draftDag;
  const draftDagHash = useMemo(() => JSON.stringify(draftDag), [draftDag]);
  const localValidation = useMemo(
    () => validateDraftGraphLocally(draftDag, authoringState.nodeCatalog),
    [authoringState.nodeCatalog, draftDag, draftDagHash],
  );
  const effectiveValidation = useMemo(() => {
    if (authoringState.validation?.sourceHash === draftDagHash) {
      return authoringState.validation;
    }
    return { ...localValidation, sourceHash: draftDagHash };
  }, [authoringState.validation, draftDagHash, localValidation]);

  const executionDag = useMemo(
    () => buildFlowExecutionState(draftDag, uiState.runState, uiState.executionTick, { overlayMode: uiState.overlayMode, runNodes: runtimeTelemetry.runNodes }),
    [draftDag, runtimeTelemetry.runNodes, uiState.executionTick, uiState.overlayMode, uiState.runState],
  );

  useEffect(() => {
    if (!executionDag.nodes.length) {
      return;
    }

    const selectionStillExists = executionDag.nodes.some((node) => node.id === uiState.selectedNodeId);
    if (!selectionStillExists) {
      const firstNode = executionDag.nodes[0];
      dispatch({ type: 'select-node', nodeId: firstNode.id, nodeLabel: firstNode.label, silent: true });
    }
  }, [executionDag.nodes, uiState.selectedNodeId]);

  const selectionState = useMemo(() => getFlowSelectionState(uiState.selectedNodeId, executionDag), [executionDag, uiState.selectedNodeId]);
  const selectedNode = selectionState.selectedNode;
  const selectedEdge = useMemo(
    () => draftDag.edges.find((edge) => edge.id === authoringState.selectedEdgeId) || null,
    [authoringState.selectedEdgeId, draftDag.edges],
  );
  const selectedNodeLogs = useMemo(
    () => runtimeTelemetry.nodeLogsByNodeId[selectedNode?.id || ''] || [],
    [runtimeTelemetry.nodeLogsByNodeId, selectedNode?.id],
  );
  const inspector = useMemo(
    () => buildInspectorModel(selectedNode, executionDag, uiState.runState, { logs: selectedNodeLogs }),
    [executionDag, selectedNode, selectedNodeLogs, uiState.runState],
  );
  const nodeKinds = useMemo(() => summarizeNodeKinds(executionDag.nodes), [executionDag.nodes]);
  const executionSummary = useMemo(() => summarizeExecutionStates(executionDag.nodes), [executionDag.nodes]);
  const validationSummary = useMemo(() => summarizeValidationOverlay(executionDag.nodes), [executionDag.nodes]);
  const validationCounts = useMemo(() => getGraphIssueCounts(effectiveValidation), [effectiveValidation]);
  const selectedNodeDefinition = useMemo(
    () => getNodeDefinition(authoringState.nodeCatalog, selectedNode?.kind),
    [authoringState.nodeCatalog, selectedNode?.kind],
  );
  const selectedNodeValidation = useMemo(
    () => getNodeValidation(effectiveValidation, selectedNode?.id),
    [effectiveValidation, selectedNode?.id],
  );

  useEffect(() => {
    if (!uiState.selectedRunId || !selectedNode?.id) {
      return undefined;
    }

    let cancelled = false;

    async function syncSelectedNodeLogs(initialLoad = false) {
      try {
        const afterId = initialLoad ? 0 : logCursorRef.current[selectedNode.id] || 0;
        const payload = await listRunLogs(uiState.selectedRunId, {
          nodeId: selectedNode.id,
          afterId,
          limit: 150,
        });
        if (cancelled) {
          return;
        }
        const incomingLogs = extractItems(payload);
        const nextCursor = payload.cursor || afterId || 0;
        logCursorRef.current = {
          ...logCursorRef.current,
          [selectedNode.id]: nextCursor,
        };
        setRuntimeTelemetry((current) => {
          const existingLogs = initialLoad ? [] : current.nodeLogsByNodeId[selectedNode.id] || [];
          return {
            ...current,
            nodeLogsByNodeId: {
              ...current.nodeLogsByNodeId,
              [selectedNode.id]: initialLoad ? incomingLogs : mergeLogEntries(existingLogs, incomingLogs),
            },
            nodeLogCursorByNodeId: {
              ...current.nodeLogCursorByNodeId,
              [selectedNode.id]: nextCursor,
            },
          };
        });
      } catch (error) {
        if (!cancelled) {
          dispatch({ type: 'set-feedback', feedback: toErrorMessage(error) });
        }
      }
    }

    syncSelectedNodeLogs(true);
    const handle = window.setInterval(() => syncSelectedNodeLogs(false), 1800);

    return () => {
      cancelled = true;
      window.clearInterval(handle);
    };
  }, [selectedNode?.id, uiState.selectedRunId]);

  const highlightedNodeIds = useMemo(
    () => uniqueItems([...selectionState.highlightedNodeIds, ...executionDag.nodes.filter((node) => node.pathState === 'failed').map((node) => node.id)]),
    [executionDag.nodes, selectionState.highlightedNodeIds],
  );
  const highlightedEdgeIds = useMemo(
    () => uniqueItems([
      ...selectionState.highlightedEdgeIds,
      ...executionDag.edges.filter((edge) => edge.isFailurePath).map((edge) => edge.id),
      selectedEdge?.id,
    ]),
    [executionDag.edges, selectedEdge?.id, selectionState.highlightedEdgeIds],
  );

  const activeRuns = useMemo(() => workspace.runs.filter(isFlowRunActive), [workspace.runs]);
  const visibleRuns = useMemo(() => {
    const items = new Map();
    [uiState.runState, ...workspace.runs].filter(Boolean).forEach((run) => {
      const key = run.id || run.run_id;
      if (!key) {
        return;
      }
      items.set(key, { ...run, id: run.id || run.run_id });
    });
    return [...items.values()];
  }, [uiState.runState, workspace.runs]);

  const hasSourceFlow = Boolean(workspace.flowDraft?.source_pipeline) || !workspace.flowDraft;
  const hasConvertedFlow = Boolean(workspace.flowDraft?.converted_pipeline) || !workspace.flowDraft;

  function buildProjectScopedHref(pathname, extraQuery = {}) {
    return buildWorkspaceHref(pathname, { projectId: activeProjectId, workspaceId: activeWorkspaceId }, extraQuery);
  }

  const selectedNodeActions = useMemo(() => {
    if (!selectedNode) {
      return [];
    }

    const actionsByKind = {
      dataset: [
        { label: 'Open in Jupyter workspace', action: () => router.push(buildProjectScopedHref('/notebooks', { dataset: selectedNode.id })) },
        { label: 'Inspect lineage in catalog', action: () => router.push(buildProjectScopedHref('/catalog')) },
      ],
      recipe: [
        {
          label: 'Edit recipe in Jupyter workspace',
          action: () => router.push(buildProjectScopedHref('/notebooks', { node: selectedNode.id, pipeline: pipelineId || undefined })),
        },
        { label: 'Review runtime context', action: () => router.push(buildProjectScopedHref('/runtime')) },
      ],
      notebook: [
        {
          label: 'Open Jupyter workspace',
          action: () =>
            router.push(
              buildProjectScopedHref('/notebooks', {
                node: selectedNode.id,
                pipeline: pipelineId || undefined,
                notebook: selectedNode.config?.notebook_id || undefined,
              })
            ),
        },
        { label: 'Inspect promotion chain', action: () => router.push(buildProjectScopedHref('/runtime')) },
      ],
      model: [
        { label: 'Inspect ML runs', action: () => router.push(buildProjectScopedHref('/ml')) },
        { label: 'Review deployment candidate', action: () => router.push(buildProjectScopedHref('/runtime')) },
      ],
      validation: [
        { label: 'Open data quality context', action: () => router.push(buildProjectScopedHref('/catalog')) },
        { label: 'Review operator logs', action: () => router.push(buildProjectScopedHref('/runtime')) },
      ],
      deploy: [
        { label: 'Open runtime console', action: () => router.push(buildProjectScopedHref('/runtime')) },
        { label: 'Inspect rollout target', action: () => router.push(buildProjectScopedHref('/runtime')) },
      ],
    };

    return actionsByKind[selectedNode.kind] || [];
  }, [activeProjectId, activeWorkspaceId, pipelineId, router, selectedNode]);

  function buildScopedDag(dag) {
    const nextDag = dag && typeof dag === 'object' ? dag : { nodes: [], edges: [] };
    const metadata = nextDag.metadata && typeof nextDag.metadata === 'object' ? nextDag.metadata : {};
    return {
      ...nextDag,
      metadata: {
        ...metadata,
        ...(activeProjectId ? { project_id: activeProjectId } : {}),
        ...((activeProjectId || activeProject?.name || metadata.project)
          ? {
              project: {
                ...(metadata.project && typeof metadata.project === 'object' ? metadata.project : {}),
                ...(activeProjectId ? { id: activeProjectId } : {}),
                ...(activeProject?.name ? { name: activeProject.name } : {}),
              },
            }
          : {}),
        ...(activeWorkspaceId ? { workspace_id: activeWorkspaceId } : {}),
        ...((activeWorkspaceId || metadata.workspace)
          ? {
              workspace: {
                ...(metadata.workspace && typeof metadata.workspace === 'object' ? metadata.workspace : {}),
                ...(activeWorkspaceId ? { id: activeWorkspaceId } : {}),
              },
            }
          : {}),
      },
    };
  }

  function persistDraftGraphToWorkspace(nextDag, nextPipelineId = pipelineId) {
    const pipelineKey = pipelineKeyForView(uiState.viewMode);
    const scopedDag = buildScopedDag(nextDag);
    setWorkspace((current) => {
      const nextDraft = {
        ...(current.flowDraft || {}),
        [pipelineKey]: {
          ...(current.flowDraft?.[pipelineKey] || {}),
          pipeline_id: nextPipelineId || current.flowDraft?.[pipelineKey]?.pipeline_id || '',
          dag: scopedDag,
        },
      };
      saveFlowDraft(nextDraft);
      return { ...current, flowDraft: nextDraft };
    });
  }

  async function runBackendValidation(dag = authoringState.draftDag) {
    const scopedDag = buildScopedDag(dag);
    const validation = await validatePipelineGraph(scopedDag);
    const taggedValidation = {
      ...validation,
      origin: 'backend',
      sourceHash: JSON.stringify(scopedDag),
    };
    authoringDispatch({ type: 'set-validation', validation: taggedValidation });
    return taggedValidation;
  }

  async function persistPipelineGraph() {
    const validation = await runBackendValidation();
    if (!validation.valid) {
      throw new Error(firstValidationMessage(validation) || 'Graph validation failed.');
    }

    const normalizedDag = buildScopedDag(validation.normalized_dag || authoringState.draftDag);
    const nextPipelineName = pipelineNameForView(uiState.viewMode);
    const response = pipelineId
      ? await updatePipeline(pipelineId, normalizedDag, nextPipelineName, { projectId: activeProjectId, projectName: activeProject?.name, workspaceId: activeWorkspaceId })
      : await createPipeline(normalizedDag, nextPipelineName, { projectId: activeProjectId, projectName: activeProject?.name, workspaceId: activeWorkspaceId });
    const nextPipelineId = response.pipeline_id || pipelineId;
    const normalizedValidation = {
      ...validation,
      sourceHash: JSON.stringify(normalizedDag),
    };

    setPipelineId(nextPipelineId);
    persistDraftGraphToWorkspace(normalizedDag, nextPipelineId);
    authoringDispatch({ type: 'replace-dag', dag: normalizedDag, validation: normalizedValidation });
    dispatch({
      type: 'append-event',
      event: createFlowEvent('flow.graph.saved', `Saved ${uiState.viewMode} flow`, 'The draft DAG was normalized, validated, and persisted to the backend pipeline record.', {
        pipelineId: nextPipelineId,
      }),
    });
    return nextPipelineId;
  }

  function handleAddNode(kind) {
    const definition = getNodeDefinition(authoringState.nodeCatalog, kind);
    const nextNode = createNodeFromDefinition(definition, authoringState.draftDag.nodes.length);
    if (!nextNode) {
      return;
    }

    authoringDispatch({ type: 'add-node', node: nextNode });
    authoringDispatch({ type: 'select-edge', edgeId: '' });
    dispatch({ type: 'select-node', nodeId: nextNode.id, nodeLabel: nextNode.label });
    dispatch({
      type: 'append-event',
      event: createFlowEvent('flow.node.created', `${definition?.label || kind} added`, 'A new authoring node was added to the current DAG draft.', { kind }),
    });
  }

  function handleNodeMetaChange(updates) {
    if (!selectedNode) {
      return;
    }
    authoringDispatch({ type: 'update-node', nodeId: selectedNode.id, updates });
  }

  function handleNodeConfigChange(fieldName, value) {
    if (!selectedNode) {
      return;
    }
    authoringDispatch({
      type: 'update-node',
      nodeId: selectedNode.id,
      updates: { config: { [fieldName]: value } },
    });
  }

  function handleDeleteNode(nodeId) {
    authoringDispatch({ type: 'delete-node', nodeId });
    authoringDispatch({ type: 'select-edge', edgeId: '' });
    dispatch({ type: 'select-node', nodeId: '', nodeLabel: '', silent: true });
    dispatch({
      type: 'append-event',
      event: createFlowEvent('flow.node.deleted', `Removed ${nodeId}`, 'The node and its connected edges were removed from the DAG draft.'),
    });
  }

  function handleConnectEdge(connection) {
    if (!connection?.source || !connection?.target) {
      return;
    }
    const nextEdgeId = `${connection.source}__${connection.target}`;
    authoringDispatch({
      type: 'add-edge',
      edge: {
        id: nextEdgeId,
        source: connection.source,
        target: connection.target,
        flowKind: 'data',
      },
    });
    authoringDispatch({ type: 'select-edge', edgeId: nextEdgeId });
    dispatch({ type: 'select-node', nodeId: '', nodeLabel: '', silent: true });
    dispatch({
      type: 'append-event',
      event: createFlowEvent('flow.edge.connected', `Connected ${connection.source} to ${connection.target}`, 'A new edge was added to the draft graph.'),
    });
  }

  function handleDeleteEdge(edgeId) {
    authoringDispatch({ type: 'delete-edge', edgeId });
    dispatch({
      type: 'append-event',
      event: createFlowEvent('flow.edge.deleted', `Removed ${edgeId}`, 'The selected edge was deleted from the draft graph.'),
    });
  }

  function handleValidateGraph() {
    authoringDispatch({ type: 'set-busy-key', busyKey: 'validate' });
    Promise.resolve()
      .then(async () => {
        const validation = await runBackendValidation();
        dispatch({
          type: 'append-event',
          event: createFlowEvent(
            'flow.graph.validated',
            validation.valid ? 'Graph validation passed' : 'Graph validation failed',
            validation.valid
              ? 'The backend contract accepted the current DAG draft and returned normalized execution bindings.'
              : firstValidationMessage(validation) || 'Validation reported one or more graph issues.',
          ),
        });
        dispatch({
          type: 'set-feedback',
          feedback: validation.valid ? 'Graph validation passed. Execution bindings are aligned with the backend contract.' : firstValidationMessage(validation),
        });
      })
      .catch((error) => {
        dispatch({ type: 'set-feedback', feedback: toErrorMessage(error) });
      })
      .finally(() => {
        authoringDispatch({ type: 'set-busy-key', busyKey: '' });
      });
  }

  function handleSaveGraph() {
    authoringDispatch({ type: 'set-busy-key', busyKey: 'save' });
    Promise.resolve()
      .then(async () => {
        const nextPipelineId = await persistPipelineGraph();
        dispatch({ type: 'set-feedback', feedback: `Saved flow graph to pipeline ${nextPipelineId}.` });
      })
      .catch((error) => {
        dispatch({ type: 'set-feedback', feedback: toErrorMessage(error) });
      })
      .finally(() => {
        authoringDispatch({ type: 'set-busy-key', busyKey: '' });
      });
  }

  async function handleRunFlow() {
    dispatch({ type: 'set-busy-key', busyKey: 'run' });
    try {
      const ensuredPipelineId = await persistPipelineGraph();
      const started = await runPipeline(ensuredPipelineId, {
        initiated_from: 'flow-builder',
        view_mode: uiState.viewMode,
        overlay_mode: uiState.overlayMode,
      });
      dispatch({
        type: 'run-started',
        run: { ...started, id: started.run_id, pipeline_id: ensuredPipelineId, status: started.status },
        feedback: `Flow run ${started.run_id} started from the canvas.`,
        eventTitle: `Run ${started.run_id} started`,
        eventDetail: 'The execution overlay is now streaming live graph state.',
      });
    } catch (error) {
      dispatch({ type: 'set-feedback', feedback: toErrorMessage(error) });
    } finally {
      dispatch({ type: 'set-busy-key', busyKey: '' });
    }
  }

  async function handleRetryFromNode() {
    if (!selectedNode) {
      return;
    }

    dispatch({ type: 'set-busy-key', busyKey: 'retry' });
    try {
      const ensuredPipelineId = await persistPipelineGraph();
      const started = await runPipeline(ensuredPipelineId, {
        initiated_from: 'flow-builder',
        view_mode: uiState.viewMode,
        overlay_mode: uiState.overlayMode,
        retry_from_node: selectedNode.id,
      });
      dispatch({
        type: 'run-started',
        run: {
          ...started,
          id: started.run_id,
          pipeline_id: ensuredPipelineId,
          status: started.status,
          run_metadata: { retry_from_node: selectedNode.id },
        },
        feedback: `Retry launched from ${selectedNode.label}.`,
        eventType: 'flow.retry.from-node',
        eventTitle: `Retry started from ${selectedNode.label}`,
        eventDetail: 'The failure boundary was reset at the selected node and downstream execution restarted.',
      });
    } catch (error) {
      dispatch({ type: 'set-feedback', feedback: toErrorMessage(error) });
    } finally {
      dispatch({ type: 'set-busy-key', busyKey: '' });
    }
  }

  async function handlePromoteFlow() {
    dispatch({ type: 'set-busy-key', busyKey: 'promote' });
    try {
      const ensuredPipelineId = await persistPipelineGraph();
      dispatch({
        type: 'set-feedback',
        feedback: `Pipeline ${ensuredPipelineId} is the promoted production flow candidate. Deploy nodes remain the release boundary for Runtime Ops.`,
      });
    } catch (error) {
      dispatch({ type: 'set-feedback', feedback: toErrorMessage(error) });
    } finally {
      dispatch({ type: 'set-busy-key', busyKey: '' });
    }
  }

  function handleClearDraft() {
    clearFlowDraft();
    setPipelineId('');
    setWorkspace((current) => ({ ...current, flowDraft: null }));
    dispatch({
      type: 'clear-draft',
      feedback: 'Cleared the saved migration draft. The canvas now shows the fallback unified flow model until a new migration is created.',
    });
  }

  return (
    <PlatformShell
      eyebrow="Flow Builder"
      title="Use one execution-aware DAG as the single source of truth for datasets, transformations, notebooks, models, validation, and deployment."
      description="Migration output lands here automatically, notebooks remain first-class nodes, validation is an overlay instead of a separate page, and runtime state streams through the same graph that defines production flow."
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
      actions={uiState.feedback ? <div className="rounded-2xl border border-stone-200 bg-white/80 px-4 py-3 text-sm text-slate-600">{uiState.feedback}</div> : null}
    >
      <WorkflowGuide
        currentStep="flow"
        context={projectNavigationContext}
        counts={{
          projects: activeProjectId ? 1 : 0,
          workspaces: activeWorkspaceId ? 1 : 0,
          datasets: workspace.datasets.length,
          notebooks: workspace.notebooks.length,
          pipelines: pipelineId || workspace.flowDraft ? 1 : 0,
          runs: visibleRuns.length,
        }}
        selectedNotebookId={selectedNode?.config?.notebook_id || ''}
        pipelineId={pipelineId}
        primaryAction={{
          label: 'Open Runtime Ops',
          href: buildProjectScopedHref('/runtime'),
        }}
        secondaryAction={{
          label: 'Open Jupyter workspace',
          href: buildProjectScopedHref('/notebooks', {
            notebook: selectedNode?.config?.notebook_id || undefined,
            pipeline: pipelineId || undefined,
          }),
          tone: 'secondary',
        }}
        title="Flow Builder should feed execution without a context break"
        description="Once assets are bound into a graph, the next operator surface should be explicit. Use Flow Builder as the orchestration center, then move straight into runtime inspection or back into notebook authoring with the same scoped context."
      />

      <PlatformPanel title="Flow workspace summary" description="Flow Builder is now the system of record. The same graph defines node taxonomy, edge semantics, validation posture, authoring state, and live execution state.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-8">
          <MetricTile label="Datasets" value={nodeKinds.dataset || 0} detail="Source and target assets inside the same graph." />
          <MetricTile label="Transformations" value={nodeKinds.recipe || 0} detail="Conversion logic and recipes wired into the DAG." />
          <MetricTile label="Notebook Nodes" value={nodeKinds.notebook || 0} detail="Notebook-first engineering stays in flow." />
          <MetricTile label="Validation Gates" value={nodeKinds.validation || 0} detail="Quality and parity remain on-graph." />
          <MetricTile label="Draft Errors" value={validationCounts.errors || 0} detail="Blocking config or graph issues in the current draft." />
          <MetricTile label="Completed" value={executionSummary.success || 0} detail="Nodes completed in the current execution overlay." />
          <MetricTile label="Failed" value={executionSummary.failed || 0} detail="Failure boundaries highlighted in red." />
          <MetricTile label="Active Runs" value={activeRuns.length} detail="Live flow executions visible from this workspace." />
        </div>
      </PlatformPanel>

      <PlatformPanel title="Unified flow canvas" description="Canvas, toolbar, palette, and side panels now act as one authoring surface: create nodes, connect edges, validate config, persist the DAG, run it, retry from a node, and inspect runtime state without leaving the graph.">
        <FlowToolbar
          viewMode={uiState.viewMode}
          overlayMode={uiState.overlayMode}
          hasSourceFlow={hasSourceFlow}
          hasConvertedFlow={hasConvertedFlow}
          pipelineId={pipelineId}
          runState={uiState.runState}
          busyKey={uiState.busyKey}
          authoringBusyKey={authoringState.busyKey}
          hasNodes={Boolean(executionDag.nodes.length)}
          selectedNode={selectedNode}
          selectedEdge={selectedEdge}
          eventCount={uiState.events.length}
          dirty={authoringState.dirty}
          validationCounts={validationCounts}
          onViewModeChange={(viewMode) => dispatch({ type: 'set-view-mode', viewMode })}
          onOverlayModeChange={(overlayMode) => dispatch({ type: 'set-overlay-mode', overlayMode })}
          onValidateGraph={handleValidateGraph}
          onSaveGraph={handleSaveGraph}
          onRun={handleRunFlow}
          onRetryFromNode={handleRetryFromNode}
          onPromote={handlePromoteFlow}
          onClearDraft={handleClearDraft}
        />

        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.45fr_1.1fr]">
          <div className="space-y-4">
            <FlowNodePalette
              nodeCatalog={authoringState.nodeCatalog}
              nodeKinds={nodeKinds}
              validationCounts={validationCounts}
              dirty={authoringState.dirty}
              onAddNode={handleAddNode}
            />

            <div className="rounded-[28px] border border-stone-200/80 bg-white/82 p-4 shadow-[0_16px_38px_rgba(148,163,184,0.12)]">
              <div className="text-sm font-semibold text-slate-900">Edge behavior</div>
              <div className="mt-3 space-y-3">
                {FLOW_EDGE_BEHAVIORS.map((item) => (
                  <div key={item.kind} className="rounded-[22px] border border-stone-200 bg-stone-50/80 p-3 shadow-[0_12px_28px_rgba(148,163,184,0.08)]">
                    <div className="text-sm font-semibold text-slate-900">{item.label}</div>
                    <div className="mt-2 text-sm leading-6 text-slate-600">{item.description}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[26px] border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 shadow-[0_12px_28px_rgba(16,185,129,0.08)]">
              {workspace.flowDraft
                ? 'Migration Studio handoff detected. Source and converted flow graphs are feeding the same editable canvas, and backend validation now normalizes both into one execution contract.'
                : 'No migration draft is loaded. The canvas is showing the fallback unified flow model so node authoring can still start from the platform taxonomy.'}
            </div>

            <div className="rounded-[26px] border border-sky-200 bg-sky-50 p-4 text-sm text-sky-700 shadow-[0_12px_28px_rgba(125,211,252,0.12)]">
              Validation overlay status: {validationSummary.pass} pass, {validationSummary.fail} fail, {validationSummary.pending} pending. Draft graph: {validationCounts.errors} errors and {validationCounts.warnings} warnings.
            </div>
          </div>

          <div className="rounded-[30px] border border-stone-200/80 bg-white/82 p-5 shadow-[0_18px_44px_rgba(148,163,184,0.12)]">
            {executionDag.nodes.length ? (
              <DAGEditor
                dagJson={executionDag}
                onNodeSelect={(nodeId) => {
                  const node = executionDag.nodes.find((item) => item.id === nodeId);
                  authoringDispatch({ type: 'select-edge', edgeId: '' });
                  dispatch({ type: 'select-node', nodeId, nodeLabel: node?.label || nodeId });
                }}
                onEdgeSelect={(edgeId) => {
                  authoringDispatch({ type: 'select-edge', edgeId });
                  dispatch({ type: 'select-node', nodeId: '', nodeLabel: '', silent: true });
                }}
                onConnect={handleConnectEdge}
                onCanvasClick={() => {
                  authoringDispatch({ type: 'select-edge', edgeId: '' });
                  dispatch({ type: 'select-node', nodeId: '', nodeLabel: '', silent: true });
                }}
                onNodePositionChange={(nodeId, position) => authoringDispatch({ type: 'move-node', nodeId, position })}
                selectedNodeId={selectedNode?.id || uiState.selectedNodeId}
                selectedEdgeId={selectedEdge?.id || ''}
                highlightedNodeIds={highlightedNodeIds}
                highlightedEdgeIds={highlightedEdgeIds}
                overlayMode={uiState.overlayMode}
                editable
                heightClass="h-[42rem]"
              />
            ) : (
              <EmptyState
                title="No flow graph available"
                message="Create one in Migration Studio or keep using the fallback operational flow model."
                detail="Once a graph exists, this canvas becomes the single place for authoring, validation, and runtime overlays."
              />
            )}
          </div>

          <div className="space-y-6">
            <FlowAuthoringPanel
              selectedNode={selectedNode}
              selectedEdge={selectedEdge}
              nodeDefinition={selectedNodeDefinition}
              nodeValidation={selectedNodeValidation}
              onNodeMetaChange={handleNodeMetaChange}
              onNodeConfigChange={handleNodeConfigChange}
              onDeleteNode={handleDeleteNode}
              onEdgeChange={(updates) => selectedEdge && authoringDispatch({ type: 'update-edge', edgeId: selectedEdge.id, updates })}
              onDeleteEdge={handleDeleteEdge}
            />

            <div className="rounded-[30px] border border-stone-200/80 bg-white/82 p-5 shadow-[0_18px_44px_rgba(148,163,184,0.12)]">
              <FlowInspectorPanel
                selectedNode={selectedNode}
                inspector={inspector}
                inspectorTab={uiState.inspectorTab}
                onInspectorTabChange={(tabId) => dispatch({ type: 'set-inspector-tab', tabId })}
                actions={selectedNodeActions}
                onNodeJump={(nodeId) => {
                  const node = executionDag.nodes.find((item) => item.id === nodeId);
                  authoringDispatch({ type: 'select-edge', edgeId: '' });
                  dispatch({ type: 'select-node', nodeId, nodeLabel: node?.label || nodeId });
                }}
                onRetryFromNode={handleRetryFromNode}
              />
            </div>
          </div>
        </div>
      </PlatformPanel>

      <PlatformPanel title="Interaction model and live execution" description="The graph is not just static design metadata anymore. It acts as the real operator surface for execution state, failure investigation, retry behavior, and authoring events.">
        <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr_1fr]">
          <div className="space-y-4 rounded-[30px] border border-stone-200/80 bg-white/82 p-5 shadow-[0_18px_44px_rgba(148,163,184,0.12)]">
            <div className="text-lg font-semibold text-slate-900">Flow interactions</div>
            {FLOW_INTERACTIONS.map((item) => (
              <div key={item.label} className="rounded-[24px] border border-stone-200 bg-stone-50/80 p-4 shadow-[0_12px_28px_rgba(148,163,184,0.08)]">
                <div className="text-sm font-semibold text-slate-900">{item.label}</div>
                <div className="mt-2 text-sm leading-6 text-slate-600">{item.description}</div>
              </div>
            ))}
          </div>

          <div className="space-y-4 rounded-[30px] border border-stone-200/80 bg-white/82 p-5 shadow-[0_18px_44px_rgba(148,163,184,0.12)]">
            <div className="flex items-center justify-between gap-3">
              <div className="text-lg font-semibold text-slate-900">Latest pipeline runs</div>
              <StatusPill status={uiState.runState?.status || (activeRuns.length ? 'running' : 'idle')} />
            </div>
            {visibleRuns.length ? (
              visibleRuns.slice(0, 8).map((run) => (
                <button
                  key={run.id}
                  onClick={() => dispatch({ type: 'select-run', run })}
                  className={`w-full rounded-[24px] border p-4 text-left transition ${
                    uiState.selectedRunId === run.id
                      ? 'border-sky-200 bg-sky-50 shadow-[0_14px_32px_rgba(125,211,252,0.18)]'
                      : 'border-stone-200 bg-stone-50/80 hover:border-stone-300 hover:bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{run.pipeline_id || pipelineId || 'Flow pipeline'}</div>
                      <div className="mt-1 text-xs text-slate-500">Run {run.id}</div>
                    </div>
                    <StatusPill status={run.status} />
                  </div>
                  <div className="mt-3 text-xs text-slate-500">Started {run.started_at || run.created_at || 'pending'} · Updated {run.updated_at || 'n/a'}</div>
                </button>
              ))
            ) : (
              <EmptyState
                title="No flow runs yet"
                message="Validate and save the graph, then launch the flow or retry from a node to populate execution state."
                detail="Runtime cards stay empty until the DAG has been persisted and at least one execution record exists."
              />
            )}
          </div>

          <div className="space-y-4 rounded-[30px] border border-stone-200/80 bg-white/82 p-5 shadow-[0_18px_44px_rgba(148,163,184,0.12)]">
            <div className="text-lg font-semibold text-slate-900">Event activity stream</div>
            {uiState.events.length ? (
              uiState.events.map((event) => (
                <div key={event.id} className="rounded-[24px] border border-stone-200 bg-stone-50/80 p-4 shadow-[0_12px_28px_rgba(148,163,184,0.08)]">
                  <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.22em] text-stone-500">
                    <span>{event.type}</span>
                    <span>{event.timestamp}</span>
                  </div>
                  <div className="mt-3 text-sm font-semibold text-slate-900">{event.title}</div>
                  <div className="mt-2 text-sm leading-6 text-slate-600">{event.detail}</div>
                </div>
              ))
            ) : (
              <EmptyState message="Mode switches, authoring actions, run launches, and retries appear here as Flow Builder events." />
            )}
          </div>
        </div>
      </PlatformPanel>

      <PlatformPanel title="Flow Builder architecture output" description="This page now publishes the component structure, state management design, event system, layout model, and API integration points that define Flow Builder as the platform source of truth.">
        <div className="grid gap-6 xl:grid-cols-2">
          <div className="space-y-4 rounded-[30px] border border-stone-200/80 bg-white/82 p-5 shadow-[0_18px_44px_rgba(148,163,184,0.12)]">
            <div className="text-lg font-semibold text-slate-900">React component structure</div>
            {FLOW_COMPONENT_STRUCTURE.map((item) => (
              <div key={item.name} className="rounded-[24px] border border-stone-200 bg-stone-50/80 p-4 shadow-[0_12px_28px_rgba(148,163,184,0.08)]">
                <div className="text-sm font-semibold text-slate-900">{item.name}</div>
                <div className="mt-2 text-sm leading-6 text-slate-600">{item.role}</div>
              </div>
            ))}
          </div>

          <div className="space-y-4 rounded-[30px] border border-stone-200/80 bg-white/82 p-5 shadow-[0_18px_44px_rgba(148,163,184,0.12)]">
            <div className="text-lg font-semibold text-slate-900">State management design</div>
            {FLOW_STATE_MODEL.map((item) => (
              <div key={item.slice} className="rounded-[24px] border border-stone-200 bg-stone-50/80 p-4 shadow-[0_12px_28px_rgba(148,163,184,0.08)]">
                <div className="text-sm font-semibold text-slate-900">{item.slice}</div>
                <div className="mt-2 text-sm leading-6 text-slate-600">{item.purpose}</div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                  {item.fields.map((field) => (
                    <span key={field} className="rounded-full border border-stone-200 bg-white px-3 py-2">{field}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-4 rounded-[30px] border border-stone-200/80 bg-white/82 p-5 shadow-[0_18px_44px_rgba(148,163,184,0.12)]">
            <div className="text-lg font-semibold text-slate-900">Event system</div>
            {FLOW_EVENT_SYSTEM.map((item) => (
              <div key={item.event} className="rounded-[24px] border border-stone-200 bg-stone-50/80 p-4 shadow-[0_12px_28px_rgba(148,163,184,0.08)]">
                <div className="text-sm font-semibold text-slate-900">{item.event}</div>
                <div className="mt-2 text-sm leading-6 text-slate-600">Producer: {item.producer} · Consumer: {item.consumer}</div>
              </div>
            ))}
          </div>

          <div className="space-y-4 rounded-[30px] border border-stone-200/80 bg-white/82 p-5 shadow-[0_18px_44px_rgba(148,163,184,0.12)]">
            <div className="text-lg font-semibold text-slate-900">API integration points</div>
            {FLOW_API_INTEGRATION_POINTS.map((item) => (
              <div key={item.intent} className="rounded-[24px] border border-stone-200 bg-stone-50/80 p-4 shadow-[0_12px_28px_rgba(148,163,184,0.08)]">
                <div className="text-sm font-semibold text-slate-900">{item.intent}</div>
                <div className="mt-2 text-sm leading-6 text-slate-600">Client: {item.client}</div>
                <div className="mt-2 text-sm leading-6 text-slate-600">Endpoint: {item.endpoint}</div>
                <div className="mt-2 text-sm leading-6 text-slate-600">Outcome: {item.outcome}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {FLOW_LAYOUT_BLUEPRINT.map((item) => (
            <div key={item.zone} className="rounded-[28px] border border-stone-200/80 bg-white/82 p-5 shadow-[0_18px_44px_rgba(148,163,184,0.12)]">
              <div className="text-xs uppercase tracking-[0.24em] text-stone-500">UI layout</div>
              <div className="mt-3 text-xl font-semibold text-slate-900">{item.zone}</div>
              <div className="mt-3 text-sm leading-6 text-slate-600">{item.purpose}</div>
            </div>
          ))}
        </div>
      </PlatformPanel>
    </PlatformShell>
  );
}