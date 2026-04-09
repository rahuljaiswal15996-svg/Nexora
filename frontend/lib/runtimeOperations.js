const ACTIVE_STATUSES = new Set(['queued', 'running', 'queued_remote', 'running_remote', 'rollback_queued', 'rolling_back']);
const SUCCESS_STATUSES = new Set(['success', 'completed', 'succeeded', 'deployed', 'rolled_back']);
const FAILURE_STATUSES = new Set(['failed', 'error', 'cancelled']);

export const RUNTIME_COMPONENT_STRUCTURE = [
  {
    name: 'RuntimeToolbar',
    role: 'Owns Jobs, Runs, Agents, and Deployments tab switching, status filters, search, and refresh posture.',
  },
  {
    name: 'RuntimeRecordList',
    role: 'Shows searchable operator inventory with job lifecycle grouping and selected-record context.',
  },
  {
    name: 'RuntimeJobInspector',
    role: 'Shows queue state, payload, result, error trace, and cancel or retry actions for control-plane jobs.',
  },
  {
    name: 'RuntimeRunInspector',
    role: 'Shows the pipeline execution graph, node-level status, selected-node logs, and retry-aware execution context.',
  },
  {
    name: 'RuntimeAgentInspector',
    role: 'Shows heartbeat, observed capacity, version, and assigned workloads for the remote worker fleet.',
  },
  {
    name: 'RuntimeDeploymentInspector',
    role: 'Shows active deployment posture, versioned deployment runs, and rollback controls.',
  },
];

export const RUNTIME_STATE_MODEL = [
  {
    slice: 'workspace',
    fields: ['jobs', 'runs', 'agents', 'deployments', 'system'],
    purpose: 'Hydrates the operator console with the live runtime inventory and service heartbeat.',
  },
  {
    slice: 'filters',
    fields: ['tab', 'statusFilter', 'searchText'],
    purpose: 'Keeps operator search and status filtering consistent across all runtime tabs.',
  },
  {
    slice: 'selection',
    fields: ['recordId', 'runNodeId', 'deploymentRunId'],
    purpose: 'Tracks the selected top-level record plus the selected run node or deployment version in the inspectors.',
  },
  {
    slice: 'detail',
    fields: ['pipelinesById', 'runNodesByRunId', 'logsByRunNodeKey', 'logCursorByRunNodeKey', 'deploymentsById'],
    purpose: 'Caches pipeline DAGs, run node executions, live log cursors, and deployment detail views for low-latency drill-down.',
  },
  {
    slice: 'presentation',
    fields: ['busyKey', 'feedback', 'lastUpdatedAt', 'events'],
    purpose: 'Tracks optimistic action state, operator feedback, refresh posture, and the console activity stream.',
  },
];

export const RUNTIME_LAYOUT_BLUEPRINT = [
  {
    zone: 'Top toolbar',
    purpose: 'Tab navigation, status filter, search, and refresh posture for the operator console.',
  },
  {
    zone: 'Left inventory rail',
    purpose: 'Jobs, runs, agents, and deployments list with section grouping and selection state.',
  },
  {
    zone: 'Center inspector',
    purpose: 'Context-rich detail panel that swaps between job, run, agent, and deployment inspectors.',
  },
  {
    zone: 'Embedded run workbench',
    purpose: 'Run graph, node list, and live log tracing for pipeline execution debugging.',
  },
];

export const RUNTIME_API_INTEGRATION_POINTS = [
  {
    intent: 'Hydrate runtime inventory',
    client: 'listJobs, listPipelineRuns, getAgentFleet, listDeployments, getSystemStatus',
    endpoint: 'GET /jobs, GET /pipelines/runs, GET /agent/fleet, GET /deployments, and GET /status',
    outcome: 'Jobs, runs, agents, deployments, and service heartbeat stay visible in one control center.',
  },
  {
    intent: 'Inspect one run deeply',
    client: 'getPipeline, listRunNodes, listRunLogs',
    endpoint: 'GET /pipelines/{pipeline_id}, GET /pipelines/runs/{run_id}/nodes, and GET /pipelines/runs/{run_id}/logs',
    outcome: 'Operator drill-down shows execution graph, node state, and live logs for the selected run.',
  },
  {
    intent: 'Act on jobs',
    client: 'cancelJob and retryJob',
    endpoint: 'POST /jobs/{job_id}/cancel and POST /jobs/{job_id}/retry',
    outcome: 'Queued or running jobs can be cancelled and terminal jobs can be requeued from Runtime Ops.',
  },
  {
    intent: 'Inspect and rollback deployments',
    client: 'getDeployment and rollbackDeployment',
    endpoint: 'GET /deployments/{deployment_id} and POST /deployments/{deployment_id}/rollback',
    outcome: 'Deployment version history and rollback actions stay in the same operator surface.',
  },
];

function normalizeStatus(status = '') {
  return `${status || ''}`.trim().toLowerCase();
}

function recordKey(record) {
  return record?.id || record?.agent_id || '';
}

function appendEvent(events, event) {
  if (!event) {
    return events;
  }
  return [event, ...events].slice(0, 16);
}

function pickRunNodeId(items = [], currentNodeId = '') {
  if (items.some((item) => item.node_id === currentNodeId)) {
    return currentNodeId;
  }
  return (
    items.find((item) => FAILURE_STATUSES.has(normalizeStatus(item.status)))?.node_id ||
    items.find((item) => ACTIVE_STATUSES.has(normalizeStatus(item.status)))?.node_id ||
    items[0]?.node_id ||
    ''
  );
}

function visualExecutionStatus(status = '') {
  const normalized = normalizeStatus(status);
  if (SUCCESS_STATUSES.has(normalized)) {
    return 'success';
  }
  if (FAILURE_STATUSES.has(normalized)) {
    return 'failed';
  }
  if (ACTIVE_STATUSES.has(normalized)) {
    return 'running';
  }
  return 'idle';
}

export function createRuntimeEvent(type, title, detail, payload = {}) {
  return {
    id: `${type}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    type,
    title,
    detail,
    payload,
    timestamp: new Date().toISOString(),
  };
}

export function createInitialRuntimeOperationsState() {
  return {
    tab: 'jobs',
    statusFilter: '',
    searchText: '',
    selection: {
      recordId: '',
      runNodeId: '',
      deploymentRunId: '',
    },
    workspace: {
      jobs: [],
      runs: [],
      agents: [],
      deployments: [],
      system: null,
    },
    detail: {
      pipelinesById: {},
      runNodesByRunId: {},
      logsByRunNodeKey: {},
      logCursorByRunNodeKey: {},
      deploymentsById: {},
    },
    busyKey: '',
    feedback: '',
    lastUpdatedAt: '',
    events: [],
  };
}

export function isRuntimeActiveStatus(status = '') {
  return ACTIVE_STATUSES.has(normalizeStatus(status));
}

export function summarizeRuntimeWorkspace(workspace = {}) {
  const jobs = workspace.jobs || [];
  const runs = workspace.runs || [];
  const agents = workspace.agents || [];
  const deployments = workspace.deployments || [];
  return {
    activeJobs: jobs.filter((job) => isRuntimeActiveStatus(job.status)).length,
    activeRuns: runs.filter((run) => isRuntimeActiveStatus(run.status)).length,
    activeAgents: agents.filter((agent) => normalizeStatus(agent.status) === 'active').length,
    activeDeployments: deployments.filter((deployment) => isRuntimeActiveStatus(deployment.status) || normalizeStatus(deployment.status) === 'deployed').length,
  };
}

export function groupJobsByLifecycle(jobs = []) {
  const groups = [
    { id: 'queued', label: 'Queued', items: jobs.filter((job) => normalizeStatus(job.status).includes('queue')) },
    { id: 'running', label: 'Running', items: jobs.filter((job) => ['running', 'rolling_back'].includes(normalizeStatus(job.status))) },
    { id: 'completed', label: 'Completed', items: jobs.filter((job) => !normalizeStatus(job.status).includes('queue') && !['running', 'rolling_back'].includes(normalizeStatus(job.status))) },
  ];
  return groups.filter((group) => group.items.length);
}

export function filterRuntimeRecords(tab, items = [], searchText = '') {
  const query = searchText.trim().toLowerCase();
  if (!query) {
    return items;
  }
  return items.filter((item) => {
    const haystack =
      tab === 'jobs'
        ? `${item.id || ''} ${item.job_type || ''} ${item.resource_type || ''} ${item.resource_id || ''} ${item.status || ''}`
        : tab === 'runs'
          ? `${item.id || ''} ${item.pipeline_id || ''} ${item.status || ''}`
          : tab === 'agents'
            ? `${item.agent_id || ''} ${item.status || ''} ${item.version || ''}`
            : `${item.id || ''} ${item.pipeline_id || ''} ${item.target_platform || ''} ${item.status || ''}`;
    return haystack.toLowerCase().includes(query);
  });
}

export function buildRuntimeRunDag(pipeline, runNodes = []) {
  if (!pipeline?.dag_json?.nodes?.length) {
    return { nodes: [], edges: [] };
  }

  const nodeExecutionById = Object.fromEntries((runNodes || []).map((item) => [item.node_id, item]));

  return {
    nodes: pipeline.dag_json.nodes.map((node) => {
      const execution = nodeExecutionById[node.id] || {};
      const rawStatus = execution.status || 'idle';
      return {
        ...node,
        kind: node.kind || node.type || node.data?.kind || 'recipe',
        executionStatus: visualExecutionStatus(rawStatus),
        badges: [rawStatus, execution.attempt_count ? `attempt ${execution.attempt_count}` : null].filter(Boolean),
      };
    }),
    edges: (pipeline.dag_json.edges || []).map((edge) => {
      const sourceStatus = nodeExecutionById[edge.source]?.status;
      const targetStatus = nodeExecutionById[edge.target]?.status;
      return {
        ...edge,
        animated: isRuntimeActiveStatus(sourceStatus) || isRuntimeActiveStatus(targetStatus),
        executionStatus: visualExecutionStatus(targetStatus || sourceStatus || 'idle'),
      };
    }),
  };
}

export function mergeRuntimeLogEntries(existingLogs = [], nextLogs = []) {
  const merged = new Map();
  [...existingLogs, ...nextLogs].forEach((log) => {
    const key = log?.id || log?.cursor || `${log?.created_at || ''}-${log?.message || ''}`;
    if (!key) {
      return;
    }
    merged.set(key, log);
  });
  return [...merged.values()];
}

export function runtimeOperationsReducer(state, action) {
  switch (action.type) {
    case 'hydrate-workspace':
      return {
        ...state,
        workspace: {
          jobs: action.jobs || [],
          runs: action.runs || [],
          agents: action.agents || [],
          deployments: action.deployments || [],
          system: action.system || state.workspace.system,
        },
        lastUpdatedAt: action.timestamp || new Date().toISOString(),
        feedback: action.feedback !== undefined ? action.feedback : state.feedback,
      };
    case 'set-tab':
      return {
        ...state,
        tab: action.tab,
        selection: {
          recordId: '',
          runNodeId: '',
          deploymentRunId: '',
        },
      };
    case 'set-status-filter':
      return {
        ...state,
        statusFilter: action.value,
      };
    case 'set-search-text':
      return {
        ...state,
        searchText: action.value,
      };
    case 'select-record':
      return {
        ...state,
        selection: {
          ...state.selection,
          recordId: action.recordId || '',
          runNodeId: action.clearRunNode ? '' : state.selection.runNodeId,
          deploymentRunId: action.clearDeploymentRun ? '' : state.selection.deploymentRunId,
        },
      };
    case 'select-run-node':
      return {
        ...state,
        selection: {
          ...state.selection,
          runNodeId: action.nodeId || '',
        },
      };
    case 'select-deployment-run':
      return {
        ...state,
        selection: {
          ...state.selection,
          deploymentRunId: action.runId || '',
        },
      };
    case 'receive-pipeline':
      return {
        ...state,
        detail: {
          ...state.detail,
          pipelinesById: {
            ...state.detail.pipelinesById,
            [action.pipeline?.id || action.pipelineId]: action.pipeline,
          },
        },
      };
    case 'receive-run-nodes': {
      const items = action.items || [];
      return {
        ...state,
        detail: {
          ...state.detail,
          runNodesByRunId: {
            ...state.detail.runNodesByRunId,
            [action.runId]: items,
          },
        },
        selection: {
          ...state.selection,
          runNodeId: pickRunNodeId(items, state.selection.runNodeId),
        },
      };
    }
    case 'append-run-logs': {
      const key = `${action.runId}:${action.nodeId || 'all'}`;
      return {
        ...state,
        detail: {
          ...state.detail,
          logsByRunNodeKey: {
            ...state.detail.logsByRunNodeKey,
            [key]: mergeRuntimeLogEntries(state.detail.logsByRunNodeKey[key] || [], action.items || []),
          },
          logCursorByRunNodeKey: {
            ...state.detail.logCursorByRunNodeKey,
            [key]: action.cursor || state.detail.logCursorByRunNodeKey[key] || 0,
          },
        },
      };
    }
    case 'receive-deployment-detail':
      return {
        ...state,
        detail: {
          ...state.detail,
          deploymentsById: {
            ...state.detail.deploymentsById,
            [action.deployment?.id || action.deploymentId]: action.deployment,
          },
        },
      };
    case 'set-busy-key':
      return {
        ...state,
        busyKey: action.busyKey || '',
      };
    case 'set-feedback':
      return {
        ...state,
        feedback: action.feedback || '',
      };
    case 'append-event':
      return {
        ...state,
        events: appendEvent(state.events, action.event),
      };
    default:
      return state;
  }
}

export function getRecordKey(record) {
  return recordKey(record);
}