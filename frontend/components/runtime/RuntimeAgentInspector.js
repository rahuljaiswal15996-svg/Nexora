import { StatusPill } from '../PlatformShell';

const metricCardClass = 'rounded-[24px] border border-stone-200 bg-stone-50/80 p-4 text-sm text-slate-600 shadow-[0_12px_28px_rgba(148,163,184,0.08)]';

export default function RuntimeAgentInspector({ agent }) {
  if (!agent) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.24em] text-stone-500">Remote worker</div>
          <div className="mt-2 text-lg font-semibold text-slate-900">{agent.agent_id}</div>
        </div>
        <div className="ml-auto"><StatusPill status={agent.status || 'unknown'} /></div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className={metricCardClass}>
          <div className="text-stone-500">Heartbeat</div>
          <div className="mt-2 font-semibold text-slate-900">{agent.last_heartbeat_at || 'unreported'}</div>
        </div>
        <div className={metricCardClass}>
          <div className="text-stone-500">Observed capacity</div>
          <div className="mt-2 font-semibold text-slate-900">{agent.observed_capacity || 0}</div>
        </div>
        <div className={metricCardClass}>
          <div className="text-stone-500">Version</div>
          <div className="mt-2 font-semibold text-slate-900">{agent.version || 'unreported'}</div>
        </div>
        <div className={metricCardClass}>
          <div className="text-stone-500">Assigned work</div>
          <div className="mt-2 font-semibold text-slate-900">{(agent.active_jobs || 0) + (agent.active_runs || 0)}</div>
        </div>
      </div>

      <div className="rounded-[28px] border border-stone-200 bg-white/82 p-4 shadow-[0_16px_38px_rgba(148,163,184,0.12)]">
        <div className="text-xs uppercase tracking-[0.24em] text-stone-500">Assigned jobs and runs</div>
        <div className="mt-3 space-y-3">
          {(agent.workloads || []).length ? (
            agent.workloads.map((workload) => (
              <div key={`${workload.type}-${workload.id}`} className="rounded-[24px] border border-stone-200 bg-stone-50/80 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{workload.type}</div>
                    <div className="mt-1 text-xs text-slate-500">{workload.id}</div>
                  </div>
                  <StatusPill status={workload.status || 'unknown'} />
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-[24px] border border-stone-200 bg-stone-50/80 p-4 text-sm text-slate-600">No active workloads reported for this agent.</div>
          )}
        </div>
      </div>
    </div>
  );
}