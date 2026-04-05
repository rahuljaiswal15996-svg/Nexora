const BASE_PATH = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
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
  const response = await fetch(`${BASE_PATH}/auth/token`, {
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
  const response = await fetch(`${BASE_PATH}${path}`, {
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

function appendConversionOptions(formData, options = {}) {
  if (options.sourceLanguage) {
    formData.append("source_language", options.sourceLanguage);
  }
  if (options.targetLanguage) {
    formData.append("target_language", options.targetLanguage);
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

export async function createPipeline(dag, name = "unnamed") {
  return apiFetch("/pipelines", {
    method: "POST",
    body: { name, dag },
  });
}

export async function createNotebook(title) {
  return apiFetch("/notebooks", {
    method: "POST",
    body: { title },
  });
}

export async function listNotebooks() {
  return apiFetch("/notebooks");
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

export async function executeCell(notebookId, cellId) {
  return apiFetch(`/notebooks/${notebookId}/cells/${cellId}/execute`, {
    method: "POST",
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

export async function getPipeline(pipelineId) {
  return apiFetch(`/pipelines/${pipelineId}`);
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
