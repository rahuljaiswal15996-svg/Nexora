const FALLBACK_FLOW_DAG = {
  nodes: [
    { id: 'source-dataset', label: 'Source Dataset', kind: 'dataset', description: 'Legacy table or file entering the migration path.' },
    { id: 'transformation-recipe', label: 'Transformation Recipe', kind: 'recipe', description: 'Converted logic normalized into a reusable transformation stage.' },
    { id: 'analysis-notebook', label: 'Notebook Node', kind: 'notebook', description: 'Interactive engineering and validation work kept in the same graph.' },
    { id: 'model-candidate', label: 'ML Model', kind: 'model', description: 'Feature scoring or model output represented as a first-class node.' },
    { id: 'validation-gate', label: 'Validation Gate', kind: 'validation', description: 'Quality, semantic, and parity checks before promotion.' },
    { id: 'deploy-target', label: 'Deployment Target', kind: 'deploy', description: 'Production handoff into the selected runtime target.' },
  ],
  edges: [
    { id: 'fallback-1', source: 'source-dataset', target: 'transformation-recipe' },
    { id: 'fallback-2', source: 'transformation-recipe', target: 'analysis-notebook' },
    { id: 'fallback-3', source: 'analysis-notebook', target: 'model-candidate' },
    { id: 'fallback-4', source: 'model-candidate', target: 'validation-gate' },
    { id: 'fallback-5', source: 'validation-gate', target: 'deploy-target' },
  ],
};

export const GLOBAL_NAV_ITEMS = [
  {
    href: '/home',
    label: 'Home',
    group: 'global',
    description: 'Personal landing page for programs, recent work, and shared spaces.',
  },
  {
    href: '/runtime',
    label: 'Runtime Ops',
    group: 'global',
    description: 'Live control center for jobs, runs, agents, and deployments.',
  },
  {
    href: '/connections',
    label: 'Connections Hub',
    group: 'global',
    description: 'Enterprise source, target, and credential posture workspace.',
  },
  {
    href: '/governance/policies',
    label: 'Governance Desk',
    group: 'global',
    description: 'Policies, approvals, audit evidence, and spend controls.',
  },
];

export const PROJECT_NAV_ITEMS = [
  {
    href: '/migration-studio',
    label: 'Migration Studio',
    group: 'project',
    description: 'Intake, parse, convert, compare, and approve modernization work.',
  },
  {
    href: '/flow',
    label: 'Flow Builder',
    group: 'project',
    description: 'System-of-record canvas for datasets, recipes, notebooks, and deploy gates.',
  },
  {
    href: '/notebooks',
    label: 'Jupyter Workspace',
    group: 'project',
    description: 'Project notebook workbench with dataset context, kernels, and promotion paths.',
  },
  {
    href: '/catalog',
    label: 'Catalog + Lineage',
    group: 'project',
    description: 'Graph-first asset explorer for lineage, schema, and quality.',
  },
  {
    href: '/ml',
    label: 'ML Studio',
    group: 'project',
    description: 'Experiments, evaluations, registry state, and serving handoff.',
  },
];

export const PLATFORM_LAYER_META = {
  global: {
    label: 'Global Surfaces',
    description: 'Portfolio, operations, governance, and connectivity that span every project.',
    entryHref: '/home',
  },
  project: {
    label: 'Project Workspaces',
    description: 'Migration, flow, notebooks, catalog, and ML inside the active delivery context.',
    entryHref: '/flow',
  },
};

export const GOVERNANCE_DESK_ITEMS = [
  {
    href: '/governance/policies',
    label: 'Policies',
    description: 'Rules, quotas, residency, and connector guardrails.',
  },
  {
    href: '/governance/finops',
    label: 'FinOps',
    description: 'Spend posture, budget evidence, and service-level cost signals.',
  },
  {
    href: '/governance/reviews',
    label: 'Reviews',
    description: 'Approvals, collaboration threads, and audit-linked resolution flows.',
  },
];

export const SYSTEM_MODEL = [
  {
    kind: 'job',
    label: 'Job',
    description: 'A tenant-scoped control-plane work item. Jobs execute background checks, deployments, and experiment tasks and are claimable, retryable, and inspectable in Runtime Ops.',
    primarySurface: 'Runtime Operations / Jobs',
  },
  {
    kind: 'run',
    label: 'Run',
    description: 'A stage-by-stage execution of a Flow. Runs own the execution graph, node progress, retry history, and operator drill-down for production workflow state.',
    primarySurface: 'Runtime Operations / Pipeline Runs',
  },
  {
    kind: 'deployment',
    label: 'Deployment',
    description: 'A promotion record for a production candidate. The deployment persists release intent while a deployment job tracks the background work used to execute it.',
    primarySurface: 'Runtime Operations / Deployments',
  },
  {
    kind: 'scenario',
    label: 'Scenario',
    description: 'A design-time variant of a Flow or migration path. Scenarios shape what should run before Runtime Ops turns that design into concrete jobs, runs, and deployments.',
    primarySurface: 'Flow Builder',
  },
];

export const PRODUCT_SURFACE_BLUEPRINTS = [
  {
    surface: 'Flow Builder',
    description: 'The Dataiku-style system of record where datasets, recipes, notebooks, models, validation gates, and deploy targets share a single DAG.',
    highlights: [
      'One canvas for dataset, recipe, notebook, model, validation, and deploy nodes.',
      'Source and converted migration flows remain switchable inside the same workspace.',
      'Canvas interactions cover expand, debug, run, and inspect without leaving the graph.',
      'Execution state streams through node and edge animation during live runs.',
    ],
  },
  {
    surface: 'Notebook Workspace',
    description: 'The Databricks-style execution surface for exploration, data browsing, runtime selection, promotion, and notebook execution compiled through the same pipeline engine as Flow Builder.',
    highlights: [
      'Open a dataset directly into the notebook browser from Catalog + Lineage.',
      'Open a Flow node directly into notebook editing context from Flow Builder.',
      'Local and cluster runtime modes stay visible in the same workspace.',
      'Cell, selection, and run-all actions should return the same run telemetry contract used by Flow Builder.',
      'Notebook outcomes can be promoted into Flow, Runtime Ops, or ML Studio from one tab set.',
    ],
  },
  {
    surface: 'Runtime Operations',
    description: 'The operator console for Jobs, Agents, Pipeline Runs, and Deployments with a unified system vocabulary and live drill-down debugging.',
    highlights: [
      'Tabs separate queue work, remote agents, flow runs, and promotion records cleanly.',
      'Filters and search apply across queue state, worker identity, pipeline id, and deployment state.',
      'Pipeline runs render stage state back into the DAG for live execution inspection.',
      'The system model distinguishes jobs, runs, deployments, and scenarios explicitly.',
    ],
  },
  {
    surface: 'Catalog + Lineage',
    description: 'A lineage-first catalog where graph context comes first and schema, quality, preview, and notebook entry points stay in the same asset view.',
    highlights: [
      'Lineage graph is the primary surface, not a secondary detail widget.',
      'Selecting a dataset reveals upstream, downstream, schema, quality, and tags together.',
      'Data preview and profiling stay visible when the dataset is backed by a discoverable connection.',
      'Catalog entries open directly into Notebook Workspace for interactive analysis.',
    ],
  },
  {
    surface: 'Connections Hub',
    description: 'An enterprise connection workspace for testing, schema discovery, dataset browsing, and credential posture rather than a thin setup page.',
    highlights: [
      'Connection testing stays explicit and observable.',
      'Schema discovery and source dataset preview are first-class features.',
      'Browsing starts from the source connection instead of forcing users back into other pages.',
      'Credential handling stays masked and health-oriented rather than exposing secret state.',
    ],
  },
];

export const CONNECTIONS_HUB_PILLARS = [
  {
    title: 'Connection testing',
    description: 'Validate source health and preserve a clear test trail before users browse data or promote connectors into production use.',
  },
  {
    title: 'Schema discovery',
    description: 'Pull source-side schema into the same workspace where connection health and browsing are managed.',
  },
  {
    title: 'Dataset browsing',
    description: 'Browse source datasets directly from the connection and preview them before registering or opening them elsewhere.',
  },
  {
    title: 'Credential posture',
    description: 'Keep secrets masked, show posture and verification state, and avoid turning the UI into a credential dump.',
  },
];

export const FLOW_NODE_TYPES = [
  {
    kind: 'dataset',
    label: 'Dataset Node',
    description: 'Tables, files, feature sets, and migration source or target assets.',
    interactions: ['Inspect schema', 'Open in notebook', 'Trace lineage'],
    structure: 'Carries schema, preview rows, source path, and upstream/downstream lineage context.',
  },
  {
    kind: 'recipe',
    label: 'Recipe Node',
    description: 'SQL, PySpark, dbt, transformation, or migration-generated execution logic.',
    interactions: ['Inspect code', 'Edit in notebook', 'Run or debug'],
    structure: 'Represents the transformation contract and defines the primary data-flow path between datasets.',
  },
  {
    kind: 'notebook',
    label: 'Notebook Node',
    description: 'Interactive engineering and exploration surface promotable into production flow.',
    interactions: ['Open workspace', 'Parameterize job', 'Promote to flow'],
    structure: 'Keeps notebook-first authoring inside the same DAG instead of splitting work into another system.',
  },
  {
    kind: 'model',
    label: 'Model Node',
    description: 'Experiment, evaluation, or registry-backed model output connected to the same DAG.',
    interactions: ['Compare runs', 'Inspect metrics', 'Send to serving'],
    structure: 'Consumes features from upstream edges and emits scored output back into the flow graph.',
  },
  {
    kind: 'validation',
    label: 'Validation Node',
    description: 'Quality, parity, policy, and migration acceptance checks.',
    interactions: ['Inspect evidence', 'Review thresholds', 'Retry gate'],
    structure: 'Owns validation overlays, schema assertions, and failure boundaries for retries.',
  },
  {
    kind: 'deploy',
    label: 'Deploy Node',
    description: 'Promotion, rollout, rollback, and deployment target handoff.',
    interactions: ['Promote', 'Open rollout logs', 'Rollback'],
    structure: 'Converts validated graph state into release and runtime rollout state without leaving the canvas.',
  },
];

export const FLOW_INTERACTIONS = [
  {
    label: 'Click',
    description: 'Select a node to open schema, runtime, lineage, or deployment inspector details without leaving the canvas.',
  },
  {
    label: 'View toggle',
    description: 'Switch between source and converted flow views while keeping notebook, validation, and deploy nodes inside the same DAG.',
  },
  {
    label: 'Failure highlight',
    description: 'Failed nodes light up the exact path that led to the break so operators can debug without leaving Flow Builder.',
  },
  {
    label: 'Run',
    description: 'Launch the flow from the canvas and stream stage progression through animated edges and node state changes.',
  },
  {
    label: 'Retry from node',
    description: 'Restart execution from the selected node so downstream work can replay without resetting the entire graph.',
  },
];

export const NOTEBOOK_RUNTIME_OPTIONS = [
  {
    value: 'local',
    label: 'Local Runtime',
    description: 'Fast feedback loop for authoring, validation, and dataset inspection.',
  },
  {
    value: 'cluster',
    label: 'Cluster Runtime',
    description: 'Scaled execution profile for production-grade notebook jobs and flow promotion.',
  },
];

export const NOTEBOOK_TABS = [
  { id: 'workspace', label: 'Notebook' },
  { id: 'browser', label: 'Data Browser' },
  { id: 'jobs', label: 'Jobs' },
  { id: 'promotion', label: 'Promotion' },
];

export const RUNTIME_TABS = [
  { id: 'jobs', label: 'Jobs Queue' },
  { id: 'agents', label: 'Agent Fleet' },
  { id: 'runs', label: 'Pipeline Runs' },
  { id: 'deployments', label: 'Deployments' },
];

export const FRONTEND_BACKEND_MAPPING = [
  {
    surface: 'Migration Studio',
    frontend: ['pages/migration-studio.js', 'pages/upload.js'],
    backend: ['/parse', '/convert', '/validate', '/shadow'],
  },
  {
    surface: 'Flow Builder',
    frontend: ['pages/flow.js', 'components/DAGEditor.js'],
    backend: ['/pipelines', '/pipelines/runs', '/jobs', '/deploy'],
  },
  {
    surface: 'Notebook Workspace',
    frontend: ['pages/notebooks.js'],
    backend: ['/notebooks', '/notebooks/open', '/notebooks/{id}', '/notebooks/{id}/flow-binding', '/notebooks/{id}/executions', '/pipelines/validate', '/pipelines/runs/{run_id}/*'],
  },
  {
    surface: 'Catalog + Lineage',
    frontend: ['pages/catalog.js'],
    backend: ['/catalog/datasets', '/catalog/datasets/{id}', '/catalog/datasets/{id}/lineage', '/catalog/datasets/{id}/quality'],
  },
  {
    surface: 'Runtime Operations',
    frontend: ['pages/runtime.js'],
    backend: ['/jobs', '/jobs/{id}', '/agent/fleet', '/pipelines/runs', '/deployments', '/status'],
  },
  {
    surface: 'Connections Hub',
    frontend: ['pages/connections.js', 'components/CloudConnectionsManager.js'],
    backend: ['/connections', '/connections/{id}/test', '/connections/{id}/datasets', '/connections/{id}/datasets/schema'],
  },
];

export const COMPONENT_BREAKDOWN = [
  {
    name: 'PlatformShell',
    role: 'Shared application frame with grouped global and project navigation.',
  },
  {
    name: 'DAGEditor',
    role: 'Unified visual graph surface for flow, lineage, and runtime stage inspection.',
  },
  {
    name: 'Flow Workspace',
    role: 'Inventory rail, DAG canvas, and node inspector for Dataiku-style flow operations.',
  },
  {
    name: 'Notebook Workspace',
    role: 'Notebook tabs, runtime selector, dataset browser, and promotion controls.',
  },
  {
    name: 'Runtime Console',
    role: 'Jobs, agents, pipeline runs, deployment state, filters, and log drill-down.',
  },
  {
    name: 'Connections Manager',
    role: 'Connection testing, dataset discovery, schema browsing, and credential posture.',
  },
];

function toDisplayText(value, fallback) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export function matchesRoute(pathname, href) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function normalizeFlowNodeKind(node = {}) {
  const rawKind = `${node.kind || node.type || node.data?.kind || ''}`.toLowerCase();
  const rawLabel = `${node.label || node.data?.label || node.id || ''}`.toLowerCase();

  if (rawKind.includes('dataset') || rawKind === 'input' || rawKind === 'output' || rawKind === 'artifact') {
    return 'dataset';
  }
  if (rawKind.includes('recipe') || rawKind.includes('transform') || rawKind.includes('task')) {
    return 'recipe';
  }
  if (rawKind.includes('notebook') || rawLabel.includes('notebook')) {
    return 'notebook';
  }
  if (rawKind.includes('model') || rawLabel.includes('model')) {
    return 'model';
  }
  if (rawKind.includes('valid') || rawLabel.includes('quality') || rawLabel.includes('validation')) {
    return 'validation';
  }
  if (rawKind.includes('deploy') || rawLabel.includes('deploy') || rawLabel.includes('promotion')) {
    return 'deploy';
  }
  return 'recipe';
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function buildBaseNodes(pipeline) {
  return ensureArray(pipeline?.dag?.nodes).map((node, index) => ({
    id: node.id || `flow-node-${index + 1}`,
    label: toDisplayText(node.label || node.data?.label, `Flow Step ${index + 1}`),
    description: toDisplayText(node.description || node.data?.description, 'Generated from migration or flow metadata.'),
    kind: normalizeFlowNodeKind(node),
    position: node.position,
    config: node.config || node.data?.config || {},
    execution_binding: node.execution_binding || node.data?.execution_binding || null,
    metadata: node.metadata || {},
    sourceRef: node,
  }));
}

function buildBaseEdges(pipeline) {
  return ensureArray(pipeline?.dag?.edges).map((edge, index) => ({
    id: edge.id || `flow-edge-${index + 1}`,
    source: edge.source,
    target: edge.target,
    flowKind: edge.flowKind || edge.flow_kind || null,
    label: edge.label || '',
  }));
}

function lastNodeId(nodes) {
  return nodes[nodes.length - 1]?.id || null;
}

function pushNode(nodes, nextNode) {
  if (!nodes.some((node) => node.id === nextNode.id)) {
    nodes.push(nextNode);
  }
}

function pushEdge(edges, nextEdge) {
  if (!edges.some((edge) => edge.source === nextEdge.source && edge.target === nextEdge.target)) {
    edges.push(nextEdge);
  }
}

export function buildUnifiedFlowDag(flowDraft, liveAssets = {}, mode = 'converted') {
  const selectedPipeline =
    mode === 'source'
      ? flowDraft?.source_pipeline
      : flowDraft?.converted_pipeline || flowDraft?.source_pipeline;
  const nodes = buildBaseNodes(selectedPipeline);
  const edges = buildBaseEdges(selectedPipeline);
  const program = flowDraft?.migration_program || {};
  const catalog = program.catalog || {};
  const notebook = program.notebook || null;
  const qualityCheck = catalog.quality_check || null;
  const deploymentHandoff = program.deployment_handoff || null;
  const experiments = ensureArray(liveAssets.experiments);

  if (!nodes.length) {
    return { ...FALLBACK_FLOW_DAG };
  }

  const terminalNodeId = lastNodeId(nodes);

  if (notebook) {
    const notebookNodeId = `notebook-${notebook.id || 'workspace'}`;
    pushNode(nodes, {
      id: notebookNodeId,
      label: notebook.title || 'Notebook Workspace',
      description: 'Promoted notebook that remains inside the same production graph.',
      kind: 'notebook',
      metadata: notebook,
    });
    if (terminalNodeId) {
      pushEdge(edges, { id: `edge-${terminalNodeId}-${notebookNodeId}`, source: terminalNodeId, target: notebookNodeId });
    }
  }

  if (qualityCheck) {
    const validationNodeId = `validation-${qualityCheck.id || 'gate'}`;
    const anchorId = nodes[nodes.length - 1]?.id;
    pushNode(nodes, {
      id: validationNodeId,
      label: qualityCheck.check_name || 'Validation Gate',
      description: `Latest status: ${qualityCheck.status || 'unknown'}.`,
      kind: 'validation',
      metadata: qualityCheck,
    });
    if (anchorId) {
      pushEdge(edges, { id: `edge-${anchorId}-${validationNodeId}`, source: anchorId, target: validationNodeId });
    }
  }

  if (experiments.length) {
    const experiment = experiments[0];
    const modelNodeId = `model-${experiment.id}`;
    const anchorId = nodes[nodes.length - 1]?.id;
    pushNode(nodes, {
      id: modelNodeId,
      label: experiment.name || 'Model Candidate',
      description: 'Experiment output connected to the same workflow graph.',
      kind: 'model',
      metadata: experiment,
    });
    if (anchorId) {
      pushEdge(edges, { id: `edge-${anchorId}-${modelNodeId}`, source: anchorId, target: modelNodeId });
    }
  }

  if (deploymentHandoff) {
    const deployNodeId = `deploy-${deploymentHandoff.deployment?.id || 'promotion'}`;
    const anchorId = nodes[nodes.length - 1]?.id;
    pushNode(nodes, {
      id: deployNodeId,
      label: deploymentHandoff.recommended_target || 'Production Flow',
      description: `Promotion mode: ${deploymentHandoff.mode || 'draft'}.`,
      kind: 'deploy',
      metadata: deploymentHandoff,
    });
    if (anchorId) {
      pushEdge(edges, { id: `edge-${anchorId}-${deployNodeId}`, source: anchorId, target: deployNodeId });
    }
  }

  return {
    nodes,
    edges,
    metadata: {
      mode,
      pipelineId: selectedPipeline?.pipeline_id || null,
      sourceLanguage: selectedPipeline?.summary?.language || flowDraft?.meta?.source_language || null,
      targetLanguage: flowDraft?.meta?.target_language || null,
    },
  };
}

export function buildCatalogLineageDag(dataset, lineages = [], datasets = []) {
  if (!dataset) {
    return { nodes: [], edges: [] };
  }

  const datasetById = Object.fromEntries(ensureArray(datasets).map((item) => [item.id, item]));
  const nodes = [
    {
      id: dataset.id,
      label: dataset.name,
      description: dataset.source_path || 'Catalog dataset',
      kind: 'dataset',
      metadata: dataset,
    },
  ];
  const edges = [];

  ensureArray(lineages).forEach((lineage) => {
    const source = datasetById[lineage.source_dataset_id];
    const target = datasetById[lineage.target_dataset_id];
    if (source) {
      pushNode(nodes, {
        id: source.id,
        label: source.name,
        description: source.source_path || 'Upstream dataset',
        kind: 'dataset',
        metadata: source,
      });
    }
    if (target) {
      pushNode(nodes, {
        id: target.id,
        label: target.name,
        description: target.source_path || 'Downstream dataset',
        kind: 'dataset',
        metadata: target,
      });
    }
    pushEdge(edges, {
      id: lineage.id || `lineage-${lineage.source_dataset_id}-${lineage.target_dataset_id}`,
      source: lineage.source_dataset_id,
      target: lineage.target_dataset_id,
    });
  });

  return { nodes, edges };
}

export function summarizeNodeKinds(nodes = []) {
  return nodes.reduce((summary, node) => {
    const kind = normalizeFlowNodeKind(node);
    return {
      ...summary,
      [kind]: (summary[kind] || 0) + 1,
    };
  }, {});
}