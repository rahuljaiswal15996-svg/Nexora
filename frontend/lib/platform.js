export function extractItems(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }
  return payload?.items || [];
}

export function toErrorMessage(error) {
  if (!error) {
    return 'Unknown request failure';
  }
  if (typeof error === 'string') {
    return error;
  }
  return error.message || 'Unknown request failure';
}

export function isJobActive(job) {
  const status = (job?.status || '').toLowerCase();
  return status === 'queued' || status === 'running';
}

export function formatCurrency(value) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(amount);
}

export function statusTone(status = '') {
  const normalized = status.toLowerCase();
  if (normalized.includes('pass') || normalized.includes('active') || normalized.includes('complete') || normalized.includes('success') || normalized.includes('deployed')) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
  if (normalized.includes('queue') || normalized.includes('draft') || normalized.includes('pending') || normalized.includes('running')) {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }
  if (normalized.includes('fail') || normalized.includes('blocked') || normalized.includes('error')) {
    return 'border-rose-200 bg-rose-50 text-rose-700';
  }
  return 'border-slate-200 bg-slate-50 text-slate-600';
}