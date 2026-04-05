const BASE_PATH = "http://127.0.0.1:8000";

async function postFormData(path, formData) {
  const response = await fetch(`${BASE_PATH}${path}`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Request failed");
  }

  return response.json();
}

export async function convertFile(file) {
  const formData = new FormData();
  formData.append("file", file);
  return postFormData("/convert", formData);
}

export async function convertText(code) {
  const formData = new FormData();
  const blob = new Blob([code], { type: "text/plain" });
  formData.append("file", blob, "code.txt");
  return postFormData("/convert", formData);
}

export async function parseFile(file) {
  const formData = new FormData();
  formData.append("file", file);
  return postFormData("/parse", formData);
}

export async function parseText(code) {
  const formData = new FormData();
  const blob = new Blob([code], { type: "text/plain" });
  formData.append("file", blob, "code.txt");
  return postFormData("/parse", formData);
}

export async function createPipeline(dag, name = "unnamed") {
  const res = await fetch(`${BASE_PATH}/pipelines`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, dag }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Create pipeline failed");
  }
  return res.json();
}
// Notebook API functions
export async function createNotebook(title) {
  const res = await fetch(`${BASE_PATH}/notebooks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to create notebook");
  }
  return res.json();
}

export async function listNotebooks() {
  console.log('API: Fetching notebooks from:', `${BASE_PATH}/notebooks`);
  const res = await fetch(`${BASE_PATH}/notebooks`);
  console.log('API: Response status:', res.status);
  if (!res.ok) {
    const text = await res.text();
    console.error('API: Error response:', text);
    throw new Error(text || "Failed to list notebooks");
  }
  const data = await res.json();
  console.log('API: Response data:', data);
  return data;
}

export async function getNotebook(notebookId) {
  const res = await fetch(`${BASE_PATH}/notebooks/${notebookId}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to get notebook");
  }
  return res.json();
}

export async function updateNotebook(notebookId, updates) {
  const res = await fetch(`${BASE_PATH}/notebooks/${notebookId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to update notebook");
  }
  return res.json();
}

export async function deleteNotebook(notebookId) {
  const res = await fetch(`${BASE_PATH}/notebooks/${notebookId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to delete notebook");
  }
  return res.json();
}

export async function executeCell(notebookId, cellId) {
  const res = await fetch(`${BASE_PATH}/notebooks/${notebookId}/cells/${cellId}/execute`, {
    method: "POST",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to execute cell");
  }
  return res.json();
}

// Pipeline Optimization API functions
export async function getPipelineMetrics(pipelineId) {
  const res = await fetch(`${BASE_PATH}/pipelines/${pipelineId}/metrics`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to get pipeline metrics");
  }
  return res.json();
}

export async function optimizePipeline(pipelineId) {
  const res = await fetch(`${BASE_PATH}/pipelines/${pipelineId}/optimize`, {
    method: "POST",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to optimize pipeline");
  }
  return res.json();
}

export async function getCostAnalysis() {
  const res = await fetch(`${BASE_PATH}/optimization/cost-analysis`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to get cost analysis");
  }
  return res.json();
}

// Cloud Connections API functions
export async function listConnections() {
  const res = await fetch(`${BASE_PATH}/connections`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to list connections");
  }
  return res.json();
}

export async function createConnection(connection) {
  const res = await fetch(`${BASE_PATH}/connections`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(connection),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to create connection");
  }
  return res.json();
}

export async function testConnection(connectionId) {
  const res = await fetch(`${BASE_PATH}/connections/${connectionId}/test`, {
    method: "POST",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to test connection");
  }
  return res.json();
}

export async function deleteConnection(connectionId) {
  const res = await fetch(`${BASE_PATH}/connections/${connectionId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to delete connection");
  }
  return res.json();
}
export async function runPipeline(pipelineId, runConfig = {}) {
  const res = await fetch(`${BASE_PATH}/pipelines/${pipelineId}/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ run_config: runConfig }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Run pipeline failed");
  }
  return res.json();
}

export async function getRunStatus(runId) {
  const res = await fetch(`${BASE_PATH}/pipelines/runs/${runId}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Get run status failed");
  }
  return res.json();
}

export async function getPipeline(pipelineId) {
  const res = await fetch(`${BASE_PATH}/pipelines/${pipelineId}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Get pipeline failed");
  }
  return res.json();
}

export async function listShadowRuns(status) {
  const url = status ? `${BASE_PATH}/shadow?status=${encodeURIComponent(status)}` : `${BASE_PATH}/shadow`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "List shadows failed");
  }
  return res.json();
}

export async function getShadowRun(shadowId) {
  const res = await fetch(`${BASE_PATH}/shadow/${shadowId}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Get shadow failed");
  }
  return res.json();
}

export async function createShadowRun(input, inputType = "code", threshold) {
  const body = { input_type: inputType, input };
  if (threshold !== undefined) body.threshold = threshold;
  const res = await fetch(`${BASE_PATH}/shadow`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Create shadow failed");
  }
  return res.json();
}

export async function reviewShadow(shadowId, reviewer = "web-ui", action, comment = "") {
  const res = await fetch(`${BASE_PATH}/shadow/${shadowId}/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reviewer, action, comment }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Review shadow failed");
  }
  return res.json();
}
