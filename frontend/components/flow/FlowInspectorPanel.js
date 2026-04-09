import { FLOW_INSPECTOR_TABS } from '../../lib/flowBuilder';
import { EmptyState, StatusPill } from '../PlatformShell';

const tableSurfaceClass = 'overflow-hidden rounded-[26px] border border-stone-200 bg-white shadow-[0_16px_38px_rgba(148,163,184,0.12)]';
const metricCardClass = 'rounded-[22px] border border-stone-200 bg-stone-50/80 p-4 text-sm text-slate-600 shadow-[0_12px_28px_rgba(148,163,184,0.08)]';

function TabButton({ isActive, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-[22px] border px-4 py-3 text-sm font-semibold transition ${
        isActive
          ? 'border-sky-200 bg-sky-50 text-sky-700 shadow-[0_12px_28px_rgba(125,211,252,0.2)]'
          : 'border-stone-200 bg-white text-slate-700 hover:border-stone-300 hover:bg-stone-50'
      }`}
    >
      {label}
    </button>
  );
}

function LogTone(level) {
  const normalized = `${level || ''}`.toLowerCase();
  if (normalized === 'error') {
    return 'border-rose-200 bg-rose-50 text-rose-700';
  }
  if (normalized === 'warn') {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }
  if (normalized === 'success') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
  return 'border-stone-200 bg-white text-slate-700';
}

function SchemaTab({ schema }) {
  if (!schema.length) {
    return <EmptyState message="No schema metadata is available for this node." />;
  }

  return (
    <div className={tableSurfaceClass}>
      <table className="min-w-full divide-y divide-stone-200 text-sm text-slate-600">
        <thead className="bg-stone-50 text-left text-xs uppercase tracking-[0.24em] text-stone-500">
          <tr>
            <th className="px-4 py-3">Column</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Nullable</th>
            <th className="px-4 py-3">Source</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-200">
          {schema.map((column) => (
            <tr key={`${column.name}-${column.source || 'node'}`}>
              <td className="px-4 py-3 font-medium text-slate-900">{column.name}</td>
              <td className="px-4 py-3">{column.type}</td>
              <td className="px-4 py-3">{column.nullable ? 'Yes' : 'No'}</td>
              <td className="px-4 py-3">{column.source || 'flow'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PreviewTab({ previewRows }) {
  if (!previewRows.length) {
    return <EmptyState message="No preview rows are available for this node." />;
  }

  const columns = Object.keys(previewRows[0] || {});
  return (
    <div className={tableSurfaceClass}>
      <table className="min-w-full divide-y divide-stone-200 text-sm text-slate-600">
        <thead className="bg-stone-50 text-left text-xs uppercase tracking-[0.24em] text-stone-500">
          <tr>
            {columns.map((column) => (
              <th key={column} className="px-4 py-3">{column}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-200">
          {previewRows.map((row, rowIndex) => (
            <tr key={`preview-${rowIndex + 1}`}>
              {columns.map((column) => (
                <td key={`${rowIndex + 1}-${column}`} className="px-4 py-3 text-slate-700">{String(row[column])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LogsTab({ logs }) {
  if (!logs.length) {
    return <EmptyState message="No runtime logs are available for this node." />;
  }

  return (
    <div className="space-y-3">
      {logs.map((log) => (
        <div key={log.id || `${log.level}-${log.timestamp}-${log.message}`} className={`rounded-2xl border p-4 ${LogTone(log.level)}`}>
          <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.22em]">
            <span>{log.stream ? `${log.level} · ${log.stream}` : log.level}</span>
            <span>{log.timestamp}</span>
          </div>
          <div className="mt-3 text-sm leading-6">{log.message}</div>
        </div>
      ))}
    </div>
  );
}

function LineageTab({ lineage, onNodeJump }) {
  return (
    <div className="space-y-4 text-sm text-slate-600">
      <div>
        <div className="mb-3 text-xs uppercase tracking-[0.24em] text-stone-500">Upstream lineage</div>
        <div className="flex flex-wrap gap-2">
          {lineage.upstream.length ? (
            lineage.upstream.map((node) => (
              <button
                key={node.id}
                onClick={() => onNodeJump(node.id)}
                className="rounded-full border border-stone-200 bg-white px-3 py-2 text-left text-sm text-slate-700 transition hover:border-stone-300 hover:bg-stone-50"
              >
                {node.label}
              </button>
            ))
          ) : (
            <span className="text-stone-500">No upstream nodes</span>
          )}
        </div>
      </div>

      <div>
        <div className="mb-3 text-xs uppercase tracking-[0.24em] text-stone-500">Downstream lineage</div>
        <div className="flex flex-wrap gap-2">
          {lineage.downstream.length ? (
            lineage.downstream.map((node) => (
              <button
                key={node.id}
                onClick={() => onNodeJump(node.id)}
                className="rounded-full border border-stone-200 bg-white px-3 py-2 text-left text-sm text-slate-700 transition hover:border-stone-300 hover:bg-stone-50"
              >
                {node.label}
              </button>
            ))
          ) : (
            <span className="text-stone-500">No downstream nodes</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function FlowInspectorPanel({
  selectedNode,
  inspector,
  inspectorTab,
  onInspectorTabChange,
  actions,
  onNodeJump,
  onRetryFromNode,
}) {
  if (!selectedNode || !inspector?.summary) {
    return <EmptyState message="Select a node in the canvas to inspect its schema, logs, preview data, and lineage." />;
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs uppercase tracking-[0.24em] text-stone-500">Node inspector</div>
        <div className="mt-2 text-lg font-semibold text-slate-900">{selectedNode.label}</div>
        <div className="mt-2 text-sm leading-6 text-slate-600">{selectedNode.description || 'This node is part of the unified Flow Builder graph.'}</div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className={metricCardClass}>
          <div className="text-xs uppercase tracking-[0.2em] text-stone-500">Type</div>
          <div className="mt-2 font-semibold text-slate-900">{inspector.summary.kind}</div>
        </div>
        <div className={metricCardClass}>
          <div className="text-xs uppercase tracking-[0.2em] text-stone-500">Execution</div>
          <div className="mt-2"><StatusPill status={inspector.summary.executionStatus} /></div>
        </div>
        <div className={metricCardClass}>
          <div className="text-xs uppercase tracking-[0.2em] text-stone-500">Schema columns</div>
          <div className="mt-2 font-semibold text-slate-900">{inspector.summary.schemaColumns}</div>
        </div>
        <div className={metricCardClass}>
          <div className="text-xs uppercase tracking-[0.2em] text-stone-500">Preview rows</div>
          <div className="mt-2 font-semibold text-slate-900">{inspector.summary.previewRows}</div>
        </div>
        <div className={metricCardClass}>
          <div className="text-xs uppercase tracking-[0.2em] text-stone-500">Upstream</div>
          <div className="mt-2 font-semibold text-slate-900">{inspector.summary.upstreamCount}</div>
        </div>
        <div className={metricCardClass}>
          <div className="text-xs uppercase tracking-[0.2em] text-stone-500">Downstream</div>
          <div className="mt-2 font-semibold text-slate-900">{inspector.summary.downstreamCount}</div>
        </div>
      </div>

      <div>
        <div className="text-xs uppercase tracking-[0.24em] text-stone-500">Quick actions</div>
        <div className="mt-3 grid gap-2">
          <button
            onClick={onRetryFromNode}
            className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm font-semibold text-amber-700 transition hover:bg-amber-100"
          >
            Retry from this node
          </button>
          {actions.map((item) => (
            <button
              key={item.label}
              onClick={item.action}
              className="rounded-[22px] border border-stone-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:border-stone-300 hover:bg-stone-50"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {FLOW_INSPECTOR_TABS.map((item) => (
          <TabButton key={item.id} label={item.label} isActive={inspectorTab === item.id} onClick={() => onInspectorTabChange(item.id)} />
        ))}
      </div>

      {inspectorTab === 'schema' ? <SchemaTab schema={inspector.schema} /> : null}
      {inspectorTab === 'logs' ? <LogsTab logs={inspector.logs} /> : null}
      {inspectorTab === 'preview' ? <PreviewTab previewRows={inspector.previewRows} /> : null}
      {inspectorTab === 'lineage' ? <LineageTab lineage={inspector.lineage} onNodeJump={onNodeJump} /> : null}

      <pre className="overflow-auto rounded-[24px] border border-stone-200 bg-stone-50/80 p-4 text-xs text-slate-700">{JSON.stringify(selectedNode.metadata || selectedNode.sourceRef || {}, null, 2)}</pre>
    </div>
  );
}