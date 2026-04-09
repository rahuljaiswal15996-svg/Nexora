import { StatusPill } from '../PlatformShell';

const metricCardClass = 'rounded-[24px] border border-stone-200 bg-stone-50/80 p-4 text-sm text-slate-600 shadow-[0_12px_28px_rgba(148,163,184,0.08)]';
const detailPanelClass = 'rounded-[28px] border border-stone-200 bg-white/82 p-4 shadow-[0_16px_38px_rgba(148,163,184,0.12)]';

function summaryValue(value, fallback = 'n/a') {
  return value || fallback;
}

export default function RuntimeJobInspector({ job, busyKey, onCancel, onRetry }) {
  if (!job) {
    return null;
  }

  const normalizedStatus = `${job.status || ''}`.toLowerCase();
  const canCancel = normalizedStatus === 'queued' || normalizedStatus === 'running';
  const canRetry = !canCancel;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.24em] text-stone-500">Control-plane job</div>
          <div className="mt-2 text-lg font-semibold text-slate-900">{job.job_type} · {job.resource_id || job.id}</div>
        </div>
        <div className="ml-auto"><StatusPill status={job.status || 'unknown'} /></div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className={metricCardClass}>
          <div className="text-stone-500">Execution mode</div>
          <div className="mt-2 font-semibold text-slate-900">{summaryValue(job.execution_mode)}</div>
        </div>
        <div className={metricCardClass}>
          <div className="text-stone-500">Attempts</div>
          <div className="mt-2 font-semibold text-slate-900">{job.attempt_count || 0} / {job.max_attempts || 1}</div>
        </div>
        <div className={metricCardClass}>
          <div className="text-stone-500">Claimed by</div>
          <div className="mt-2 font-semibold text-slate-900">{summaryValue(job.claimed_by, 'unclaimed')}</div>
        </div>
        <div className={metricCardClass}>
          <div className="text-stone-500">Finished</div>
          <div className="mt-2 font-semibold text-slate-900">{summaryValue(job.finished_at, 'in progress')}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => onCancel(job)}
          disabled={!canCancel || busyKey === `cancel-${job.id}`}
          className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
        >
          {busyKey === `cancel-${job.id}` ? 'Cancelling...' : 'Cancel job'}
        </button>
        <button
          onClick={() => onRetry(job)}
          disabled={!canRetry || busyKey === `retry-${job.id}`}
          className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-700 transition hover:bg-sky-100 disabled:opacity-50"
        >
          {busyKey === `retry-${job.id}` ? 'Retrying...' : 'Retry job'}
        </button>
      </div>

      {job.error_text ? (
        <div className="rounded-[26px] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 shadow-[0_12px_28px_rgba(244,63,94,0.08)]">
          <div className="text-xs uppercase tracking-[0.24em] text-rose-500">Error trace</div>
          <pre className="mt-3 whitespace-pre-wrap text-xs text-rose-700">{job.error_text}</pre>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <div className={detailPanelClass}>
          <div className="text-xs uppercase tracking-[0.24em] text-stone-500">Payload</div>
          <pre className="mt-3 overflow-auto whitespace-pre-wrap rounded-[22px] border border-stone-200 bg-stone-50/80 p-4 text-xs text-slate-700">{JSON.stringify(job.payload || {}, null, 2)}</pre>
        </div>
        <div className={detailPanelClass}>
          <div className="text-xs uppercase tracking-[0.24em] text-stone-500">Result</div>
          <pre className="mt-3 overflow-auto whitespace-pre-wrap rounded-[22px] border border-stone-200 bg-stone-50/80 p-4 text-xs text-slate-700">{JSON.stringify(job.result || {}, null, 2)}</pre>
        </div>
      </div>
    </div>
  );
}