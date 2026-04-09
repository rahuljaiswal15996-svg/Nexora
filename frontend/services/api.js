import { resolveInternalApiBaseUrl, resolvePublicApiBaseUrl } from "../lib/runtime-config";

const SESSION_STORAGE_KEY = "nexora.workspace.session";

const DEFAULT_SESSION = {
  tenant_id: "default",
  user: "admin@nexora.local",
  role: "admin",
  access_token: null,
};

function isBrowser() {
  return typeof window !== "undefined";
}

function resolveApiBasePath() {
  if (!isBrowser()) {
    return resolveInternalApiBaseUrl();
  }
  return resolvePublicApiBaseUrl();
}

export function getWorkspaceSession() {
  if (!isBrowser()) {
    return { ...DEFAULT_SESSION };
  }

  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_SESSION };
    }
    return { ...DEFAULT_SESSION, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SESSION };
  }
}

function persistWorkspaceSession(session) {
  if (!isBrowser()) {
    return session;
  }
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  return session;
}

async function requestDevToken(session) {
  const response = await fetch(`${resolveApiBasePath()}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tenant_id: session.tenant_id,
      user: session.user,
      role: session.role,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Failed to issue dev token");
  }

  return response.json();
}

export async function ensureDevSession(options = {}) {
  const current = getWorkspaceSession();
  const nextSession = {
    ...current,
    tenant_id: options.tenantId || current.tenant_id || DEFAULT_SESSION.tenant_id,
    user: options.user || current.user || DEFAULT_SESSION.user,
    role: options.role || current.role || DEFAULT_SESSION.role,
  };

  if (nextSession.access_token && !options.forceRefresh) {
    return nextSession;
  }

  try {
    const tokenPayload = await requestDevToken(nextSession);
    return persistWorkspaceSession({
      ...nextSession,
      access_token: tokenPayload.access_token,
    });
  } catch (error) {
    console.error("Falling back to header-only session", error);
    return persistWorkspaceSession(nextSession);
  }
}

export async function updateWorkspaceRole(role) {
  return ensureDevSession({ role, forceRefresh: true });
}

async function buildHeaders(extraHeaders = {}, body) {
  const session = await ensureDevSession();
  const headers = {
    ...extraHeaders,
    "X-Tenant-ID": session.tenant_id,
    "X-User-ID": session.user,
    "X-User-Role": session.role,
  };

  if (session.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  if (body && !(body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  return headers;
}

async function apiFetch(path, options = {}) {
  const { method = "GET", headers = {}, body } = options;
  const response = await fetch(`${resolveApiBasePath()}${path}`, {
    method,
    headers: await buildHeaders(headers, body),
    body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Request failed");
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
}

function withQuery(path, query = {}) {
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, value);
    }
  });

  const queryString = params.toString();
  return queryString ? `${path}?${queryString}` : path;
}

function appendConversionOptions(formData, options = {}) {
  if (options.sourceLanguage) {
    formData.append("source_language", options.sourceLanguage);
  }
  if (options.targetLanguage) {
    formData.append("target_language", options.targetLanguage);
  }
  if (options.projectId) {
    formData.append("project_id", options.projectId);
  }
  if (options.workspaceId) {
    formData.append("workspace_id", options.workspaceId);
  }
}

async function postFormData(path, formData) {
  return apiFetch(path, { method: "POST", body: formData });
}

export async function convertFile(file, options = {}) {
  const formData = new FormData();
  formData.append("file", file);
  appendConversionOptions(formData, options);
  return postFormData("/convert", formData);
}

export async function convertText(code, options = {}) {
  const formData = new FormData();
  const blob = new Blob([code], { type: "text/plain" });
  formData.append("file", blob, "code.txt");
  appendConversionOptions(formData, options);
  return postFormData("/convert", formData);
}

export async function parseFile(file, options = {}) {
  const formData = new FormData();
  formData.append("file", file);
  appendConversionOptions(formData, options);
  return postFormData("/parse", formData);
}

export async function parseText(code, options = {}) {
  const formData = new FormData();
  const blob = new Blob([code], { type: "text/plain" });
  formData.append("file", blob, "code.txt");
  appendConversionOptions(formData, options);
  return postFormData("/parse", formData);
}

function applyPipelineContext(dag, options = {}) {
  const pipelineDag = dag && typeof dag === "object" ? dag : {};
  const metadata = pipelineDag.metadata && typeof pipelineDag.metadata === "object" ? pipelineDag.metadata : {};
  const nextMetadata = {
    ...metadata,
    ...(options.projectId ? { project_id: options.projectId } : {}),
    ...((options.projectId || options.projectName || metadata.project)
      ? {
          project: {
            ...(metadata.project && typeof metadata.project === "object" ? metadata.project : {}),
            ...(options.projectId ? { id: options.projectId } : {}),
            ...(options.projectName ? { name: options.projectName } : {}),
          },
        }
      : {}),
    ...(options.workspaceId ? { workspace_id: options.workspaceId } : {}),
    ...((options.workspaceId || metadata.workspace)
      ? {
          workspace: {
            ...(metadata.workspace && typeof metadata.workspace === "object" ? metadata.workspace : {}),
            ...(options.workspaceId ? { id: options.workspaceId } : {}),
          },
        }
      : {}),
  };
  return {
    ...pipelineDag,
    metadata: nextMetadata,
  };
}

export async function createPipeline(dag, name = "unnamed", options = {}) {
  return apiFetch("/pipelines", {
    method: "POST",
    body: { name, dag: applyPipelineContext(dag, options) },
  });
}

export async function updatePipeline(pipelineId, dag, name = "unnamed", options = {}) {
  return apiFetch(`/pipelines/${pipelineId}`, {
    method: "PUT",
    body: { name, dag: applyPipelineContext(dag, options) },
  });
}

export async function listPipelines(projectId, workspaceId) {
  return apiFetch(withQuery("/pipelines", { project_id: projectId, workspace_id: workspaceId }));
}

export async function backfillPipelineScope(includeExisting = false) {
  return apiFetch(withQuery("/pipelines/backfill-scope", { include_existing: includeExisting }), {
    method: "POST",
  });
}

export async function getPipelineScopeGapReport(limit = 100) {
  return apiFetch(withQuery("/pipelines/scope-gaps", { limit }));
}

export async function listPipelineNodeCatalog() {
  return apiFetch("/pipelines/node-catalog");
}

export async function validatePipelineGraph(dag) {
  return apiFetch("/pipelines/validate", {
    method: "POST",
    body: { dag },
  });
}

export async function createNotebook(title, options = {}) {
  const metadata = {
    ...(options.metadata || {}),
  };
  if (options.projectId) {
    metadata.project_id = options.projectId;
  }
  if (options.workspaceId) {
    metadata.workspace_id = options.workspaceId;
  }
  return apiFetch("/notebooks", {
    method: "POST",
    body: {
      title,
      project_id: options.projectId,
      workspace_id: options.workspaceId,
      metadata,
    },
  });
}

export async function openNotebookWorkspace(source) {
  return apiFetch("/notebooks/open", {
    method: "POST",
    body: { source },
  });
}

export async function listNotebooks(projectId, workspaceId) {
  return apiFetch(withQuery("/notebooks", { project_id: projectId, workspace_id: workspaceId }));
}

export async function backfillNotebookScope(includeExisting = false) {
  return apiFetch(withQuery("/notebooks/backfill-scope", { include_existing: includeExisting }), {
    method: "POST",
  });
}

export async function getNotebookScopeGapReport(limit = 100) {
  return apiFetch(withQuery("/notebooks/scope-gaps", { limit }));
}

export async function getNotebook(notebookId) {
  return apiFetch(`/notebooks/${notebookId}`);
}

export async function updateNotebook(notebookId, updates) {
  return apiFetch(`/notebooks/${notebookId}`, {
    method: "PUT",
    body: updates,
  });
}

export async function deleteNotebook(notebookId) {
  return apiFetch(`/notebooks/${notebookId}`, {
    method: "DELETE",
  });
}

export async function attachNotebookToFlow(notebookId, payload) {
  return apiFetch(`/notebooks/${notebookId}/flow-binding`, {
    method: "POST",
    body: payload,
  });
}

export async function executeNotebook(notebookId, payload) {
  return apiFetch(`/notebooks/${notebookId}/executions`, {
    method: "POST",
    body: payload,
  });
}

export async function getPipelineMetrics(pipelineId) {
  return apiFetch(`/pipelines/${pipelineId}/metrics`);
}

export async function optimizePipeline(pipelineId) {
  return apiFetch(`/pipelines/${pipelineId}/optimize`, {
    method: "POST",
  });
}

export async function getCostAnalysis() {
  return apiFetch("/optimization/cost-analysis");
}

export async function listConnections() {
  return apiFetch("/connections");
}

export async function getConnectionStats() {
  return apiFetch("/connections/stats");
}

export async function createConnection(connection) {
  return apiFetch("/connections", {
    method: "POST",
    body: connection,
  });
}

export async function listConnectionDatasets(connectionId) {
  return apiFetch(`/connections/${connectionId}/datasets`);
}

export async function previewConnectionDataset(connectionId, datasetName, limit = 20) {
  return apiFetch(
    `/connections/${connectionId}/datasets/preview?dataset_name=${encodeURIComponent(datasetName)}&limit=${limit}`
  );
}

export async function getConnectionDatasetSchema(connectionId, datasetName) {
  return apiFetch(`/connections/${connectionId}/datasets/schema?dataset_name=${encodeURIComponent(datasetName)}`);
}

export async function testConnection(connectionId) {
  const payload = await apiFetch(`/connections/${connectionId}/test`, {
    method: "POST",
  });
  return payload.result || payload;
}

export async function deleteConnection(connectionId) {
  return apiFetch(`/connections/${connectionId}`, {
    method: "DELETE",
  });
}

export async function runPipeline(pipelineId, runConfig = {}) {
  return apiFetch(`/pipelines/${pipelineId}/runs`, {
    method: "POST",
    body: { run_config: runConfig },
  });
}

export async function getRunStatus(runId) {
  return apiFetch(`/pipelines/runs/${runId}`);
}

export async function listRunNodes(runId) {
  return apiFetch(`/pipelines/runs/${runId}/nodes`);
}

export async function listRunLogs(runId, options = {}) {
  return apiFetch(
    withQuery(`/pipelines/runs/${runId}/logs`, {
      node_id: options.nodeId,
      after_id: options.afterId,
      limit: options.limit,
    })
  );
}

export async function getPipeline(pipelineId) {
  return apiFetch(`/pipelines/${pipelineId}`);
}

export async function updatePipelineScope(pipelineId, projectId, workspaceId) {
  return apiFetch(`/pipelines/${pipelineId}/scope`, {
    method: "PUT",
    body: { project_id: projectId, workspace_id: workspaceId },
  });
}

export async function listPipelineRuns(status, pipelineId) {
  return apiFetch(withQuery("/pipelines/runs", { status, pipeline_id: pipelineId }));
}

export async function listShadowRuns(status) {
  const url = status ? `/shadow?status=${encodeURIComponent(status)}` : "/shadow";
  return apiFetch(url);
}

export async function getShadowRun(shadowId) {
  return apiFetch(`/shadow/${shadowId}`);
}

export async function createShadowRun(input, inputType = "code", threshold) {
  const body = { input_type: inputType, input };
  if (threshold !== undefined) {
    body.threshold = threshold;
  }
  return apiFetch("/shadow", {
    method: "POST",
    body,
  });
}

export async function reviewShadow(shadowId, reviewer = "web-ui", action, comment = "") {
  return apiFetch(`/shadow/${shadowId}/review`, {
    method: "POST",
    body: { reviewer, action, comment },
  });
}

export async function listProjects() {
  return apiFetch("/projects");
}

export async function getProject(projectId) {
  return apiFetch(`/projects/${projectId}`);
}

export async function listProjectWorkspaces(projectId) {
  return apiFetch(`/projects/${projectId}/workspaces`);
}

export async function createProject(project) {
  return apiFetch("/projects", {
    method: "POST",
    body: project,
  });
}

export async function createWorkspace(projectId, workspace) {
  return apiFetch(`/projects/${projectId}/workspaces`, {
    method: "POST",
    body: workspace,
  });
}

export async function listCatalogDatasets(query, projectId) {
  return apiFetch(withQuery("/catalog/datasets", { q: query, project_id: projectId }));
}

export async function registerDataset(dataset) {
  return apiFetch("/catalog/datasets", {
    method: "POST",
    body: dataset,
  });
}

export async function getDataset(datasetId) {
  return apiFetch(`/catalog/datasets/${datasetId}`);
}

export async function getDatasetLineage(datasetId) {
  return apiFetch(`/catalog/datasets/${datasetId}/lineage`);
}

export async function getDatasetQuality(datasetId) {
  return apiFetch(`/catalog/datasets/${datasetId}/quality`);
}

export async function addDatasetQualityCheck(datasetId, payload) {
  return apiFetch(`/catalog/datasets/${datasetId}/quality-checks`, {
    method: "POST",
    body: payload,
  });
}

export async function listScenarios(projectId) {
  return apiFetch(withQuery("/scenarios", { project_id: projectId }));
}

export async function getScenario(scenarioId) {
  return apiFetch(`/scenarios/${scenarioId}`);
}

export async function createScenario(payload) {
  return apiFetch("/scenarios", {
    method: "POST",
    body: payload,
  });
}

export async function createScenarioVersion(scenarioId, payload) {
  return apiFetch(`/scenarios/${scenarioId}/versions`, {
    method: "POST",
    body: payload,
  });
}

export async function compareScenarioVersions(versionA, versionB) {
  return apiFetch("/scenarios/compare", {
    method: "POST",
    body: { version_a: versionA, version_b: versionB },
  });
}

export async function listDeployTargets() {
  return apiFetch("/deploy/targets");
}

export async function createDeployTarget(payload) {
  return apiFetch("/deploy/targets", {
    method: "POST",
    body: payload,
  });
}

export async function listDeployments() {
  return apiFetch("/deployments");
}

export async function getDeployment(deploymentId) {
  return apiFetch(`/deployments/${deploymentId}`);
}

export async function rollbackDeployment(deploymentId, payload = {}) {
  return apiFetch(`/deployments/${deploymentId}/rollback`, {
    method: "POST",
    body: payload,
  });
}

export async function deployPipelineAsset(payload) {
  return apiFetch("/deploy", {
    method: "POST",
    body: payload,
  });
}

export async function listGovernancePolicies() {
  return apiFetch("/governance/policies");
}

export async function createGovernancePolicy(payload) {
  return apiFetch("/governance/policies", {
    method: "POST",
    body: payload,
  });
}

export async function listAuditLog(resourceType) {
  return apiFetch(withQuery("/governance/audit-log", { resource_type: resourceType }));
}

export async function listQuotas() {
  return apiFetch("/finops/quotas");
}

export async function upsertQuota(payload) {
  return apiFetch("/finops/quotas", {
    method: "POST",
    body: payload,
  });
}

export async function getTenantCosts(period) {
  return apiFetch(withQuery("/finops/costs", { period }));
}

export async function recordTenantCost(payload) {
  return apiFetch("/finops/costs", {
    method: "POST",
    body: payload,
  });
}

export async function listComments(resourceType, resourceId) {
  return apiFetch(withQuery("/collaboration/comments", { resource_type: resourceType, resource_id: resourceId }));
}

export async function createComment(payload) {
  return apiFetch("/collaboration/comments", {
    method: "POST",
    body: payload,
  });
}

export async function listReviews(resourceType, resourceId) {
  return apiFetch(withQuery("/collaboration/reviews", { resource_type: resourceType, resource_id: resourceId }));
}

export async function createReview(payload) {
  return apiFetch("/collaboration/reviews", {
    method: "POST",
    body: payload,
  });
}

export async function resolveReview(reviewId, payload) {
  return apiFetch(`/collaboration/reviews/${reviewId}/resolve`, {
    method: "POST",
    body: payload,
  });
}

export async function listExperiments(projectId) {
  return apiFetch(withQuery("/ml/experiments", { project_id: projectId }));
}

export async function createExperiment(payload) {
  return apiFetch("/ml/experiments", {
    method: "POST",
    body: payload,
  });
}

export async function listExperimentRuns(experimentId) {
  return apiFetch(`/ml/experiments/${experimentId}/runs`);
}

export async function createExperimentRun(experimentId, payload) {
  return apiFetch(`/ml/experiments/${experimentId}/runs`, {
    method: "POST",
    body: payload,
  });
}

export async function listModelServing() {
  return apiFetch("/ml/model-serving");
}

export async function registerModelServing(payload) {
  return apiFetch("/ml/model-serving", {
    method: "POST",
    body: payload,
  });
}

export async function listJobs(status, jobType) {
  return apiFetch(withQuery("/jobs", { status, job_type: jobType }));
}

export async function getJob(jobId) {
  return apiFetch(`/jobs/${jobId}`);
}

export async function cancelJob(jobId) {
  return apiFetch(`/jobs/${jobId}/cancel`, {
    method: "POST",
  });
}

export async function retryJob(jobId) {
  return apiFetch(`/jobs/${jobId}/retry`, {
    method: "POST",
  });
}

export async function getSystemStatus() {
  return apiFetch('/status');
}

export async function getAgentFleet() {
  return apiFetch('/agent/fleet');
}
