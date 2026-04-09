import { EmptyState, StatusPill } from '../PlatformShell';

function recordMeta(tab, item) {
  if (tab === 'jobs') {
    return [
      item.execution_mode,
      item.attempt_count !== undefined ? `Attempts ${item.attempt_count}/${item.max_attempts || 1}` : null,
      item.claimed_by ? `Worker ${item.claimed_by}` : 'Unclaimed',
    ].filter(Boolean);
  }
  if (tab === 'runs') {
    return [
      item.started_at ? `Started ${item.started_at}` : null,
      item.node_summary ? `${item.node_summary.success || 0} ok / ${item.node_summary.failed || 0} failed` : null,
    ].filter(Boolean);
  }
  if (tab === 'agents') {
    return [
      item.version ? `Version ${item.version}` : null,
      item.observed_capacity !== undefined ? `Capacity ${item.observed_capacity}` : null,
    ].filter(Boolean);
  }
  return [
    item.target_id ? `Target ${item.target_id}` : null,
    item.deployed_at ? `Deployed ${item.deployed_at}` : item.created_at ? `Created ${item.created_at}` : null,
  ].filter(Boolean);
}

function jobTitle(job) {
  return `${job.job_type || 'job'} · ${job.resource_id || job.id}`;
}

function jobSubtitle(job) {
  return `${job.resource_type || 'resource'}${job.execution_mode ? ` · ${job.execution_mode}` : ''}`;
}

function runTitle(run) {
  return run.pipeline_id || run.id;
}

function runSubtitle(run) {
  return `${run.execution_mode || 'local'} · ${run.id}`;
}

function agentTitle(agent) {
  return agent.agent_id;
}

function agentSubtitle(agent) {
  return `${agent.active_jobs || 0} jobs · ${agent.active_runs || 0} runs`;
}

function deploymentTitle(deployment) {
  return `${deployment.pipeline_id || 'deployment'} · ${deployment.target_platform || 'target'}`;
}

function deploymentSubtitle(deployment) {
  return `${deployment.id || ''} · ${deployment.deployed_at || deployment.created_at || 'pending'}`;
}

function recordTitle(tab, item) {
  if (tab === 'jobs') {
    return jobTitle(item);
  }
  if (tab === 'runs') {
    return runTitle(item);
  }
  if (tab === 'agents') {
    return agentTitle(item);
  }
  return deploymentTitle(item);
}

function recordSubtitle(tab, item) {
  if (tab === 'jobs') {
    return jobSubtitle(item);
  }
  if (tab === 'runs') {
    return runSubtitle(item);
  }
  if (tab === 'agents') {
    return agentSubtitle(item);
  }
  return deploymentSubtitle(item);
}

function renderRecord(tab, item, selectedId, onSelect) {
  const identifier = item.id || item.agent_id;
  const metadata = recordMeta(tab, item);
  return (
    <button
      key={identifier}
      onClick={() => onSelect(identifier)}
      className={`w-full rounded-[24px] border p-4 text-left transition ${
        selectedId === identifier
          ? 'border-sky-200 bg-sky-50 shadow-[0_18px_40px_rgba(125,211,252,0.2)]'
          : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">{recordTitle(tab, item)}</div>
          <div className="mt-1 text-xs text-slate-500">{recordSubtitle(tab, item)}</div>
        </div>
        <StatusPill status={item.status || 'observed'} />
      </div>
      {metadata.length ? (
        <div className="mt-4 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">
          {metadata.map((entry) => (
            <span key={`${identifier}-${entry}`} className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5">
              {entry}
            </span>
          ))}
        </div>
      ) : null}
    </button>
  );
}

export default function RuntimeRecordList({ tab, items, sections, selectedId, onSelect }) {
  if (!items.length) {
    return <EmptyState message="No runtime records match the current filters." />;
  }

  if (tab === 'jobs' && sections?.length) {
    return (
      <div className="space-y-4">
        {sections.map((section) => (
          <div key={section.id} className="rounded-[26px] border border-stone-200 bg-stone-50/70 p-3 shadow-[0_14px_32px_rgba(148,163,184,0.08)]">
            <div className="mb-3 px-1 text-xs uppercase tracking-[0.24em] text-stone-500">{section.label}</div>
            <div className="space-y-3">
              {section.items.map((item) => renderRecord(tab, item, selectedId, onSelect))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return <div className="space-y-3">{items.map((item) => renderRecord(tab, item, selectedId, onSelect))}</div>;
}