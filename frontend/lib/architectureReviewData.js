export const architectureReview = {
  title: 'Nexora Architecture Review',
  generatedAt: '2026-04-06',
  summary: [
    { label: 'Application pages', value: 14, detail: 'Core product routes excluding marketing pages.' },
    { label: 'Backend route modules', value: 18, detail: 'FastAPI route files under backend/app/routes.' },
    { label: 'Aligned capabilities', value: 11, detail: 'Strong page-to-route-to-service mapping.' },
    { label: 'Needs review', value: 5, detail: 'Thin UI, orphaned backend modules, or remaining product-depth gaps.' },
  ],
  capabilityMatrix: [
    {
      id: 'MIG-001',
      capability: 'Migration intake and conversion',
      category: 'Core Migration',
      frontend: ['/upload', '/compare'],
      backendRoutes: ['/parse', '/convert', '/history'],
      services: ['parser', 'conversion_engine', 'pipeline_blueprint', 'migration_program'],
      apiCalls: ['parseFile', 'parseText', 'convertFile', 'convertText'],
      status: 'aligned',
      health: 92,
      notes: 'Now creates source flow, converted flow, project, catalog assets, notebook, and runtime handoff from one conversion path.',
    },
    {
      id: 'PIPE-001',
      capability: 'Pipeline design and runtime execution',
      category: 'Pipeline Runtime',
      frontend: ['/flow', '/upload'],
      backendRoutes: ['/pipelines', '/pipelines/{id}', '/pipelines/{id}/runs'],
      services: ['pipeline_runner', 'pipeline_blueprint'],
      apiCalls: ['createPipeline', 'getPipeline', 'runPipeline', 'getRunStatus'],
      status: 'aligned',
      health: 93,
      notes: 'Flow Builder is now the system of record and shares the same runtime model as migration-generated assets.',
    },
    {
      id: 'NOTE-001',
      capability: 'Notebook workspace',
      category: 'Notebook Runtime',
      frontend: ['/notebooks', '/notebooks/[id]'],
      backendRoutes: ['/notebooks', '/notebooks/{id}', '/notebooks/{id}/cells/*'],
      services: ['notebook'],
      apiCalls: ['listNotebooks', 'createNotebook', 'getNotebook', 'updateNotebook', 'executeCell'],
      status: 'partial',
      health: 58,
      notes: 'Backend supports cells and execution, but the top-level notebooks surface still feels thinner than the service model behind it.',
    },
    {
      id: 'PROJ-001',
      capability: 'Project portfolio and workspaces',
      category: 'Control Plane',
      frontend: ['/projects', '/home'],
      backendRoutes: ['/projects', '/projects/{id}', '/projects/{id}/workspaces'],
      services: ['project_service'],
      apiCalls: ['listProjects', 'createProject', 'createWorkspace', 'getProject'],
      status: 'aligned',
      health: 86,
      notes: 'Home is now summary-only while project work continues in dedicated workspaces. Project membership management remains API-first.',
    },
    {
      id: 'CAT-001',
      capability: 'Catalog, quality, and lineage',
      category: 'Data Catalog',
      frontend: ['/catalog', '/home', '/upload'],
      backendRoutes: ['/catalog/datasets', '/catalog/datasets/{id}', '/catalog/datasets/{id}/lineage', '/catalog/datasets/{id}/quality'],
      services: ['catalog', 'platform_jobs'],
      apiCalls: ['listCatalogDatasets', 'registerDataset', 'getDatasetLineage', 'getDatasetQuality', 'addDatasetQualityCheck'],
      status: 'aligned',
      health: 84,
      notes: 'Catalog is now lineage-first and Home only summarizes cross-workspace health instead of absorbing catalog responsibilities.',
    },
    {
      id: 'OPS-001',
      capability: 'Runtime operations and promotion',
      category: 'Operations',
      frontend: ['/runtime'],
      backendRoutes: ['/scenarios', '/deploy/targets', '/deployments', '/deploy'],
      services: ['scenario_service', 'deployer', 'platform_jobs'],
      apiCalls: ['listScenarios', 'createScenario', 'compareScenarioVersions', 'createDeployTarget', 'deployPipelineAsset'],
      status: 'aligned',
      health: 88,
      notes: 'Runtime Ops now owns jobs, runs, deployments, and agent visibility as the canonical operator console.',
    },
    {
      id: 'GOV-001',
      capability: 'Governance, FinOps, audit, and collaboration',
      category: 'Governance',
      frontend: ['/governance/policies', '/governance/finops', '/governance/reviews'],
      backendRoutes: ['/governance/*', '/finops/*', '/collaboration/*'],
      services: ['governance', 'finops', 'collaboration'],
      apiCalls: ['listGovernancePolicies', 'listQuotas', 'getTenantCosts', 'listAuditLog', 'listComments', 'listReviews'],
      status: 'aligned',
      health: 87,
      notes: 'Governance Desk is now split into focused policies, FinOps, and reviews workspaces rather than one overloaded screen.',
    },
    {
      id: 'ML-001',
      capability: 'ML experiments and serving',
      category: 'ML Platform',
      frontend: ['/ml', '/home'],
      backendRoutes: ['/ml/experiments', '/ml/experiments/{id}/runs', '/ml/model-serving'],
      services: ['ml_lifecycle', 'platform_jobs'],
      apiCalls: ['listExperiments', 'createExperiment', 'listExperimentRuns', 'registerModelServing'],
      status: 'aligned',
      health: 81,
      notes: 'The page exists and maps well. Home now acts as a summary surface instead of competing with ML controls.',
    },
    {
      id: 'CONN-001',
      capability: 'Connection management',
      category: 'Integration',
      frontend: ['/connections'],
      backendRoutes: ['/connections', '/connections/{id}/datasets'],
      services: ['cloud_connections'],
      apiCalls: ['listConnections', 'createConnection', 'listConnectionDatasets', 'previewConnectionDataset', 'testConnection'],
      status: 'aligned',
      health: 78,
      notes: 'The page now frames testing, discovery, dataset browsing, and credential posture as first-class connection workflows.',
    },
    {
      id: 'REV-001',
      capability: 'Human review and shadow approvals',
      category: 'Review Flow',
      frontend: ['/review'],
      backendRoutes: ['/shadow', '/shadow/{id}', '/shadow/{id}/review'],
      services: ['shadow'],
      apiCalls: ['listShadowRuns', 'getShadowRun', 'createShadowRun', 'reviewShadow'],
      status: 'partial',
      health: 60,
      notes: 'The workflow is component-driven and functional, but it is not yet expressed as a broader review operating surface.',
    },
    {
      id: 'OBS-001',
      capability: 'Observability and system metrics',
      category: 'Observability',
      frontend: ['/home', '/runtime'],
      backendRoutes: ['/status', '/jobs', '/metrics'],
      services: ['status', 'metrics', 'platform_jobs'],
      apiCalls: ['listJobs'],
      status: 'partial',
      health: 62,
      notes: 'Home and Runtime expose system state more clearly, though metrics still need a deeper dedicated observability experience.',
    },
    {
      id: 'AGT-001',
      capability: 'Remote agent control plane',
      category: 'Runtime Agents',
      frontend: ['/runtime'],
      backendRoutes: ['/agent/poll', '/agent/report', '/agent/platform-jobs/*'],
      services: ['agent', 'pipeline_runner', 'platform_jobs'],
      apiCalls: [],
      status: 'aligned',
      health: 76,
      notes: 'Runtime Ops now exposes agent fleet state, though lease-state depth can still improve over time.',
    },
  ],
  pageCoverage: [
    {
      page: '/upload',
      type: 'Migration Studio',
      routes: ['/parse', '/convert'],
      services: ['parser', 'conversion_engine', 'pipeline_blueprint', 'migration_program'],
      health: 92,
      status: 'strong',
      gaps: ['Inline editing of runtime schedule and deployment target is still missing.'],
    },
    {
      page: '/home',
      type: 'Home Summary',
      routes: ['/projects', '/catalog/datasets', '/deployments', '/ml/experiments', '/jobs'],
      services: ['project_service', 'catalog', 'deployer', 'ml_lifecycle', 'platform_jobs'],
      health: 86,
      status: 'strong',
      gaps: ['Must remain summary-only so it does not become the old mixed control-plane hub again.'],
    },
    {
      page: '/runtime',
      type: 'Runtime Ops',
      routes: ['/scenarios', '/deploy/targets', '/deployments', '/jobs'],
      services: ['scenario_service', 'deployer', 'platform_jobs'],
      health: 88,
      status: 'strong',
      gaps: ['Metrics and deeper observability can still expand beyond the current operator console.'],
    },
    {
      page: '/governance/policies',
      type: 'Governance Policies',
      routes: ['/governance/*'],
      services: ['governance'],
      health: 84,
      status: 'strong',
      gaps: ['Cross-policy simulation and impact analysis would further deepen this workspace.'],
    },
    {
      page: '/governance/finops',
      type: 'Governance FinOps',
      routes: ['/finops/*'],
      services: ['finops'],
      health: 83,
      status: 'strong',
      gaps: ['Budget forecasting and anomaly alerting are the next depth step.'],
    },
    {
      page: '/governance/reviews',
      type: 'Governance Reviews',
      routes: ['/collaboration/*'],
      services: ['collaboration'],
      health: 82,
      status: 'strong',
      gaps: ['Broader review templates and approval automation would round out the operator flow.'],
    },
    {
      page: '/catalog',
      type: 'Catalog Workspace',
      routes: ['/catalog/datasets', '/catalog/datasets/{id}/quality', '/catalog/datasets/{id}/lineage'],
      services: ['catalog', 'platform_jobs'],
      health: 84,
      status: 'strong',
      gaps: ['Multi-hop lineage compare and policy overlays would add more enterprise depth.'],
    },
    {
      page: '/notebooks',
      type: 'Notebook Workspace',
      routes: ['/notebooks', '/notebooks/{id}'],
      services: ['notebook'],
      health: 82,
      status: 'strong',
      gaps: ['Notebook scheduling and API packaging can still become more explicit in the landing workspace.'],
    },
    {
      page: '/connections',
      type: 'Integration Workspace',
      routes: ['/connections', '/connections/{id}/datasets'],
      services: ['cloud_connections'],
      health: 78,
      status: 'strong',
      gaps: ['Connection templates and environment promotion would deepen enterprise readiness further.'],
    },
    {
      page: '/review',
      type: 'HITL Workspace',
      routes: ['/shadow', '/shadow/{id}/review'],
      services: ['shadow'],
      health: 60,
      status: 'thin',
      gaps: ['Page functions, but broader approval/audit lineage around the review loop is not surfaced.'],
    },
  ],
  backendModules: [
    {
      module: 'upload.py + parse.py',
      pages: ['/upload', '/compare'],
      status: 'strong',
      note: 'Best end-to-end alignment in the product after the migration bootstrap additions.',
    },
    {
      module: 'pipelines.py + pipeline_runner.py',
      pages: ['/pipelines', '/upload'],
      status: 'strong',
      note: 'Runtime backend is stronger than the standalone UI currently suggests.',
    },
    {
      module: 'catalog.py + catalog service',
      pages: ['/catalog', '/home', '/upload'],
      status: 'strong',
      note: 'Backend lineage and quality model now map cleanly into a lineage-first catalog surface.',
    },
    {
      module: 'projects.py + project_service.py',
      pages: ['/projects', '/home', '/upload'],
      status: 'strong',
      note: 'Project bootstrap is solid, but project member management remains API-only.',
    },
    {
      module: 'notebook.py + notebook service',
      pages: ['/notebooks', '/upload'],
      status: 'partial',
      note: 'Service model is mature enough for richer notebook-first workflows than the list page exposes.',
    },
    {
      module: 'deploy.py + deployer.py + platform_jobs.py',
      pages: ['/runtime', '/home', '/upload'],
      status: 'strong',
      note: 'Async deployment model now lands in a coherent Runtime Ops surface with a separate summary on Home.',
    },
    {
      module: 'agent.py + metrics.py + status.py',
      pages: ['/runtime', '/home'],
      status: 'partial',
      note: 'Runtime agent health is now visible, though metrics depth still trails the backend capabilities.',
    },
  ],
  disconnects: {
    orphanedBackend: [
      {
        concept: 'Optimization API',
        detail: 'Optimization endpoints and API helpers exist, but there is no dedicated optimization workflow in the UI.',
        priority: 'high',
      },
      {
        concept: 'Remote agent operations',
        detail: 'Runtime exposes fleet state now, but claim detail, lease forensics, and replay tools are still backend-leaning.',
        priority: 'medium',
      },
      {
        concept: 'Metrics and observability',
        detail: 'Metrics endpoint exists, but observability is still summarized rather than modeled as a deep first-class product surface.',
        priority: 'medium',
      },
    ],
    overloadedPages: [
      {
        page: '/home',
        issue: 'The summary page now touches many domains and must stay strictly summary-only.',
        recommendation: 'Keep execution, governance, and project actions in their dedicated workspaces so Home does not regress into the old mixed hub.',
      },
    ],
    thinPages: [
      {
        page: '/review',
        issue: 'Approval loop exists but does not expose the broader lifecycle around it.',
      },
    ],
    mentalModelGaps: [
      {
        concept: 'History',
        issue: 'Conversion history, audit history, and review history are separate concepts but feel similarly named in the UX.',
      },
    ],
  },
  recommendedInformationArchitecture: [
    {
      workspace: 'Migration Studio',
      scope: 'Upload, parse, convert, compare, and migration bootstrap assets.',
    },
    {
      workspace: 'Catalog and Lineage',
      scope: 'Datasets, lineage graph, quality gates, and source/target asset traceability.',
    },
    {
      workspace: 'Runtime Ops',
      scope: 'Pipeline runs, jobs queue, deploy targets, promotions, and agent health.',
    },
    {
      workspace: 'Governance Desk',
      scope: 'Policies, quotas, cost, comments, reviews, and audit trails.',
    },
    {
      workspace: 'ML Studio',
      scope: 'Experiments, experiment jobs, serving registrations, and evaluations.',
    },
    {
      workspace: 'Architecture Review',
      scope: 'Frontend-backend alignment matrix, disconnects, overload report, and exportable review pack.',
    },
  ],
};

export function buildCapabilityCsv() {
  const header = ['ID', 'Capability', 'Category', 'Frontend Pages', 'Backend Routes', 'Services', 'API Calls', 'Status', 'Health', 'Notes'];
  const rows = architectureReview.capabilityMatrix.map((item) => [
    item.id,
    item.capability,
    item.category,
    item.frontend.join(' | '),
    item.backendRoutes.join(' | '),
    item.services.join(' | '),
    item.apiCalls.join(' | '),
    item.status,
    String(item.health),
    item.notes,
  ]);
  return [header, ...rows]
    .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

export function buildArchitectureMarkdown() {
  const lines = [];
  lines.push(`# ${architectureReview.title}`);
  lines.push('');
  lines.push(`Generated: ${architectureReview.generatedAt}`);
  lines.push('');
  lines.push('## Summary');
  architectureReview.summary.forEach((item) => {
    lines.push(`- ${item.label}: ${item.value} (${item.detail})`);
  });
  lines.push('');
  lines.push('## Capability Matrix');
  lines.push('| ID | Capability | Category | Frontend | Backend Routes | Services | Status | Health |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |');
  architectureReview.capabilityMatrix.forEach((item) => {
    lines.push(`| ${item.id} | ${item.capability} | ${item.category} | ${item.frontend.join('<br>') || '-'} | ${item.backendRoutes.join('<br>')} | ${item.services.join('<br>')} | ${item.status} | ${item.health}% |`);
  });
  lines.push('');
  lines.push('## Overloaded Pages');
  architectureReview.disconnects.overloadedPages.forEach((item) => {
    lines.push(`- ${item.page}: ${item.issue} Recommendation: ${item.recommendation}`);
  });
  lines.push('');
  lines.push('## Thin Pages');
  architectureReview.disconnects.thinPages.forEach((item) => {
    lines.push(`- ${item.page}: ${item.issue}`);
  });
  lines.push('');
  lines.push('## Orphaned or Underexposed Backend Capabilities');
  architectureReview.disconnects.orphanedBackend.forEach((item) => {
    lines.push(`- ${item.concept} (${item.priority}): ${item.detail}`);
  });
  lines.push('');
  lines.push('## Recommended Information Architecture');
  architectureReview.recommendedInformationArchitecture.forEach((item) => {
    lines.push(`- ${item.workspace}: ${item.scope}`);
  });
  return lines.join('\n');
}

export function buildArchitectureJson() {
  return JSON.stringify(architectureReview, null, 2);
}