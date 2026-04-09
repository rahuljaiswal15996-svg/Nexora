import { EmptyState, StatusPill } from '../PlatformShell';

const metricCardClass = 'rounded-[24px] border border-stone-200 bg-stone-50/80 p-4 text-sm text-slate-600 shadow-[0_12px_28px_rgba(148,163,184,0.08)]';
const panelClass = 'rounded-[28px] border border-stone-200 bg-white/82 p-4 shadow-[0_16px_38px_rgba(148,163,184,0.12)]';

export default function RuntimeDeploymentInspector({ deployment, detail, busyKey, onRollback, onSelectRun, selectedRunId }) {
  if (!deployment) {
    return null;
  }

  const runs = detail?.runs || [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.24em] text-stone-500">Deployment record</div>
          <div className="mt-2 text-lg font-semibold text-slate-900">{deployment.pipeline_id || deployment.id}</div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <StatusPill status={deployment.status || 'unknown'} />
          <button
            onClick={() => onRollback(deployment)}
            disabled={busyKey === `rollback-${deployment.id}`}
            className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-700 transition hover:bg-sky-100 disabled:opacity-50"
          >
            {busyKey === `rollback-${deployment.id}` ? 'Queueing rollback...' : 'Rollback'}
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className={metricCardClass}>
          <div className="text-stone-500">Target platform</div>
          <div className="mt-2 font-semibold text-slate-900">{deployment.target_platform || 'unknown'}</div>
        </div>
        <div className={metricCardClass}>
          <div className="text-stone-500">Target id</div>
          <div className="mt-2 font-semibold text-slate-900">{deployment.target_id || 'direct'}</div>
        </div>
        <div className={metricCardClass}>
          <div className="text-stone-500">Deployed at</div>
          <div className="mt-2 font-semibold text-slate-900">{deployment.deployed_at || deployment.created_at || 'pending'}</div>
        </div>
        <div className={metricCardClass}>
          <div className="text-stone-500">Version count</div>
          <div className="mt-2 font-semibold text-slate-900">{runs.length || 1}</div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
        <div className={panelClass}>
          <div className="text-xs uppercase tracking-[0.24em] text-stone-500">Deployment versions</div>
          <div className="mt-3 space-y-3">
            {runs.length ? runs.map((run, index) => (
              <button
                key={run.id || `${deployment.id}-run-${index}`}
                onClick={() => onSelectRun(run.id || `${deployment.id}-run-${index}`)}
                className={`w-full rounded-[24px] border p-4 text-left transition ${
                  selectedRunId === (run.id || `${deployment.id}-run-${index}`)
                    ? 'border-sky-200 bg-sky-50 shadow-[0_18px_40px_rgba(125,211,252,0.2)]'
                    : 'border-stone-200 bg-stone-50/80 hover:border-stone-300 hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Version {runs.length - index}</div>
                    <div className="mt-1 text-xs text-slate-500">{run.run_id || run.started_at || deployment.id}</div>
                  </div>
                  <StatusPill status={run.status || 'unknown'} />
                </div>
              </button>
            )) : <EmptyState message="Deployment versions will appear here once the backend records rollout history." />}
          </div>
        </div>
        <div className={panelClass}>
          <div className="text-xs uppercase tracking-[0.24em] text-stone-500">Selected version detail</div>
          <pre className="mt-3 overflow-auto whitespace-pre-wrap rounded-[22px] border border-stone-200 bg-stone-50/80 p-4 text-xs text-slate-700">{JSON.stringify(runs.find((run, index) => (run.id || `${deployment.id}-run-${index}`) === selectedRunId) || detail || deployment, null, 2)}</pre>
        </div>
      </div>
    </div>
  );
}