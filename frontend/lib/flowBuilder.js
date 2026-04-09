const ACTIVE_RUN_STATUSES = new Set(['queued', 'running', 'queued_remote', 'running_remote']);
const SUCCESS_RUN_STATUSES = new Set(['success', 'completed', 'succeeded']);
const FAILURE_RUN_STATUSES = new Set(['failed', 'error']);

export const FLOW_OVERLAY_OPTIONS = [
  {
    id: 'execution',
    label: 'Execution overlay',
    description: 'Show live run state, retries, and failure paths directly on the DAG.',
  },
  {
    id: 'schema',
    label: 'Schema overlay',
    description: 'Show data-flow vs schema-flow edges and highlight column propagation risk.',
  },
  {
    id: 'validation',
    label: 'Validation overlay',
    description: 'Show parity, quality, and migration acceptance state on every node.',
  },
];

export const FLOW_INSPECTOR_TABS = [
  { id: 'schema', label: 'Schema' },
  { id: 'logs', label: 'Logs' },
  { id: 'preview', label: 'Preview data' },
  { id: 'lineage', label: 'Lineage' },
];

export const FLOW_EDGE_BEHAVIORS = [
  {
    kind: 'data',
    label: 'Data flow',
    description: 'Primary data movement between datasets, transformations, notebooks, and model stages.',
  },
  {
    kind: 'schema',
    label: 'Schema flow',
    description: 'Column shape, quality evidence, and validation constraints move across this edge.',
  },
  {
    kind: 'control',
    label: 'Control flow',
    description: 'Promotion, deployment, and orchestration state moves across this edge.',
  },
];

export const FLOW_COMPONENT_STRUCTURE = [
  {
    name: 'FlowToolbar',
    role: 'Owns source vs converted mode switching, overlay selection, validate, save, run, retry, promotion, and clear-draft actions.',
  },
  {
    name: 'FlowNodePalette',
    role: 'Presents the backend node catalog, execution binding hints, and create-node entry points for the editable DAG.',
  },
  {
    name: 'DAGEditor',
    role: 'Renders the single flow graph with execution, schema, and validation overlays while supporting node drag, connect, select, and edge selection.',
  },
  {
    name: 'FlowAuthoringPanel',
    role: 'Renders per-node config forms, field-level validation, edge actions, and execution-binding summaries from the node catalog.',
  },
  {
    name: 'FlowInspectorPanel',
    role: 'Shows schema, logs, preview data, lineage, and retry-aware node controls without leaving the canvas.',
  },
  {
    name: 'FlowExecutionRail',
    role: 'Keeps run history and event activity visible while the user stays on the same workspace.',
  },
];

export const FLOW_STATE_MODEL = [
  {
    slice: 'workspace',
    fields: ['flowDraft', 'datasets', 'notebooks', 'deployments', 'experiments', 'runs'],
    purpose: 'Hydrates the unified DAG from migration output and live platform assets.',
  },
  {
    slice: 'graph',
    fields: ['dag', 'executionDag', 'selectedNodeId', 'highlightedNodeIds', 'highlightedEdgeIds'],
    purpose: 'Keeps the graph, selection, lineage highlights, and failure path inside one visual state model.',
  },
  {
    slice: 'authoring',
    fields: ['nodeCatalog', 'draftDag', 'selectedEdgeId', 'validation', 'dirty', 'busyKey'],
    purpose: 'Tracks editable DAG structure, node config drafts, graph validation state, selected edge controls, and save lifecycle.',
  },
  {
    slice: 'execution',
    fields: ['selectedRunId', 'runState', 'runNodes', 'nodeLogsByNodeId', 'nodeLogCursorByNodeId', 'executionTick', 'busyKey'],
    purpose: 'Tracks run polling, node execution telemetry, per-node log cursors, retry entry point, and optimistic action state.',
  },
  {
    slice: 'presentation',
    fields: ['viewMode', 'overlayMode', 'inspectorTab', 'feedback', 'events'],
    purpose: 'Controls mode, overlay, inspector focus, feedback, and the UI event stream.',
  },
];

export const FLOW_EVENT_SYSTEM = [
  {
    event: 'flow.node.selected',
    producer: 'DAGEditor',
    consumer: 'FlowInspectorPanel',
  },
  {
    event: 'flow.node.created',
    producer: 'FlowNodePalette',
    consumer: 'Flow page authoring reducer',
  },
  {
    event: 'flow.edge.connected',
    producer: 'DAGEditor',
    consumer: 'Flow page authoring reducer',
  },
  {
    event: 'flow.graph.validated',
    producer: 'FlowToolbar',
    consumer: 'FlowAuthoringPanel and activity stream',
  },
  {
    event: 'flow.mode.changed',
    producer: 'FlowToolbar',
    consumer: 'Flow page reducer',
  },
  {
    event: 'flow.run.started',
    producer: 'FlowToolbar',
    consumer: 'Execution overlay and activity stream',
  },
  {
    event: 'flow.run.updated',
    producer: 'Runtime polling effect',
    consumer: 'Execution overlay and latest runs panel',
  },
  {
    event: 'flow.retry.from-node',
    producer: 'FlowToolbar and FlowInspectorPanel',
    consumer: 'Run creation and activity stream',
  },
];

export const FLOW_LAYOUT_BLUEPRINT = [
  {
    zone: 'Left rail',
    purpose: 'Node catalog, graph validation posture, edge semantics, and migration handoff status.',
  },
  {
    zone: 'Center canvas',
    purpose: 'Unified DAG with source vs converted toggles, authoring interactions, execution animation, failure highlighting, and retry entry points.',
  },
  {
    zone: 'Right inspector',
    purpose: 'Per-node config authoring, edge actions, schema, logs, preview data, and lineage in one side panel driven by selection.',
  },
  {
    zone: 'Bottom rail',
    purpose: 'Live runs, user events, state model, and API integration references for the workspace.',
  },
];

export const FLOW_API_INTEGRATION_POINTS = [
  {
    intent: 'Hydrate migration-backed graph',
    client: 'loadFlowDraft',
    endpoint: 'Local workspace state',
    outcome: 'Source and converted flow graphs seed the same canvas.',
  },
  {
    intent: 'Hydrate live assets',
    client: 'listCatalogDatasets, listNotebooks, listDeployments, listExperiments',
    endpoint: 'GET catalog, notebook, deployment, and ML routes',
    outcome: 'Datasets, notebooks, deployments, and models become node-level context in the same DAG.',
  },
  {
    intent: 'Persist production flow graph',
    client: 'createPipeline and updatePipeline',
    endpoint: 'POST /pipelines and PUT /pipelines/{pipeline_id}',
    outcome: 'The current DAG becomes a backend pipeline record and can be updated from the authoring canvas.',
  },
  {
    intent: 'Hydrate authoring catalog and validate graph',
    client: 'listPipelineNodeCatalog and validatePipelineGraph',
    endpoint: 'GET /pipelines/node-catalog and POST /pipelines/validate',
    outcome: 'The config UI, field validation, and execution binding mapping come from the backend authoring contract.',
  },
  {
    intent: 'Start execution from canvas',
    client: 'runPipeline',
    endpoint: 'POST /pipelines/{pipeline_id}/runs',
    outcome: 'Flow Builder launches a run or retry without leaving the canvas.',
  },
  {
    intent: 'Poll run status',
    client: 'getRunStatus, listRunNodes, listRunLogs, and listPipelineRuns',
    endpoint: 'GET /pipelines/runs/{run_id}, GET /pipelines/runs/{run_id}/nodes, GET /pipelines/runs/{run_id}/logs, and GET /pipelines/runs',
    outcome: 'Execution overlay, selected-node inspector logs, and run list stay in sync with backend telemetry.',
  },
];

function normalizeStatus(status) {
  return `${status || ''}`.trim().toLowerCase();
}

export function createFlowEvent(type, title, detail, payload = {}) {
  return {
    id: `${type}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    type,
    title,
    detail,
    payload,
    timestamp: new Date().toISOString(),
  };
}

function appendEvent(events, event, silent = false) {
  if (silent || !event) {
    return events;
  }
  return [event, ...events].slice(0, 12);
}

function withEvent(state, event, silent = false) {
  return {
    ...state,
    events: appendEvent(state.events, event, silent),
  };
}

export function createInitialFlowUiState(defaultViewMode = 'converted') {
  return {
    viewMode: defaultViewMode,
    overlayMode: 'execution',
    inspectorTab: 'schema',
    selectedNodeId: '',
    selectedRunId: '',
    runState: null,
    executionTick: 0,
    busyKey: '',
    feedback: '',
    events: [],
  };
}

export function flowUiReducer(state, action) {
  switch (action.type) {
    case 'hydrate':
      return {
        ...state,
        viewMode: action.viewMode || state.viewMode,
        feedback: action.feedback || '',
      };
    case 'set-view-mode':
      return withEvent(
        {
          ...state,
          viewMode: action.viewMode,
          selectedNodeId: '',
          selectedRunId: '',
          runState: null,
          executionTick: 0,
          feedback: action.feedback || state.feedback,
        },
        createFlowEvent('flow.mode.changed', `Switched to ${action.viewMode} flow`, 'The canvas now reflects a different migration-backed graph.'),
        action.silent,
      );
    case 'set-overlay-mode':
      return withEvent(
        {
          ...state,
          overlayMode: action.overlayMode,
          feedback: action.feedback || state.feedback,
        },
        createFlowEvent('flow.overlay.changed', `Enabled ${action.overlayMode} overlay`, 'The graph is now emphasizing a different operational signal.'),
        action.silent,
      );
    case 'select-node':
      return withEvent(
        {
          ...state,
          selectedNodeId: action.nodeId,
        },
        createFlowEvent('flow.node.selected', 'Inspector focus changed', `Node ${action.nodeLabel || action.nodeId || 'unknown'} is now active in the side panel.`),
        action.silent,
      );
    case 'set-inspector-tab':
      return {
        ...state,
        inspectorTab: action.tabId,
      };
    case 'set-busy-key':
      return {
        ...state,
        busyKey: action.busyKey,
      };
    case 'set-feedback':
      return {
        ...state,
        feedback: action.feedback,
      };
    case 'append-event':
      return withEvent(
        state,
        action.event,
        action.silent,
      );
    case 'tick':
      return {
        ...state,
        executionTick: state.executionTick + 1,
      };
    case 'select-run':
      return withEvent(
        {
          ...state,
          selectedRunId: action.run?.id || action.run?.run_id || '',
          runState: action.run || null,
          executionTick: 0,
          feedback: action.feedback || state.feedback,
        },
        createFlowEvent('flow.run.selected', `Selected run ${action.run?.id || action.run?.run_id || 'unknown'}`, 'The execution overlay now reflects the chosen run.'),
        action.silent,
      );
    case 'run-started':
      return withEvent(
        {
          ...state,
          selectedRunId: action.run?.run_id || action.run?.id || '',
          runState: action.run || null,
          executionTick: 0,
          busyKey: '',
          feedback: action.feedback || state.feedback,
        },
        createFlowEvent(action.eventType || 'flow.run.started', action.eventTitle || `Run ${action.run?.run_id || action.run?.id || 'unknown'} started`, action.eventDetail || 'Execution has started from the Flow Builder canvas.'),
        action.silent,
      );
    case 'run-updated': {
      const previousStatus = normalizeStatus(state.runState?.status);
      const nextStatus = normalizeStatus(action.run?.status);
      const nextState = {
        ...state,
        runState: action.run || null,
        feedback: action.feedback || state.feedback,
      };
      if (!nextStatus || nextStatus === previousStatus) {
        return nextState;
      }
      return withEvent(
        nextState,
        createFlowEvent('flow.run.updated', `Run moved to ${nextStatus}`, action.eventDetail || 'The execution overlay was updated from live runtime polling.'),
        action.silent,
      );
    }
    case 'clear-draft':
      return withEvent(
        {
          ...state,
          selectedNodeId: '',
          selectedRunId: '',
          runState: null,
          executionTick: 0,
          feedback: action.feedback || state.feedback,
        },
        createFlowEvent('flow.draft.cleared', 'Cleared migration draft', 'The canvas now falls back to the platform-defined operational flow model.'),
        action.silent,
      );
    default:
      return state;
  }
}

function normalizeSchemaColumn(column, index, fallbackKind) {
  if (typeof column === 'string') {
    return {
      name: column,
      type: 'string',
      nullable: true,
      source: fallbackKind,
    };
  }

  return {
    name: column?.name || column?.field || `column_${index + 1}`,
    type: column?.type || column?.dtype || column?.data_type || 'string',
    nullable: column?.nullable !== false,
    source: column?.source || fallbackKind,
  };
}

function defaultSchemaForKind(node) {
  const defaults = {
    dataset: ['record_id', 'source_system', 'ingested_at'],
    recipe: ['record_id', 'transformed_value', 'lineage_hash'],
    notebook: ['notebook_input', 'parameter', 'result'],
    model: ['feature_vector', 'prediction', 'confidence'],
    validation: ['rule_name', 'result', 'evidence'],
    deploy: ['target_name', 'version', 'promotion_state'],
  };

  return (defaults[node?.kind] || defaults.recipe).map((name, index) =>
    normalizeSchemaColumn({ name, type: index === 0 ? 'string' : 'string' }, index, node?.kind || 'recipe'),
  );
}

export function inferSchemaColumns(node) {
  const metadata = node?.metadata || {};
  const schema = metadata.schema || metadata.columns || metadata.output_schema || metadata.fields;
  if (Array.isArray(schema) && schema.length) {
    return schema.map((column, index) => normalizeSchemaColumn(column, index, node?.kind || 'recipe'));
  }

  const previewRows = metadata.preview_rows || metadata.previewRows || metadata.sample_rows;
  if (Array.isArray(previewRows) && previewRows.length && previewRows[0] && typeof previewRows[0] === 'object') {
    return Object.keys(previewRows[0]).map((key, index) => normalizeSchemaColumn({ name: key }, index, node?.kind || 'recipe'));
  }

  return defaultSchemaForKind(node);
}

function valueForColumn(column, rowIndex, node) {
  const type = `${column.type || ''}`.toLowerCase();
  if (type.includes('int') || type.includes('float') || type.includes('double') || type.includes('number')) {
    return rowIndex + 1;
  }
  if (type.includes('bool')) {
    return rowIndex % 2 === 0;
  }
  if (type.includes('time') || type.includes('date')) {
    return '2026-04-06T09:00:00Z';
  }
  return `${node?.label || 'value'}_${column.name}_${rowIndex + 1}`;
}

export function inferPreviewRows(node, schemaColumns) {
  const metadata = node?.metadata || {};
  const previewRows = metadata.preview_rows || metadata.previewRows || metadata.sample_rows;
  if (Array.isArray(previewRows) && previewRows.length) {
    return previewRows.slice(0, 5);
  }

  return Array.from({ length: 3 }, (_value, rowIndex) =>
    Object.fromEntries(schemaColumns.slice(0, 6).map((column) => [column.name, valueForColumn(column, rowIndex, node)])),
  );
}

function inferValidationStatus(node) {
  const raw = normalizeStatus(
    node?.validationStatus || node?.metadata?.validation_status || node?.metadata?.quality_status || node?.metadata?.status,
  );

  if (raw.includes('pass') || raw === 'success') {
    return 'pass';
  }
  if (raw.includes('fail') || raw === 'failed' || raw === 'error') {
    return 'fail';
  }
  if (node?.kind === 'validation') {
    return 'pending';
  }
  return null;
}

function traceRelated(nodeId, dag, direction) {
  if (!nodeId || !dag?.edges?.length) {
    return { nodes: [], nodeIds: [], edgeIds: [] };
  }

  const edges = dag.edges || [];
  const nodeMap = Object.fromEntries((dag.nodes || []).map((node) => [node.id, node]));
  const visited = new Set();
  const nodeIds = [];
  const edgeIds = [];
  const queue = [nodeId];

  while (queue.length) {
    const currentId = queue.shift();
    edges.forEach((edge) => {
      const isMatch = direction === 'upstream' ? edge.target === currentId : edge.source === currentId;
      if (!isMatch) {
        return;
      }
      edgeIds.push(edge.id);
      const nextId = direction === 'upstream' ? edge.source : edge.target;
      if (visited.has(nextId)) {
        return;
      }
      visited.add(nextId);
      nodeIds.push(nextId);
      queue.push(nextId);
    });
  }

  return {
    nodes: nodeIds.map((relatedId) => nodeMap[relatedId]).filter(Boolean),
    nodeIds,
    edgeIds: [...new Set(edgeIds)],
  };
}

export function getFlowSelectionState(selectedNodeId, dag) {
  const selectedNode = (dag?.nodes || []).find((node) => node.id === selectedNodeId) || null;
  if (!selectedNode) {
    return {
      selectedNode: null,
      upstreamNodes: [],
      downstreamNodes: [],
      highlightedNodeIds: [],
      highlightedEdgeIds: [],
    };
  }

  const upstream = traceRelated(selectedNodeId, dag, 'upstream');
  const downstream = traceRelated(selectedNodeId, dag, 'downstream');

  return {
    selectedNode,
    upstreamNodes: upstream.nodes,
    downstreamNodes: downstream.nodes,
    highlightedNodeIds: [selectedNodeId, ...upstream.nodeIds, ...downstream.nodeIds],
    highlightedEdgeIds: [...upstream.edgeIds, ...downstream.edgeIds],
  };
}

function inferEdgeBehavior(sourceNode, targetNode) {
  if (!sourceNode || !targetNode) {
    return FLOW_EDGE_BEHAVIORS[0];
  }
  if (targetNode.kind === 'validation' || sourceNode.kind === 'validation') {
    return FLOW_EDGE_BEHAVIORS.find((item) => item.kind === 'schema') || FLOW_EDGE_BEHAVIORS[1];
  }
  if (targetNode.kind === 'deploy' || sourceNode.kind === 'deploy') {
    return FLOW_EDGE_BEHAVIORS.find((item) => item.kind === 'control') || FLOW_EDGE_BEHAVIORS[2];
  }
  return FLOW_EDGE_BEHAVIORS.find((item) => item.kind === 'data') || FLOW_EDGE_BEHAVIORS[0];
}

export function isFlowRunActive(run) {
  return ACTIVE_RUN_STATUSES.has(normalizeStatus(run?.status));
}

export function summarizeExecutionStates(nodes = []) {
  return nodes.reduce(
    (summary, node) => ({
      ...summary,
      [node.executionStatus || 'idle']: (summary[node.executionStatus || 'idle'] || 0) + 1,
    }),
    { idle: 0, running: 0, success: 0, failed: 0 },
  );
}

function normalizeExecutionStatus(status) {
  const normalized = normalizeStatus(status);
  if (SUCCESS_RUN_STATUSES.has(normalized) || normalized === 'skipped') {
    return 'success';
  }
  if (FAILURE_RUN_STATUSES.has(normalized)) {
    return 'failed';
  }
  if (normalized === 'running' || normalized === 'running_remote') {
    return 'running';
  }
  return 'idle';
}

function buildRunNodeMap(runNodes = []) {
  return Object.fromEntries(
    runNodes
      .filter(Boolean)
      .map((runNode) => [runNode.node_id || runNode.nodeId, runNode])
      .filter(([nodeId]) => nodeId),
  );
}

function normalizeRuntimeLog(log) {
  return {
    ...log,
    id: log?.id || log?.cursor || `${log?.level || 'info'}-${log?.created_at || log?.timestamp || 'log'}`,
    level: normalizeStatus(log?.level) || 'info',
    timestamp: log?.created_at || log?.timestamp || '',
    message: log?.message || '',
    stream: log?.stream || 'stdout',
  };
}

function buildFailurePath(nodeId, dag) {
  if (!nodeId) {
    return { nodeIds: [], edgeIds: [] };
  }
  const upstream = traceRelated(nodeId, dag, 'upstream');
  return {
    nodeIds: [...upstream.nodeIds, nodeId],
    edgeIds: upstream.edgeIds,
  };
}

function buildRunningPath(nodeId, dag) {
  if (!nodeId) {
    return { nodeIds: [], edgeIds: [] };
  }
  const upstream = traceRelated(nodeId, dag, 'upstream');
  return {
    nodeIds: [...upstream.nodeIds, nodeId],
    edgeIds: upstream.edgeIds,
  };
}

export function buildFlowExecutionState(dag, runState, tick, options = {}) {
  const nodes = dag?.nodes || [];
  const edges = dag?.edges || [];
  const runNodes = Array.isArray(options.runNodes) ? options.runNodes : [];
  const runNodeMap = buildRunNodeMap(runNodes);
  const status = normalizeStatus(runState?.status);
  const isActive = ACTIVE_RUN_STATUSES.has(status);
  const isSuccess = SUCCESS_RUN_STATUSES.has(status);
  const isFailure = FAILURE_RUN_STATUSES.has(status);
  const runMetadata = runState?.run_metadata || runState?.metadata || {};
  const boundedIndex = Math.max(0, Math.min(tick, Math.max(nodes.length - 1, 0)));
  const activeNodeExecution = runNodes.find((runNode) => normalizeExecutionStatus(runNode?.status) === 'running') || null;
  const failedNodeExecution = runNodes.find((runNode) => normalizeExecutionStatus(runNode?.status) === 'failed') || null;
  const activeNodeId = activeNodeExecution?.node_id || (isActive ? runMetadata.active_node_id || nodes[boundedIndex]?.id || null : null);
  const failedNodeId = failedNodeExecution?.node_id || (isFailure
    ? runMetadata.failed_node_id || runMetadata.error_node_id || runMetadata.retry_from_node || nodes[boundedIndex]?.id || nodes[nodes.length - 1]?.id || null
    : null);
  const retryFromNodeId = runMetadata.retry_from_node || null;
  const runningPath = buildRunningPath(activeNodeId, dag);
  const failurePath = buildFailurePath(failedNodeId, dag);
  const runningNodeIds = new Set(runningPath.nodeIds);
  const failedNodeIds = new Set(failurePath.nodeIds);
  const runningEdgeIds = new Set(runningPath.edgeIds);
  const failedEdgeIds = new Set(failurePath.edgeIds);

  const annotatedNodes = nodes.map((node, index) => {
    const runtimeNode = runNodeMap[node.id] || null;
    const runtimeMetadata = runtimeNode?.metadata || {};
    let executionStatus = runtimeNode ? normalizeExecutionStatus(runtimeNode.status) : 'idle';
    if (!runtimeNode) {
      if (isSuccess || index < boundedIndex) {
        executionStatus = 'success';
      }
      if (isActive && node.id === activeNodeId) {
        executionStatus = 'running';
      }
      if (isFailure && node.id === failedNodeId) {
        executionStatus = 'failed';
      }
    }

    const baseMetadata = {
      ...(node.metadata || {}),
      ...runtimeMetadata,
    };
    const nodeWithRuntime = {
      ...node,
      metadata: baseMetadata,
    };
    const schemaColumns = inferSchemaColumns(nodeWithRuntime);
    const previewRows = inferPreviewRows(nodeWithRuntime, schemaColumns);
    const validationStatus = inferValidationStatus(node);
    const badges = [
      `${schemaColumns.length} columns`,
      previewRows.length ? `${previewRows.length} preview rows` : null,
      validationStatus ? `validation ${validationStatus}` : null,
      retryFromNodeId === node.id ? 'retry source' : null,
      node.kind === 'deploy' ? 'promotion target' : null,
      runtimeNode?.status === 'queued' || runtimeNode?.status === 'queued_remote' ? 'queued' : null,
      runtimeNode?.status === 'skipped' ? 'reused upstream' : null,
      runtimeNode?.attempt_count ? `attempt ${runtimeNode.attempt_count}` : null,
      runtimeNode?.error_text ? 'runtime error' : null,
    ].filter(Boolean);

    return {
      ...node,
      executionStatus,
      pathState: failedNodeIds.has(node.id) ? 'failed' : runningNodeIds.has(node.id) ? 'running' : 'idle',
      validationStatus,
      isRetryTarget: retryFromNodeId === node.id,
      badges,
      runtime: runtimeNode,
      metadata: {
        ...baseMetadata,
        schema: baseMetadata.schema || schemaColumns,
        preview_rows: baseMetadata.preview_rows || previewRows,
        execution_unit_id: runtimeNode?.execution_unit_id || runtimeNode?.id || null,
        runtime_status: runtimeNode?.status || null,
        attempt_count: runtimeNode?.attempt_count || 0,
        error_text: runtimeNode?.error_text || null,
        started_at: runtimeNode?.started_at || null,
        finished_at: runtimeNode?.finished_at || null,
      },
    };
  });

  const nodeMap = Object.fromEntries(annotatedNodes.map((node) => [node.id, node]));

  const annotatedEdges = edges.map((edge, index) => {
    const sourceNode = nodeMap[edge.source];
    const targetNode = nodeMap[edge.target];
    const behavior = inferEdgeBehavior(sourceNode, targetNode);
    const isFailedPath = failedEdgeIds.has(edge.id) || (failedNodeIds.has(edge.source) && failedNodeIds.has(edge.target));
    const isRunningPath = runningEdgeIds.has(edge.id) || (runningNodeIds.has(edge.source) && runningNodeIds.has(edge.target));

    let executionStatus = 'idle';
    if (isSuccess || targetNode?.executionStatus === 'success') {
      executionStatus = 'success';
    }
    if (isRunningPath) {
      executionStatus = 'running';
    }
    if (isFailedPath) {
      executionStatus = 'failed';
    }

    return {
      ...edge,
      id: edge.id || `flow-edge-${index + 1}`,
      flowKind: edge.flowKind || behavior.kind,
      description: edge.description || behavior.description,
      label: edge.label || (behavior.kind === 'data' ? '' : behavior.label),
      animated: Boolean(edge.animated || (options.overlayMode !== 'validation' && isRunningPath)),
      executionStatus,
      isFailurePath: isFailedPath,
      isRunningPath,
    };
  });

  return {
    ...dag,
    nodes: annotatedNodes,
    edges: annotatedEdges,
    metadata: {
      ...(dag?.metadata || {}),
      overlayMode: options.overlayMode || 'execution',
      activeNodeId,
      failedNodeId,
      retryFromNodeId,
    },
  };
}

function buildNodeLogs(node, runState) {
  const now = runState?.updated_at || runState?.started_at || new Date().toISOString();
  const logs = [
    {
      level: 'info',
      message: `${node.label} is registered as a ${node.kind} node in the unified Flow Builder graph.`,
      timestamp: now,
    },
    {
      level: 'info',
      message: node.kind === 'validation' ? 'This node enforces parity and quality constraints on the surrounding path.' : 'This node participates in the same execution and lineage graph as every other asset.',
      timestamp: now,
    },
  ];

  if (node.executionStatus === 'running') {
    logs.unshift({
      level: 'info',
      message: `Execution is currently active on ${node.label}.`,
      timestamp: now,
    });
  }

  if (node.executionStatus === 'success') {
    logs.unshift({
      level: 'success',
      message: `${node.label} completed and published output to downstream edges.`,
      timestamp: now,
    });
  }

  if (node.executionStatus === 'failed') {
    logs.unshift({
      level: 'error',
      message: node?.metadata?.error_text || runState?.run_metadata?.error || `${node.label} is the active failure point on the current path.`,
      timestamp: now,
    });
  }

  if (node.isRetryTarget) {
    logs.unshift({
      level: 'warn',
      message: 'A retry was requested from this node. Upstream assets can be reused while downstream work is replayed.',
      timestamp: now,
    });
  }

  return logs;
}

export function buildInspectorModel(node, dag, runState, options = {}) {
  if (!node) {
    return {
      schema: [],
      previewRows: [],
      logs: [],
      lineage: { upstream: [], downstream: [] },
      summary: null,
    };
  }

  const selection = getFlowSelectionState(node.id, dag);
  const schema = inferSchemaColumns(node);
  const previewRows = inferPreviewRows(node, schema);
  const logs = Array.isArray(options.logs) && options.logs.length ? options.logs.map((log) => normalizeRuntimeLog(log)) : buildNodeLogs(node, runState);

  return {
    schema,
    previewRows,
    logs,
    lineage: {
      upstream: selection.upstreamNodes,
      downstream: selection.downstreamNodes,
    },
    summary: {
      kind: node.kind,
      executionStatus: node.executionStatus || 'idle',
      validationStatus: inferValidationStatus(node),
      schemaColumns: schema.length,
      previewRows: previewRows.length,
      upstreamCount: selection.upstreamNodes.length,
      downstreamCount: selection.downstreamNodes.length,
      attemptCount: node.runtime?.attempt_count || 0,
      runtimeStatus: node.runtime?.status || node.executionStatus || 'idle',
    },
  };
}
