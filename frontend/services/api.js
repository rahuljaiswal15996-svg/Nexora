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
