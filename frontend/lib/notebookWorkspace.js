import { NOTEBOOK_RUNTIME_OPTIONS } from './platformExperience';

export const NOTEBOOK_CELL_LANGUAGES = [
  {
    id: 'python',
    label: 'Python',
    executor: 'notebook.cell.python',
    description: 'General notebook authoring, orchestration glue, and local analysis logic.',
  },
  {
    id: 'sql',
    label: 'SQL',
    executor: 'notebook.cell.sql',
    description: 'Dataset-aware querying that stays aligned with Flow lineage and warehouse execution.',
  },
  {
    id: 'pyspark',
    label: 'PySpark',
    executor: 'notebook.cell.pyspark',
    description: 'Spark-native cell execution for cluster-bound transformations and scalable data prep.',
  },
];

export const NOTEBOOK_EXECUTION_MODES = [
  {
    id: 'cell',
    label: 'Run cell',
    description: 'Compile a single executable cell into one execution unit while reusing notebook session state.',
  },
  {
    id: 'selection',
    label: 'Run selection',
    description: 'Compile a contiguous selected range of executable cells into one ordered execution plan.',
  },
  {
    id: 'all',
    label: 'Run all',
    description: 'Compile the full notebook into ordered execution units and run it through the shared pipeline engine.',
  },
];

export const NOTEBOOK_OUTPUT_TYPES = [
  {
    id: 'table',
    label: 'Table',
    description: 'Structured tabular output with schema and dataset promotion context.',
  },
  {
    id: 'log',
    label: 'Log stream',
    description: 'Ordered stdout, stderr, and system logs backed by the shared pipeline log cursor model.',
  },
  {
    id: 'chart',
    label: 'Chart',
    description: 'Renderable chart payloads pinned to the cell and the bottom output rail.',
  },
];

export const NOTEBOOK_WORKSPACE_ENTRY_POINTS = [
  {
    source: 'Catalog dataset',
    action: 'Open in Notebook',
    route: '/notebooks?dataset={dataset_id}',
    outcome: 'Hydrates Notebook Workspace with dataset browser context and linked dataset ids.',
  },
  {
    source: 'Flow node',
    action: 'Edit in Notebook',
    route: '/notebooks?node={node_id}&pipeline={pipeline_id}',
    outcome: 'Loads the notebook asset attached to the flow node and keeps the flow binding visible.',
  },
  {
    source: 'Notebook workspace',
    action: 'Create and attach to flow',
    route: '/notebooks?mode=new',
    outcome: 'Creates a notebook asset first, then persists or updates the notebook node through the pipeline authoring contract.',
  },
];

export const NOTEBOOK_WORKSPACE_COMPONENT_STRUCTURE = [
  {
    name: 'NotebookWorkspacePage',
    role: 'Orchestrates notebook hydration, notebook-to-flow bindings, runtime polling, and promotion actions.',
  },
  {
    name: 'NotebookWorkspaceShell',
    role: 'Owns the panel layout for tabs, data browser, workbench, runtime inspector, and output rail.',
  },
  {
    name: 'NotebookTabStrip',
    role: 'Handles multi-tab notebook navigation, dirty state, open context badges, and close or restore behavior.',
  },
  {
    name: 'NotebookPrimaryToolbar',
    role: 'Owns save, run cell, run selection, run all, attach-to-flow, and deploy commands.',
  },
  {
    name: 'NotebookEditorSurface',
    role: 'Renders ordered notebook cells and manages selection, drag targets, and inline execution affordances.',
  },
  {
    name: 'NotebookCellEditor',
    role: 'Provides Monaco-backed editing for Python, SQL, and PySpark cells.',
  },
  {
    name: 'NotebookOutputStack',
    role: 'Renders tables, logs, charts, and errors mapped from shared pipeline telemetry.',
  },
  {
    name: 'NotebookDataBrowserPanel',
    role: 'Shows dataset inventory, previews, schema, and drag-to-cell helpers.',
  },
  {
    name: 'NotebookRuntimeSelector',
    role: 'Selects local or cluster execution and surfaces live resource posture.',
  },
  {
    name: 'NotebookFlowBindingPanel',
    role: 'Shows linked pipeline, linked node, entrypoint cell, parameters, and validation posture.',
  },
  {
    name: 'NotebookExecutionRail',
    role: 'Shows run history, cell status, resource usage, and retry-aware execution context.',
  },
];

export const NOTEBOOK_WORKSPACE_STATE_MODEL = [
  {
    slice: 'workspace',
    fields: ['notebooks', 'datasets', 'pipelines', 'runtimeProfiles', 'nodeCatalog'],
    purpose: 'Hydrates the notebook workspace with notebook inventory, data context, runtime options, and shared node definitions.',
  },
  {
    slice: 'editor',
    fields: ['openTabs', 'activeNotebookId', 'draftNotebooksById', 'dirtyNotebookIds', 'selectedCellId', 'selectionRange'],
    purpose: 'Keeps multi-tab notebook editing explicit and stable under saves, context switches, and flow opens.',
  },
  {
    slice: 'binding',
    fields: ['flowBindingsByNotebookId', 'pipelineId', 'nodeId', 'entrypointCellId', 'validation'],
    purpose: 'Keeps notebook-to-flow linkage aligned with the persisted DAG and validation contract.',
  },
  {
    slice: 'execution',
    fields: ['activeSessionId', 'activeRunId', 'activePipelineId', 'executionMode', 'runtimeTarget', 'runState', 'runNodes', 'logs', 'logCursor', 'cellStatusById', 'resourceUsage', 'busyKey'],
    purpose: 'Tracks interactive runs, runtime selection, live cell status, and local or cluster posture.',
  },
  {
    slice: 'outputs',
    fields: ['outputsByCellId', 'logsByCellId', 'tablesByCellId', 'chartsByCellId'],
    purpose: 'Stores structured results that are derived from shared pipeline node and log telemetry.',
  },
  {
    slice: 'browser',
    fields: ['selectedDatasetId', 'datasetPreviewById', 'dragPayload', 'queryDraft'],
    purpose: 'Drives the dataset browser and drag-to-notebook interactions.',
  },
  {
    slice: 'presentation',
    fields: ['leftPanelMode', 'rightPanelTab', 'bottomRailTab', 'feedback', 'events'],
    purpose: 'Controls visible panels, output focus, and the workspace event stream.',
  },
];

export const NOTEBOOK_WORKSPACE_LAYOUT_BLUEPRINT = [
  {
    zone: 'Top command bar',
    purpose: 'Notebook tabs, save, run modes, runtime picker, attach-to-flow, and deploy commands.',
  },
  {
    zone: 'Left data rail',
    purpose: 'Notebook inventory, dataset browser, schema, previews, and drag sources.',
  },
  {
    zone: 'Center workbench',
    purpose: 'Ordered cell editor surface for Python, SQL, and PySpark authoring.',
  },
  {
    zone: 'Right inspector',
    purpose: 'Runtime selector, flow binding, parameters, validation state, and deployment posture.',
  },
  {
    zone: 'Bottom output rail',
    purpose: 'Tables, logs, charts, run history, and resource usage for the active notebook execution.',
  },
];

export const NOTEBOOK_WORKSPACE_EVENT_SYSTEM = [
  {
    event: 'notebook.dataset.opened',
    producer: 'Catalog dataset action',
    consumer: 'NotebookWorkspacePage',
  },
  {
    event: 'notebook.flow.node.opened',
    producer: 'Flow Builder inspector action',
    consumer: 'NotebookWorkspacePage',
  },
  {
    event: 'notebook.cell.run.requested',
    producer: 'NotebookPrimaryToolbar and NotebookCellToolbar',
    consumer: 'Notebook execution reducer',
  },
  {
    event: 'notebook.execution.started',
    producer: 'Notebook execution effect',
    consumer: 'NotebookExecutionRail and NotebookOutputStack',
  },
  {
    event: 'notebook.execution.updated',
    producer: 'Runtime polling effect',
    consumer: 'NotebookExecutionRail, NotebookOutputStack, and runtime selector',
  },
  {
    event: 'notebook.flow.binding.updated',
    producer: 'NotebookFlowBindingPanel',
    consumer: 'Notebook workspace reducer and Flow Builder refresh path',
  },
  {
    event: 'notebook.promoted',
    producer: 'NotebookPrimaryToolbar',
    consumer: 'Flow Builder and deployment surfaces',
  },
];

export const NOTEBOOK_WORKSPACE_RUNTIME_MODEL = [
  {
    target: 'local',
    description: 'Fast local loop for interactive authoring, validation, and lightweight data inspection.',
    resourceSignals: ['wall_time_ms', 'cpu_ms', 'memory_mb_peak'],
  },
  {
    target: 'cluster',
    description: 'Future-ready scaled execution target for PySpark and production-grade notebook jobs.',
    resourceSignals: ['cluster_id', 'spark_app_id', 'driver_memory_mb', 'executor_memory_mb', 'task_count'],
  },
];

export const NOTEBOOK_WORKSPACE_API_INTEGRATION_POINTS = [
  {
    intent: 'Hydrate notebook inventory and document state',
    client: 'createNotebook, listNotebooks, getNotebook, updateNotebook',
    endpoint: 'POST /notebooks, GET /notebooks, GET /notebooks/{id}, and PUT /notebooks/{id}',
    outcome: 'Notebook documents remain persisted assets without becoming a second orchestration model.',
  },
  {
    intent: 'Open notebook from dataset or flow',
    client: 'openNotebookWorkspace',
    endpoint: 'POST /notebooks/open',
    outcome: 'Notebook Workspace hydrates from a dataset, a flow node, or a new-notebook action in one contract.',
  },
  {
    intent: 'Bind notebook to flow',
    client: 'attachNotebookToFlow and updatePipeline',
    endpoint: 'POST /notebooks/{id}/flow-binding and PUT /pipelines/{pipeline_id}',
    outcome: 'Notebook assets become first-class DAG steps through the existing pipeline authoring contract.',
  },
  {
    intent: 'Validate notebook graph semantics',
    client: 'validatePipelineGraph',
    endpoint: 'POST /pipelines/validate',
    outcome: 'Notebook nodes inherit the same validation and execution-binding rules as Flow Builder.',
  },
  {
    intent: 'Run notebook cells',
    client: 'createPipeline, updatePipeline, runPipeline',
    endpoint: 'POST /pipelines, PUT /pipelines/{pipeline_id}, and POST /pipelines/{pipeline_id}/runs',
    outcome: 'Cell, selection, and run-all requests compile into shared pipeline execution units and return run telemetry.',
  },
  {
    intent: 'Poll run telemetry',
    client: 'getRunStatus, listRunNodes, and listRunLogs',
    endpoint: 'GET /pipelines/runs/{run_id}, GET /pipelines/runs/{run_id}/nodes, and GET /pipelines/runs/{run_id}/logs',
    outcome: 'Notebook output and resource state reuse the same run, node, and log primitives as Flow Builder.',
  },
];

export const NOTEBOOK_WORKSPACE_EXECUTION_FLOW = [
  {
    stage: 'Hydrate context',
    detail: 'Load notebook document, linked datasets, flow binding, runtime defaults, and shared node catalog.',
  },
  {
    stage: 'Choose execution scope',
    detail: 'Resolve whether the request is run cell, run selection, or run all, plus runtime target and parameter payload.',
  },
  {
    stage: 'Compile notebook plan',
    detail: 'Convert executable cells into ordered execution units while preserving notebook-to-flow lineage.',
  },
  {
    stage: 'Persist transient execution pipeline',
    detail: 'Create or update a notebook-specific transient pipeline through the same create and update pipeline endpoints used by Flow Builder.',
  },
  {
    stage: 'Delegate to pipeline runner',
    detail: 'Start a run through POST /pipelines/{pipeline_id}/runs and stream run telemetry back into notebook cells.',
  },
  {
    stage: 'Persist or promote',
    detail: 'Write notebook changes back to the document store and update the bound flow node when the notebook becomes a pipeline step or deployable unit.',
  },
];

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function ensureObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeCellLanguage(cell) {
  const type = `${cell?.type || cell?.cell_type || 'code'}`.toLowerCase();
  if (type === 'markdown') {
    return 'markdown';
  }
  return `${cell?.metadata?.language || 'python'}`.toLowerCase();
}

function normalizeCellType(cell) {
  const rawType = `${cell?.type || cell?.cell_type || 'code'}`.toLowerCase();
  return rawType === 'markdown' ? 'markdown' : 'code';
}

function slugify(value) {
  return `${value || 'notebook'}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'notebook';
}

function sampleValueForType(type, index) {
  const normalized = `${type || ''}`.toLowerCase();
  if (normalized.includes('int') || normalized.includes('number') || normalized.includes('decimal')) {
    return index + 1;
  }
  if (normalized.includes('bool')) {
    return index % 2 === 0;
  }
  if (normalized.includes('date') || normalized.includes('time')) {
    return '2026-04-06T00:00:00Z';
  }
  return `sample_${index + 1}`;
}

function createTabDescriptor(notebook, openContext = {}, flowBinding = null) {
  return {
    notebookId: notebook.id,
    title: notebook.title || 'Untitled Notebook',
    badge:
      openContext.source_type === 'flow_node'
        ? 'Flow'
        : openContext.source_type === 'dataset'
        ? 'Dataset'
        : flowBinding?.pipeline_id
        ? 'Bound'
        : 'Notebook',
  };
}

function nextSelectedCellId(notebook, fallback = '') {
  const firstCell = ensureArray(notebook?.cells)[0];
  return firstCell?.id || fallback || '';
}

function withDirtyNotebookIds(dirtyNotebookIds, notebookId, dirty = true) {
  const ids = new Set(ensureArray(dirtyNotebookIds));
  if (dirty) {
    ids.add(notebookId);
  } else {
    ids.delete(notebookId);
  }
  return [...ids];
}

function patchNotebookCell(notebook, cellId, updater) {
  const cells = ensureArray(notebook.cells);
  return {
    ...notebook,
    cells: cells.map((cell) => {
      if (cell.id !== cellId) {
        return cell;
      }
      return updater(cell);
    }),
  };
}

function normalizeOutputArtifact(artifact) {
  const outputType = `${artifact?.output_type || artifact?.type || 'log'}`.toLowerCase();
  return {
    ...artifact,
    output_type: outputType,
  };
}

export function createNotebookWorkspaceEvent(type, title, detail, payload = {}) {
  return {
    id: `${type}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    type,
    title,
    detail,
    payload,
    timestamp: new Date().toISOString(),
  };
}

export function createNotebookCell({ type = 'code', language = 'python', content = '', metadata = {} } = {}) {
  const normalizedType = type === 'markdown' ? 'markdown' : 'code';
  return {
    id: `cell-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    type: normalizedType,
    content,
    execution_count: null,
    outputs: [],
    metadata: {
      ...metadata,
      language: normalizedType === 'markdown' ? 'markdown' : `${language || 'python'}`.toLowerCase(),
    },
  };
}

export function normalizeNotebookDocument(notebook) {
  const normalizedMetadata = {
    dataset_links: [],
    flow_binding: null,
    runtime_defaults: {
      target: 'local',
      profile: 'local',
    },
    execution_pipeline_id: null,
    ...ensureObject(notebook?.metadata),
  };
  normalizedMetadata.dataset_links = ensureArray(normalizedMetadata.dataset_links);
  normalizedMetadata.runtime_defaults = {
    target: normalizedMetadata.runtime_defaults?.target || 'local',
    profile: normalizedMetadata.runtime_defaults?.profile || normalizedMetadata.runtime_defaults?.target || 'local',
  };

  return {
    id: notebook?.id || '',
    title: notebook?.title || 'Untitled Notebook',
    created_at: notebook?.created_at || null,
    updated_at: notebook?.updated_at || null,
    metadata: normalizedMetadata,
    cells: ensureArray(notebook?.cells).map((cell, index) => ({
      id: cell?.id || `cell-${index + 1}`,
      type: normalizeCellType(cell),
      content: `${cell?.content || (Array.isArray(cell?.source) ? cell.source.join('\n') : '')}`,
      execution_count: cell?.execution_count ?? null,
      outputs: ensureArray(cell?.outputs),
      metadata: {
        ...ensureObject(cell?.metadata),
        language: normalizeCellLanguage(cell),
      },
    })),
  };
}

export function createInitialNotebookWorkspaceState(initial = {}) {
  return {
    workspace: {
      notebooks: [],
      datasets: [],
      pipelines: [],
      runtimeProfiles: NOTEBOOK_RUNTIME_OPTIONS,
      nodeCatalog: [],
    },
    editor: {
      openTabs: [],
      activeNotebookId: initial.notebookId || '',
      draftNotebooksById: {},
      dirtyNotebookIds: [],
      selectedCellId: '',
      selectionRange: [],
    },
    binding: {
      flowBindingsByNotebookId: {},
      pipelineId: initial.pipelineId || '',
      nodeId: initial.nodeId || '',
      entrypointCellId: initial.entrypointCellId || '',
      validation: null,
    },
    execution: {
      activeSessionId: '',
      activeRunId: '',
      activePipelineId: '',
      executionMode: 'cell',
      runtimeTarget: initial.runtimeTarget || 'local',
      runState: null,
      runNodes: [],
      logs: [],
      logCursor: 0,
      cellStatusById: {},
      resourceUsage: null,
      busyKey: '',
    },
    outputs: {
      outputsByCellId: {},
      logsByCellId: {},
      tablesByCellId: {},
      chartsByCellId: {},
    },
    browser: {
      selectedDatasetId: initial.datasetId || '',
      datasetPreviewById: {},
      dragPayload: null,
      queryDraft: '',
    },
    presentation: {
      leftPanelMode: 'notebooks',
      rightPanelTab: 'binding',
      bottomRailTab: 'outputs',
      feedback: '',
      events: [],
    },
  };
}

export function getActiveNotebook(state) {
  return state?.editor?.draftNotebooksById?.[state?.editor?.activeNotebookId] || null;
}

export function buildNotebookFlowBindingPayload(notebook, state, overrides = {}) {
  const activeNotebook = normalizeNotebookDocument(notebook);
  const linkedDatasetIds = overrides.linkedDatasetIds || activeNotebook.metadata.dataset_links || [];
  const entrypointCell = overrides.entrypointCell || state.binding.entrypointCellId || state.editor.selectedCellId || activeNotebook.cells[0]?.id || '';
  return {
    pipeline_id: overrides.pipelineId || state.binding.pipelineId,
    attach_mode: overrides.attachMode || (overrides.nodeId || state.binding.nodeId ? 'existing_node' : 'new_node'),
    node_id: overrides.nodeId || state.binding.nodeId || undefined,
    label: overrides.label || activeNotebook.title || 'Notebook Step',
    description: overrides.description || 'Notebook workspace step persisted from the interactive notebook editor.',
    config: {
      runtime_profile: overrides.runtimeProfile || state.execution.runtimeTarget,
      entrypoint_cell: entrypointCell,
      parameters: overrides.parameters || ensureObject(activeNotebook.metadata.parameter_defaults),
      linked_dataset_ids: linkedDatasetIds,
      retry_limit: overrides.retryLimit || 1,
    },
  };
}

export function buildNotebookExecutionTelemetry(runNodes = [], logs = []) {
  const outputsByCellId = {};
  const logsByCellId = {};
  const tablesByCellId = {};
  const chartsByCellId = {};
  const cellStatusById = {};
  const nodeById = new Map();

  ensureArray(runNodes).forEach((node) => {
    nodeById.set(node.node_id, node);
    const metadata = ensureObject(node.metadata);
    const cellId = metadata.notebook_cell_id || metadata.source_ref?.cell_id || metadata.sourceRef?.cell_id;
    if (!cellId) {
      return;
    }
    cellStatusById[cellId] = node.status;
    const artifacts = ensureArray(metadata.output_artifacts).map(normalizeOutputArtifact);
    outputsByCellId[cellId] = artifacts;
    tablesByCellId[cellId] = artifacts.filter((artifact) => artifact.output_type === 'table');
    chartsByCellId[cellId] = artifacts.filter((artifact) => artifact.output_type === 'chart');
  });

  ensureArray(logs).forEach((log) => {
    const node = nodeById.get(log.node_id);
    const metadata = ensureObject(node?.metadata);
    const cellId = metadata.notebook_cell_id || metadata.source_ref?.cell_id || metadata.sourceRef?.cell_id;
    if (!cellId) {
      return;
    }
    logsByCellId[cellId] = [...(logsByCellId[cellId] || []), log];
  });

  return {
    outputsByCellId,
    logsByCellId,
    tablesByCellId,
    chartsByCellId,
    cellStatusById,
  };
}

function fallbackExpression(language, title, index) {
  if (language === 'sql') {
    return 'SELECT 1 AS notebook_execution_unit';
  }
  if (language === 'pyspark') {
    return 'spark.range(1).show()';
  }
  return `print("${title || 'Notebook'} execution unit ${index + 1}")`;
}

function buildCellOutputArtifacts(cell, linkedDatasetIds, datasetsById = {}) {
  const language = normalizeCellLanguage(cell);
  const primaryDataset = linkedDatasetIds.map((datasetId) => datasetsById[datasetId]).find(Boolean);
  const artifacts = [];

  if (language === 'sql' && primaryDataset) {
    const columns = ensureArray(primaryDataset.schema).map((column) => ({
      name: column.name,
      type: column.type,
    }));
    const row = columns.reduce((result, column, index) => ({
      ...result,
      [column.name]: sampleValueForType(column.type, index),
    }), {});
    artifacts.push({
      id: `table-${cell.id}`,
      output_type: 'table',
      title: `${primaryDataset.name} preview`,
      columns,
      rows: columns.length ? [row] : [],
    });
  }

  if (/(plot|chart|matplotlib|seaborn|plotly|px\.)/i.test(cell.content || '')) {
    artifacts.push({
      id: `chart-${cell.id}`,
      output_type: 'chart',
      title: 'Chart preview',
      spec: {
        kind: 'bar',
        series: [
          { label: 'A', value: 14 },
          { label: 'B', value: 22 },
          { label: 'C', value: 9 },
        ],
      },
    });
  }

  artifacts.push({
    id: `log-${cell.id}`,
    output_type: 'log',
    title: 'Execution summary',
    text: `Compiled ${language} cell into a shared pipeline execution unit.`,
  });
  return artifacts;
}

export function compileNotebookToExecutionGraph(notebook, options = {}) {
  const normalizedNotebook = normalizeNotebookDocument(notebook);
  const runtimeTarget = options.runtimeTarget || normalizedNotebook.metadata.runtime_defaults.target || 'local';
  const linkedDatasetIds = ensureArray(options.linkedDatasetIds || normalizedNotebook.metadata.dataset_links);
  const datasetsById = ensureObject(options.datasetsById);
  const mode = options.mode || 'all';
  const selectedCellId = options.selectedCellId || '';
  const selectionRange = ensureArray(options.selectionRange);
  const executableCells = normalizedNotebook.cells.filter((cell) => cell.type === 'code');

  let selectedCells = executableCells;
  if (mode === 'cell' && selectedCellId) {
    selectedCells = executableCells.filter((cell) => cell.id === selectedCellId);
  }
  if (mode === 'selection' && selectionRange.length) {
    const selectedIds = new Set(selectionRange);
    selectedCells = executableCells.filter((cell) => selectedIds.has(cell.id));
  }

  const nodes = selectedCells.map((cell, index) => {
    const language = normalizeCellLanguage(cell);
    const recipeLanguage = language === 'sql' ? 'sql' : language === 'pyspark' ? 'pyspark' : 'python';
    const outputDatasetName = `${slugify(normalizedNotebook.title)}_${index + 1}`;
    const runtimeProfile =
      recipeLanguage === 'sql'
        ? 'warehouse-sql'
        : recipeLanguage === 'pyspark'
        ? runtimeTarget === 'cluster'
          ? 'spark-cluster'
          : 'python-batch'
        : 'python-batch';
    return {
      id: `nb-${normalizedNotebook.id}-cell-${cell.id}`,
      kind: 'recipe',
      label: `Cell ${index + 1}`,
      description: `${recipeLanguage.toUpperCase()} execution unit compiled from notebook ${normalizedNotebook.title}.`,
      position: { x: 180 + index * 240, y: 220 },
      config: {
        language: recipeLanguage,
        runtime_profile: runtimeProfile,
        expression: `${cell.content || ''}`.trim() || fallbackExpression(recipeLanguage, normalizedNotebook.title, index),
        output_dataset_name: outputDatasetName,
        materialization: 'view',
        parameter_bindings: ensureObject(options.parameters),
      },
      metadata: {
        notebook_id: normalizedNotebook.id,
        notebook_title: normalizedNotebook.title,
        notebook_cell_id: cell.id,
        cell_index: index,
        cell_language: language,
        runtime_target: runtimeTarget,
        linked_dataset_ids: linkedDatasetIds,
        output_artifacts: buildCellOutputArtifacts(cell, linkedDatasetIds, datasetsById),
      },
      sourceRef: {
        notebook_id: normalizedNotebook.id,
        cell_id: cell.id,
        type: 'notebook_cell',
      },
    };
  });

  const edges = nodes.slice(1).map((node, index) => ({
    id: `edge-${nodes[index].id}-${node.id}`,
    source: nodes[index].id,
    target: node.id,
  }));

  return {
    nodes,
    edges,
    metadata: {
      notebook_id: normalizedNotebook.id,
      notebook_title: normalizedNotebook.title,
      execution_mode: mode,
      runtime_target: runtimeTarget,
      selected_cell_ids: selectedCells.map((cell) => cell.id),
    },
  };
}

export function notebookWorkspaceReducer(state, action) {
  switch (action.type) {
    case 'hydrate-workspace': {
      return {
        ...state,
        workspace: {
          ...state.workspace,
          notebooks: ensureArray(action.notebooks),
          datasets: ensureArray(action.datasets),
          nodeCatalog: ensureArray(action.nodeCatalog),
          pipelines: ensureArray(action.pipelines),
        },
        browser: {
          ...state.browser,
          selectedDatasetId: action.selectedDatasetId || state.browser.selectedDatasetId,
        },
      };
    }
    case 'open-notebook': {
      const notebook = normalizeNotebookDocument(action.notebook);
      const flowBinding = action.flowBinding || notebook.metadata.flow_binding || null;
      const openTabs = [...state.editor.openTabs];
      if (!openTabs.some((tab) => tab.notebookId === notebook.id)) {
        openTabs.push(createTabDescriptor(notebook, action.openContext || {}, flowBinding));
      }
      return {
        ...state,
        editor: {
          ...state.editor,
          openTabs,
          activeNotebookId: notebook.id,
          draftNotebooksById: {
            ...state.editor.draftNotebooksById,
            [notebook.id]: notebook,
          },
          selectedCellId: nextSelectedCellId(notebook, state.editor.selectedCellId),
          selectionRange: [],
        },
        binding: {
          ...state.binding,
          flowBindingsByNotebookId: {
            ...state.binding.flowBindingsByNotebookId,
            [notebook.id]: flowBinding,
          },
          pipelineId: flowBinding?.pipeline_id || action.openContext?.flow?.pipeline_id || state.binding.pipelineId,
          nodeId: flowBinding?.node_id || action.openContext?.flow?.node_id || state.binding.nodeId,
          entrypointCellId: flowBinding?.entrypoint_cell || state.binding.entrypointCellId,
        },
        browser: {
          ...state.browser,
          selectedDatasetId: action.openContext?.dataset_id || state.browser.selectedDatasetId,
        },
      };
    }
    case 'close-notebook-tab': {
      const nextTabs = state.editor.openTabs.filter((tab) => tab.notebookId !== action.notebookId);
      const nextDrafts = { ...state.editor.draftNotebooksById };
      delete nextDrafts[action.notebookId];
      const nextActiveNotebookId =
        state.editor.activeNotebookId === action.notebookId ? nextTabs[nextTabs.length - 1]?.notebookId || '' : state.editor.activeNotebookId;
      const activeNotebook = nextDrafts[nextActiveNotebookId];
      return {
        ...state,
        editor: {
          ...state.editor,
          openTabs: nextTabs,
          draftNotebooksById: nextDrafts,
          activeNotebookId: nextActiveNotebookId,
          selectedCellId: nextSelectedCellId(activeNotebook, ''),
          dirtyNotebookIds: withDirtyNotebookIds(state.editor.dirtyNotebookIds, action.notebookId, false),
        },
      };
    }
    case 'select-notebook-tab': {
      const activeNotebook = state.editor.draftNotebooksById[action.notebookId];
      return {
        ...state,
        editor: {
          ...state.editor,
          activeNotebookId: action.notebookId,
          selectedCellId: nextSelectedCellId(activeNotebook, state.editor.selectedCellId),
          selectionRange: [],
        },
        binding: {
          ...state.binding,
          pipelineId: state.binding.flowBindingsByNotebookId[action.notebookId]?.pipeline_id || state.binding.pipelineId,
          nodeId: state.binding.flowBindingsByNotebookId[action.notebookId]?.node_id || state.binding.nodeId,
        },
      };
    }
    case 'sync-notebook': {
      const notebook = normalizeNotebookDocument(action.notebook);
      const activeNotebookId = notebook.id || state.editor.activeNotebookId;
      return {
        ...state,
        editor: {
          ...state.editor,
          activeNotebookId,
          draftNotebooksById: {
            ...state.editor.draftNotebooksById,
            [activeNotebookId]: notebook,
          },
          dirtyNotebookIds: withDirtyNotebookIds(state.editor.dirtyNotebookIds, activeNotebookId, false),
          selectedCellId: nextSelectedCellId(notebook, state.editor.selectedCellId),
        },
      };
    }
    case 'update-notebook-title': {
      const activeNotebook = getActiveNotebook(state);
      if (!activeNotebook) {
        return state;
      }
      const notebook = {
        ...activeNotebook,
        title: action.title,
      };
      return {
        ...state,
        editor: {
          ...state.editor,
          draftNotebooksById: {
            ...state.editor.draftNotebooksById,
            [notebook.id]: notebook,
          },
          dirtyNotebookIds: withDirtyNotebookIds(state.editor.dirtyNotebookIds, notebook.id, true),
          openTabs: state.editor.openTabs.map((tab) => (tab.notebookId === notebook.id ? { ...tab, title: action.title } : tab)),
        },
      };
    }
    case 'set-active-cell': {
      return {
        ...state,
        editor: {
          ...state.editor,
          selectedCellId: action.cellId,
          selectionRange: action.extendSelection ? [...new Set([...state.editor.selectionRange, action.cellId])] : [action.cellId],
        },
      };
    }
    case 'set-selection-range': {
      return {
        ...state,
        editor: {
          ...state.editor,
          selectionRange: ensureArray(action.cellIds),
        },
      };
    }
    case 'update-cell': {
      const activeNotebook = getActiveNotebook(state);
      if (!activeNotebook) {
        return state;
      }
      const notebook = patchNotebookCell(activeNotebook, action.cellId, (cell) => ({
        ...cell,
        ...action.updates,
        metadata: {
          ...cell.metadata,
          ...ensureObject(action.updates?.metadata),
        },
      }));
      return {
        ...state,
        editor: {
          ...state.editor,
          draftNotebooksById: {
            ...state.editor.draftNotebooksById,
            [notebook.id]: notebook,
          },
          dirtyNotebookIds: withDirtyNotebookIds(state.editor.dirtyNotebookIds, notebook.id, true),
        },
      };
    }
    case 'add-cell-after': {
      const activeNotebook = getActiveNotebook(state);
      if (!activeNotebook) {
        return state;
      }
      const nextCell = createNotebookCell(action.cell || {});
      const cells = ensureArray(activeNotebook.cells);
      const insertIndex = action.afterCellId ? cells.findIndex((cell) => cell.id === action.afterCellId) + 1 : cells.length;
      const notebook = {
        ...activeNotebook,
        cells: [...cells.slice(0, Math.max(0, insertIndex)), nextCell, ...cells.slice(Math.max(0, insertIndex))],
      };
      return {
        ...state,
        editor: {
          ...state.editor,
          draftNotebooksById: {
            ...state.editor.draftNotebooksById,
            [notebook.id]: notebook,
          },
          dirtyNotebookIds: withDirtyNotebookIds(state.editor.dirtyNotebookIds, notebook.id, true),
          selectedCellId: nextCell.id,
          selectionRange: [nextCell.id],
        },
      };
    }
    case 'delete-cell': {
      const activeNotebook = getActiveNotebook(state);
      if (!activeNotebook) {
        return state;
      }
      const cells = ensureArray(activeNotebook.cells).filter((cell) => cell.id !== action.cellId);
      const notebook = {
        ...activeNotebook,
        cells,
      };
      return {
        ...state,
        editor: {
          ...state.editor,
          draftNotebooksById: {
            ...state.editor.draftNotebooksById,
            [notebook.id]: notebook,
          },
          dirtyNotebookIds: withDirtyNotebookIds(state.editor.dirtyNotebookIds, notebook.id, true),
          selectedCellId: nextSelectedCellId(notebook, ''),
          selectionRange: cells.length ? [cells[0].id] : [],
        },
      };
    }
    case 'set-browser-dataset': {
      return {
        ...state,
        browser: {
          ...state.browser,
          selectedDatasetId: action.datasetId,
        },
      };
    }
    case 'link-dataset': {
      const activeNotebook = getActiveNotebook(state);
      if (!activeNotebook) {
        return state;
      }
      const currentLinks = ensureArray(activeNotebook.metadata.dataset_links);
      const notebook = {
        ...activeNotebook,
        metadata: {
          ...activeNotebook.metadata,
          dataset_links: [...new Set([...currentLinks, action.datasetId])],
        },
      };
      return {
        ...state,
        editor: {
          ...state.editor,
          draftNotebooksById: {
            ...state.editor.draftNotebooksById,
            [notebook.id]: notebook,
          },
          dirtyNotebookIds: withDirtyNotebookIds(state.editor.dirtyNotebookIds, notebook.id, true),
        },
      };
    }
    case 'set-flow-binding': {
      const activeNotebookId = action.notebookId || state.editor.activeNotebookId;
      return {
        ...state,
        binding: {
          ...state.binding,
          flowBindingsByNotebookId: {
            ...state.binding.flowBindingsByNotebookId,
            [activeNotebookId]: action.flowBinding,
          },
          pipelineId: action.flowBinding?.pipeline_id || state.binding.pipelineId,
          nodeId: action.flowBinding?.node_id || state.binding.nodeId,
          validation: action.validation || state.binding.validation,
          entrypointCellId: action.entrypointCellId || state.binding.entrypointCellId,
        },
      };
    }
    case 'set-validation': {
      return {
        ...state,
        binding: {
          ...state.binding,
          validation: action.validation,
        },
      };
    }
    case 'set-runtime-target': {
      return {
        ...state,
        execution: {
          ...state.execution,
          runtimeTarget: action.runtimeTarget,
        },
      };
    }
    case 'set-busy-key': {
      return {
        ...state,
        execution: {
          ...state.execution,
          busyKey: action.busyKey,
        },
      };
    }
    case 'execution-started': {
      return {
        ...state,
        execution: {
          ...state.execution,
          activeSessionId: action.sessionId || action.runId,
          activeRunId: action.runId,
          activePipelineId: action.pipelineId,
          executionMode: action.executionMode || state.execution.executionMode,
          runState: action.runState || null,
          runNodes: [],
          logs: [],
          logCursor: 0,
          cellStatusById: {},
          resourceUsage: null,
        },
        outputs: {
          outputsByCellId: {},
          logsByCellId: {},
          tablesByCellId: {},
          chartsByCellId: {},
        },
      };
    }
    case 'execution-updated': {
      return {
        ...state,
        execution: {
          ...state.execution,
          runState: action.runState,
          runNodes: ensureArray(action.runNodes),
          logs: ensureArray(action.logs),
          logCursor: action.logCursor ?? state.execution.logCursor,
          cellStatusById: action.cellStatusById || state.execution.cellStatusById,
          resourceUsage: action.resourceUsage || state.execution.resourceUsage,
        },
        outputs: {
          outputsByCellId: action.outputsByCellId || state.outputs.outputsByCellId,
          logsByCellId: action.logsByCellId || state.outputs.logsByCellId,
          tablesByCellId: action.tablesByCellId || state.outputs.tablesByCellId,
          chartsByCellId: action.chartsByCellId || state.outputs.chartsByCellId,
        },
      };
    }
    case 'set-feedback': {
      return {
        ...state,
        presentation: {
          ...state.presentation,
          feedback: action.feedback,
        },
      };
    }
    case 'append-event': {
      return {
        ...state,
        presentation: {
          ...state.presentation,
          events: [action.event, ...state.presentation.events].slice(0, 20),
        },
      };
    }
    default:
      return state;
  }
}