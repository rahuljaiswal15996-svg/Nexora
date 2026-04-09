function cloneConfigDefaults(definition) {
  return (definition?.config_schema || []).reduce((config, field) => {
    config[field.name] = structuredCloneSafe(field.default);
    return config;
  }, {});
}

function structuredCloneSafe(value) {
  if (Array.isArray(value)) {
    return value.map((item) => structuredCloneSafe(item));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, structuredCloneSafe(item)]));
  }
  return value;
}

function makeNodeId(kind) {
  return `${kind}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function makeEdgeId(source, target) {
  return `${source}__${target}`;
}

function normalizePosition(position, index) {
  if (typeof position?.x === 'number' && typeof position?.y === 'number') {
    return position;
  }
  return {
    x: 140 + (index % 3) * 260,
    y: 100 + Math.floor(index / 3) * 180,
  };
}

function normalizeDraftNode(node, index) {
  return {
    id: node.id || `draft-node-${index + 1}`,
    kind: node.kind || node.data?.kind || 'recipe',
    label: node.label || node.data?.label || `Flow Step ${index + 1}`,
    description: node.description || node.data?.description || '',
    position: normalizePosition(node.position, index),
    config: node.config || node.data?.config || {},
    execution_binding: node.execution_binding || node.data?.execution_binding || null,
    metadata: node.metadata || {},
    sourceRef: node.sourceRef || node,
  };
}

function normalizeDraftEdge(edge, index) {
  return {
    id: edge.id || `draft-edge-${index + 1}`,
    source: edge.source,
    target: edge.target,
    flowKind: edge.flowKind || edge.flow_kind || 'data',
    label: edge.label || '',
  };
}

function requiredValuePresent(field, value) {
  if (!field?.required) {
    return true;
  }
  if (field.type === 'boolean') {
    return true;
  }
  if (field.type === 'tags') {
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    return Boolean(`${value || ''}`.split(',').map((item) => item.trim()).filter(Boolean).length);
  }
  if (field.type === 'json') {
    return Boolean(`${value ?? ''}`.trim()) || (value && typeof value === 'object');
  }
  return Boolean(`${value ?? ''}`.trim());
}

function validateFieldValue(field, value) {
  const issues = [];
  if (!requiredValuePresent(field, value)) {
    issues.push(`${field.label} is required.`);
  }

  if (field.type === 'select' && value && Array.isArray(field.options)) {
    const optionValues = field.options.map((option) => option.value);
    if (!optionValues.includes(value)) {
      issues.push(`${field.label} must be one of: ${optionValues.join(', ')}.`);
    }
  }

  if (field.type === 'number' && `${value ?? ''}`.trim()) {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      issues.push(`${field.label} must be a number.`);
    } else {
      if (field.min !== undefined && parsed < field.min) {
        issues.push(`${field.label} must be greater than or equal to ${field.min}.`);
      }
      if (field.max !== undefined && parsed > field.max) {
        issues.push(`${field.label} must be less than or equal to ${field.max}.`);
      }
    }
  }

  if (field.type === 'json' && `${value ?? ''}`.trim()) {
    try {
      const parsed = typeof value === 'string' ? JSON.parse(value) : value;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        issues.push(`${field.label} must be a JSON object.`);
      }
    } catch {
      issues.push(`${field.label} must be valid JSON.`);
    }
  }

  return issues;
}

function detectCycles(nodes, edges) {
  const nodeIds = nodes.map((node) => node.id);
  const inboundCount = Object.fromEntries(nodeIds.map((nodeId) => [nodeId, 0]));
  const adjacency = Object.fromEntries(nodeIds.map((nodeId) => [nodeId, []]));

  edges.forEach((edge) => {
    if (!adjacency[edge.source] || !adjacency[edge.target]) {
      return;
    }
    adjacency[edge.source].push(edge.target);
    inboundCount[edge.target] += 1;
  });

  const queue = nodeIds.filter((nodeId) => inboundCount[nodeId] === 0);
  const ordered = [];
  while (queue.length) {
    const currentNodeId = queue.shift();
    ordered.push(currentNodeId);
    adjacency[currentNodeId].forEach((targetId) => {
      inboundCount[targetId] -= 1;
      if (inboundCount[targetId] === 0) {
        queue.push(targetId);
      }
    });
  }
  return ordered.length !== nodeIds.length;
}

export function createEmptyValidationState() {
  return {
    valid: true,
    errors: [],
    warnings: [],
    node_results: [],
    graph: {
      entrypoint_node_ids: [],
      terminal_node_ids: [],
      topological_order: [],
      executable_node_ids: [],
    },
    normalized_dag: null,
    origin: 'local',
  };
}

export function createInitialFlowAuthoringState() {
  return {
    nodeCatalog: [],
    draftDag: { nodes: [], edges: [], metadata: {} },
    selectedEdgeId: '',
    validation: createEmptyValidationState(),
    dirty: false,
    busyKey: '',
  };
}

export function getNodeDefinition(nodeCatalog = [], kind) {
  const normalizedKind = `${kind || ''}`.trim().toLowerCase();
  return nodeCatalog.find((definition) => `${definition.kind || ''}`.trim().toLowerCase() === normalizedKind) || null;
}

export function hydrateAuthoringDag(dag) {
  const nodes = Array.isArray(dag?.nodes) ? dag.nodes.map(normalizeDraftNode) : [];
  const edges = Array.isArray(dag?.edges) ? dag.edges.map(normalizeDraftEdge) : [];
  return {
    nodes,
    edges,
    metadata: dag?.metadata || {},
  };
}

export function createNodeFromDefinition(definition, index = 0) {
  if (!definition) {
    return null;
  }
  return {
    id: makeNodeId(definition.kind || 'recipe'),
    kind: definition.kind || 'recipe',
    label: definition.default_label || definition.label || 'Flow Node',
    description: definition.description || '',
    position: normalizePosition(null, index),
    config: cloneConfigDefaults(definition),
    execution_binding: structuredCloneSafe(definition.execution_binding_template || null),
    metadata: { created_from_palette: true },
    sourceRef: null,
  };
}

export function validateDraftGraphLocally(draftDag, nodeCatalog = []) {
  const nodes = Array.isArray(draftDag?.nodes) ? draftDag.nodes : [];
  const edges = Array.isArray(draftDag?.edges) ? draftDag.edges : [];
  const errors = [];
  const warnings = [];
  const node_results = [];
  const seenNodeIds = new Set();
  const seenEdgePairs = new Set();
  const nodeLookup = Object.fromEntries(nodes.map((node) => [node.id, node]));
  const inboundCounts = Object.fromEntries(nodes.map((node) => [node.id, 0]));
  const outboundCounts = Object.fromEntries(nodes.map((node) => [node.id, 0]));

  nodes.forEach((node) => {
    const definition = getNodeDefinition(nodeCatalog, node.kind);
    const nodeErrors = [];
    const nodeWarnings = [];

    if (!node.id) {
      nodeErrors.push({ scope: 'node', node_id: node.id, message: 'Node id is required.' });
    }
    if (seenNodeIds.has(node.id)) {
      nodeErrors.push({ scope: 'node', node_id: node.id, message: `Duplicate node id: ${node.id}.` });
    }
    seenNodeIds.add(node.id);

    if (!definition) {
      nodeErrors.push({ scope: 'node', node_id: node.id, message: `Unsupported node kind: ${node.kind}.` });
    }

    (definition?.config_schema || []).forEach((field) => {
      validateFieldValue(field, node.config?.[field.name]).forEach((message) => {
        nodeErrors.push({ scope: 'node', node_id: node.id, field: field.name, message });
      });
    });

    if (node.kind === 'deploy') {
      nodeWarnings.push({ scope: 'node', node_id: node.id, message: 'Deployment nodes should usually terminate the graph.' });
    }

    errors.push(...nodeErrors);
    warnings.push(...nodeWarnings);
    node_results.push({ node_id: node.id, kind: node.kind, label: node.label, valid: nodeErrors.length === 0, errors: nodeErrors, warnings: nodeWarnings });
  });

  edges.forEach((edge) => {
    if (!edge.source || !edge.target) {
      errors.push({ scope: 'edge', edge_id: edge.id, message: 'Edges must define both source and target.' });
      return;
    }
    if (!nodeLookup[edge.source] || !nodeLookup[edge.target]) {
      errors.push({ scope: 'edge', edge_id: edge.id, message: 'Edges must connect existing nodes.' });
      return;
    }
    if (edge.source === edge.target) {
      errors.push({ scope: 'edge', edge_id: edge.id, message: 'Self-referencing edges are not allowed.' });
      return;
    }
    const pairKey = `${edge.source}__${edge.target}`;
    if (seenEdgePairs.has(pairKey)) {
      warnings.push({ scope: 'edge', edge_id: edge.id, message: 'Duplicate edge detected.' });
      return;
    }
    seenEdgePairs.add(pairKey);
    inboundCounts[edge.target] += 1;
    outboundCounts[edge.source] += 1;
  });

  if (detectCycles(nodes, edges)) {
    errors.push({ scope: 'graph', message: 'Graph contains a cycle. Flow Builder requires a DAG.' });
  }

  const entrypoint_node_ids = nodes.filter((node) => inboundCounts[node.id] === 0).map((node) => node.id);
  const terminal_node_ids = nodes.filter((node) => outboundCounts[node.id] === 0).map((node) => node.id);
  const executable_node_ids = nodes.filter((node) => node.kind !== 'dataset').map((node) => node.id);

  if (!entrypoint_node_ids.length && nodes.length) {
    errors.push({ scope: 'graph', message: 'Graph must contain at least one entrypoint node.' });
  }
  if (!terminal_node_ids.length && nodes.length) {
    errors.push({ scope: 'graph', message: 'Graph must contain at least one terminal node.' });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    node_results,
    graph: {
      entrypoint_node_ids,
      terminal_node_ids,
      topological_order: nodes.map((node) => node.id),
      executable_node_ids,
    },
    normalized_dag: null,
    origin: 'local',
  };
}

export function getNodeValidation(validation, nodeId) {
  return validation?.node_results?.find((result) => result.node_id === nodeId) || null;
}

export function getGraphIssueCounts(validation) {
  return {
    errors: Array.isArray(validation?.errors) ? validation.errors.length : 0,
    warnings: Array.isArray(validation?.warnings) ? validation.warnings.length : 0,
  };
}

export function flowAuthoringReducer(state, action) {
  switch (action.type) {
    case 'hydrate-catalog':
      return {
        ...state,
        nodeCatalog: Array.isArray(action.items) ? action.items : [],
      };
    case 'hydrate-dag':
      return {
        ...state,
        draftDag: hydrateAuthoringDag(action.dag),
        selectedEdgeId: '',
        validation: action.validation || createEmptyValidationState(),
        dirty: false,
      };
    case 'set-busy-key':
      return {
        ...state,
        busyKey: action.busyKey || '',
      };
    case 'select-edge':
      return {
        ...state,
        selectedEdgeId: action.edgeId || '',
      };
    case 'set-validation':
      return {
        ...state,
        validation: action.validation || createEmptyValidationState(),
      };
    case 'mark-clean':
      return {
        ...state,
        dirty: false,
      };
    case 'add-node': {
      const nextNode = action.node;
      if (!nextNode) {
        return state;
      }
      return {
        ...state,
        draftDag: {
          ...state.draftDag,
          nodes: [...state.draftDag.nodes, normalizeDraftNode(nextNode, state.draftDag.nodes.length)],
        },
        dirty: true,
        selectedEdgeId: '',
      };
    }
    case 'update-node': {
      const nextNodes = state.draftDag.nodes.map((node) => {
        if (node.id !== action.nodeId) {
          return node;
        }
        return {
          ...node,
          ...action.updates,
          config: action.updates?.config ? { ...node.config, ...action.updates.config } : node.config,
        };
      });
      return {
        ...state,
        draftDag: { ...state.draftDag, nodes: nextNodes },
        dirty: true,
      };
    }
    case 'move-node': {
      const nextNodes = state.draftDag.nodes.map((node) => (node.id === action.nodeId ? { ...node, position: action.position } : node));
      return {
        ...state,
        draftDag: { ...state.draftDag, nodes: nextNodes },
        dirty: true,
      };
    }
    case 'delete-node': {
      const nextNodes = state.draftDag.nodes.filter((node) => node.id !== action.nodeId);
      const nextEdges = state.draftDag.edges.filter((edge) => edge.source !== action.nodeId && edge.target !== action.nodeId);
      return {
        ...state,
        draftDag: { ...state.draftDag, nodes: nextNodes, edges: nextEdges },
        dirty: true,
        selectedEdgeId: state.selectedEdgeId,
      };
    }
    case 'add-edge': {
      if (!action.edge?.source || !action.edge?.target || action.edge.source === action.edge.target) {
        return state;
      }
      const duplicate = state.draftDag.edges.some((edge) => edge.source === action.edge.source && edge.target === action.edge.target);
      if (duplicate) {
        return state;
      }
      const nextEdge = normalizeDraftEdge(
        {
          id: action.edge.id || makeEdgeId(action.edge.source, action.edge.target),
          source: action.edge.source,
          target: action.edge.target,
          flowKind: action.edge.flowKind || 'data',
          label: action.edge.label || '',
        },
        state.draftDag.edges.length,
      );
      return {
        ...state,
        draftDag: { ...state.draftDag, edges: [...state.draftDag.edges, nextEdge] },
        dirty: true,
      };
    }
    case 'delete-edge': {
      const nextEdges = state.draftDag.edges.filter((edge) => edge.id !== action.edgeId);
      return {
        ...state,
        draftDag: { ...state.draftDag, edges: nextEdges },
        dirty: true,
        selectedEdgeId: state.selectedEdgeId === action.edgeId ? '' : state.selectedEdgeId,
      };
    }
    case 'update-edge': {
      const nextEdges = state.draftDag.edges.map((edge) => (edge.id === action.edgeId ? { ...edge, ...action.updates } : edge));
      return {
        ...state,
        draftDag: { ...state.draftDag, edges: nextEdges },
        dirty: true,
      };
    }
    case 'replace-dag':
      return {
        ...state,
        draftDag: hydrateAuthoringDag(action.dag),
        dirty: false,
        selectedEdgeId: '',
        validation: action.validation || state.validation,
      };
    default:
      return state;
  }
}