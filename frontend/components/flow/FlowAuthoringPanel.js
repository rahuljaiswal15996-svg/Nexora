import { EmptyState } from '../PlatformShell';

const fieldControlClass = 'w-full rounded-[22px] border border-stone-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100';
const panelClass = 'space-y-4 rounded-[30px] border border-stone-200/80 bg-white/82 p-5 shadow-[0_18px_44px_rgba(148,163,184,0.12)]';
const surfaceClass = 'rounded-[24px] border border-stone-200 bg-stone-50/80 p-4 shadow-[0_12px_28px_rgba(148,163,184,0.08)]';

function formatFieldValue(field, value) {
  if (field.type === 'boolean') {
    return Boolean(value);
  }
  if (field.type === 'json') {
    if (typeof value === 'string') {
      return value;
    }
    return JSON.stringify(value || field.default || {}, null, 2);
  }
  if (field.type === 'tags') {
    return Array.isArray(value) ? value.join(', ') : value || '';
  }
  return value ?? field.default ?? '';
}

function FieldControl({ field, value, onChange }) {
  if (field.type === 'boolean') {
    return (
      <label className="flex items-center justify-between gap-3 rounded-[22px] border border-stone-200 bg-white px-4 py-3 text-sm text-slate-700">
        <span>{field.label}</span>
        <input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4" />
      </label>
    );
  }

  if (field.type === 'select') {
    return (
      <select
        value={value ?? field.default ?? ''}
        onChange={(event) => onChange(event.target.value)}
        className={fieldControlClass}
      >
        {(field.options || []).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === 'textarea' || field.type === 'json') {
    return (
      <textarea
        value={formatFieldValue(field, value)}
        onChange={(event) => onChange(event.target.value)}
        rows={field.type === 'json' ? 6 : 5}
        className={fieldControlClass}
      />
    );
  }

  return (
    <input
      type={field.type === 'number' ? 'number' : 'text'}
      value={formatFieldValue(field, value)}
      placeholder={field.placeholder || ''}
      onChange={(event) => onChange(field.type === 'number' ? event.target.value : event.target.value)}
      className={fieldControlClass}
    />
  );
}

function IssueList({ title, items = [], tone }) {
  if (!items.length) {
    return null;
  }

  return (
    <div className={`rounded-2xl border p-4 ${tone}`}>
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-3 space-y-2 text-sm leading-6">
        {items.map((item, index) => (
          <div key={`${title}-${item.message || item}-${index}`}>{item.message || item}</div>
        ))}
      </div>
    </div>
  );
}

export default function FlowAuthoringPanel({
  selectedNode,
  selectedEdge,
  nodeDefinition,
  nodeValidation,
  onNodeMetaChange,
  onNodeConfigChange,
  onDeleteNode,
  onEdgeChange,
  onDeleteEdge,
}) {
  if (!selectedNode && !selectedEdge) {
    return <EmptyState message="Select a node or edge to author config, inspect validation, or remove it from the draft graph." />;
  }

  if (selectedEdge) {
    return (
      <div className={panelClass}>
        <div>
          <div className="text-xs uppercase tracking-[0.24em] text-stone-500">Edge authoring</div>
          <div className="mt-2 text-lg font-semibold text-slate-900">{selectedEdge.source} to {selectedEdge.target}</div>
        </div>

        <div>
          <div className="mb-2 text-xs uppercase tracking-[0.18em] text-stone-500">Flow kind</div>
          <select
            value={selectedEdge.flowKind || 'data'}
            onChange={(event) => onEdgeChange?.({ flowKind: event.target.value })}
            className={fieldControlClass}
          >
            <option value="data">Data flow</option>
            <option value="schema">Schema flow</option>
            <option value="control">Control flow</option>
          </select>
        </div>

        <div>
          <div className="mb-2 text-xs uppercase tracking-[0.18em] text-stone-500">Edge label</div>
          <input
            type="text"
            value={selectedEdge.label || ''}
            onChange={(event) => onEdgeChange?.({ label: event.target.value })}
            className={fieldControlClass}
          />
        </div>

        <button
          onClick={() => onDeleteEdge?.(selectedEdge.id)}
          className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
        >
          Delete edge
        </button>
      </div>
    );
  }

  const executionBinding = selectedNode.execution_binding || nodeValidation?.execution_binding || nodeDefinition?.execution_binding_template || null;
  const nodeErrors = nodeValidation?.errors || [];
  const nodeWarnings = nodeValidation?.warnings || [];

  return (
    <div className={panelClass}>
      <div>
        <div className="text-xs uppercase tracking-[0.24em] text-stone-500">Node authoring</div>
        <div className="mt-2 text-lg font-semibold text-slate-900">{selectedNode.label}</div>
        <div className="mt-2 text-sm leading-6 text-slate-600">{nodeDefinition?.description || selectedNode.description || 'Configure this node and map it to the runtime execution engine.'}</div>
      </div>

      <div className={surfaceClass}>
        <div className="text-xs uppercase tracking-[0.18em] text-stone-500">Display metadata</div>
        <div className="mt-3 space-y-3">
          <input
            type="text"
            value={selectedNode.label || ''}
            onChange={(event) => onNodeMetaChange?.({ label: event.target.value })}
            className={fieldControlClass}
          />
          <textarea
            rows={3}
            value={selectedNode.description || ''}
            onChange={(event) => onNodeMetaChange?.({ description: event.target.value })}
            className={fieldControlClass}
          />
        </div>
      </div>

      {(nodeDefinition?.config_schema || []).map((field) => (
        <div key={field.name} className={`${surfaceClass} space-y-2`}>
          <div className="text-xs uppercase tracking-[0.18em] text-stone-500">{field.label}</div>
          <FieldControl field={field} value={selectedNode.config?.[field.name]} onChange={(value) => onNodeConfigChange?.(field.name, value)} />
        </div>
      ))}

      {executionBinding ? (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-700">
          <div className="font-semibold">Execution mapping</div>
          <div className="mt-3 space-y-2 text-sm leading-6">
            <div>Engine {executionBinding.engine_type || 'n/a'}</div>
            <div>Runtime {executionBinding.runtime_profile || 'n/a'}</div>
            <div>Executor {executionBinding.executor || 'n/a'}</div>
            <div>Target {executionBinding.target_ref || 'n/a'}</div>
          </div>
        </div>
      ) : null}

      <IssueList title="Validation errors" items={nodeErrors} tone="border-rose-200 bg-rose-50 text-rose-700" />
      <IssueList title="Validation warnings" items={nodeWarnings} tone="border-amber-200 bg-amber-50 text-amber-700" />

      <button
        onClick={() => onDeleteNode?.(selectedNode.id)}
        className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
      >
        Delete node
      </button>
    </div>
  );
}