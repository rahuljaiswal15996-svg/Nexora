const API_PATH = "/api";

async function request(path, options = {}) {
  const response = await fetch(`${API_PATH}${path}`, options);
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Failed to fetch history");
  }
  return response.json();
}

export function loadLocalHistory() {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const json = window.localStorage.getItem("nexora_conversion_history");
    return json ? JSON.parse(json) : [];
  } catch (error) {
    console.error("Failed to load local history", error);
    return [];
  }
}

export function saveLocalHistory(entry) {
  const history = loadLocalHistory();
  const next = [entry, ...history].slice(0, 20);
  window.localStorage.setItem("nexora_conversion_history", JSON.stringify(next));
  return next;
}

export function clearLocalHistory() {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    window.localStorage.removeItem("nexora_conversion_history");
  } catch (error) {
    console.error("Failed to clear local history", error);
  }
  return [];
}

export async function fetchHistory() {
  return request("/history");
}

export async function clearHistory() {
  return request("/history", { method: "DELETE" });
}
