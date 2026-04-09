import DAGEditor from '../DAGEditor';
import { EmptyState, StatusPill } from '../PlatformShell';

const metricCardClass = 'rounded-[24px] border border-stone-200 bg-stone-50/80 p-4 text-sm text-slate-600 shadow-[0_12px_28px_rgba(148,163,184,0.08)]';
const panelClass = 'rounded-[28px] border border-stone-200 bg-white/82 p-4 shadow-[0_16px_38px_rgba(148,163,184,0.12)]';

function renderLogMessage(log) {
  if (!log) {
    return null;
  }
  return `${log.created_at || ''} [${log.level || 'info'}] ${log.message || ''}`.trim();
}

export default function RuntimeRunInspector({
  run,
  pipeline,
  dag,
  runNodes,
  selectedRunNodeId,
  logs,
  onSelectRunNode,
}) {
  if (!run) {
    return null;
  }

  const selectedNodeExecution = runNodes.find((item) => item.node_id === selectedRunNodeId) || runNodes[0] || null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.24em] text-stone-500">Pipeline run</div>
          <div className="mt-2 text-lg font-semibold text-slate-900">{run.pipeline_id}</div>
        </div>
        <div className="ml-auto"><StatusPill status={run.status || 'unknown'} /></div>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <div className={metricCardClass}>
          <div className="text-stone-500">Execution mode</div>
          <div className="mt-2 font-semibold text-slate-900">{run.execution_mode || 'local'}</div>
        </div>
        <div className={metricCardClass}>
          <div className="text-stone-500">Queued</div>
          <div className="mt-2 font-semibold text-slate-900">{run.node_summary?.queued || 0}</div>
        </div>
        <div className={metricCardClass}>
          <div className="text-stone-500">Running</div>
          <div className="mt-2 font-semibold text-slate-900">{run.node_summary?.running || 0}</div>
        </div>
        <div className={metricCardClass}>
          <div className="text-stone-500">Success</div>
          <div className="mt-2 font-semibold text-slate-900">{run.node_summary?.success || 0}</div>
        </div>
        <div className={metricCardClass}>
          <div className="text-stone-500">Failed</div>
          <div className="mt-2 font-semibold text-slate-900">{run.node_summary?.failed || 0}</div>
        </div>
      </div>

      <div className={panelClass}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-stone-500">Execution graph</div>
            <div className="mt-2 text-sm text-slate-600">Run progress is projected directly onto the persisted flow DAG for stage-level debugging.</div>
          </div>
          {pipeline ? <div className="rounded-full border border-stone-200 bg-stone-50 px-3 py-2 text-[11px] uppercase tracking-[0.22em] text-slate-600">Pipeline loaded</div> : null}
        </div>
        <DAGEditor
          dagJson={dag}
          selectedNodeId={selectedRunNodeId}
          onNodeSelect={onSelectRunNode}
          showLegend={false}
          heightClass="h-[24rem]"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
        <div className={panelClass}>
          <div className="text-xs uppercase tracking-[0.24em] text-stone-500">Node-level status</div>
          <div className="mt-3 space-y-3">
            {runNodes.length ? runNodes.map((node) => (
              <button
                key={node.node_id}
                onClick={() => onSelectRunNode(node.node_id)}
                className={`w-full rounded-[24px] border p-4 text-left transition ${
                  selectedRunNodeId === node.node_id
                    ? 'border-sky-200 bg-sky-50 shadow-[0_18px_40px_rgba(125,211,252,0.2)]'
                    : 'border-stone-200 bg-stone-50/80 hover:border-stone-300 hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{node.node_label || node.node_id}</div>
                    <div className="mt-1 text-xs text-slate-500">{node.node_kind} · stage {node.stage_index + 1}</div>
                  </div>
                  <StatusPill status={node.status || 'unknown'} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  <span className="rounded-full border border-stone-200 bg-white px-3 py-1.5">Attempts {node.attempt_count || 0} / {node.max_attempts || 1}</span>
                </div>
              </button>
            )) : <EmptyState message="No node executions yet for this run." />}
          </div>
        </div>

        <div className={panelClass}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-stone-500">Selected node logs</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">{selectedNodeExecution?.node_label || selectedNodeExecution?.node_id || 'No node selected'}</div>
            </div>
            {selectedNodeExecution ? <StatusPill status={selectedNodeExecution.status || 'unknown'} /> : null}
          </div>
          {selectedNodeExecution?.error_text ? (
            <div className="mt-4 rounded-[24px] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              <div className="text-xs uppercase tracking-[0.24em] text-rose-500">Error trace</div>
              <pre className="mt-3 whitespace-pre-wrap text-xs text-rose-700">{selectedNodeExecution.error_text}</pre>
            </div>
          ) : null}
          <div className="mt-4 max-h-[28rem] overflow-auto rounded-[24px] border border-stone-200 bg-stone-50/80 p-4">
            {logs.length ? (
              <div className="space-y-3 text-xs text-slate-700">
                {logs.map((log) => (
                  <pre key={log.id || log.cursor} className="whitespace-pre-wrap text-xs text-slate-700">{renderLogMessage(log)}</pre>
                ))}
              </div>
            ) : (
              <EmptyState message={pipeline ? 'Logs will stream here for the selected node.' : 'Pipeline definition could not be loaded for this run.'} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}