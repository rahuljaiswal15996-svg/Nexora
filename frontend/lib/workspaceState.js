const FLOW_DRAFT_KEY = 'nexora.flow.draft';

function isBrowser() {
  return typeof window !== 'undefined';
}

export function saveFlowDraft(payload) {
  if (!isBrowser() || !payload) {
    return payload;
  }
  window.localStorage.setItem(FLOW_DRAFT_KEY, JSON.stringify(payload));
  return payload;
}

export function loadFlowDraft() {
  if (!isBrowser()) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(FLOW_DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearFlowDraft() {
  if (!isBrowser()) {
    return;
  }
  window.localStorage.removeItem(FLOW_DRAFT_KEY);
}