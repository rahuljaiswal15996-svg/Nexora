function issueTone(hasErrors) {
  return hasErrors
    ? 'border-rose-200 bg-rose-50 text-rose-700'
    : 'border-sky-200 bg-sky-50 text-sky-700';
}

export default function FlowNodePalette({
  nodeCatalog = [],
  nodeKinds = {},
  validationCounts = { errors: 0, warnings: 0 },
  dirty = false,
  onAddNode,
}) {
  const hasErrors = validationCounts.errors > 0;

  return (
    <div className="space-y-4 rounded-[30px] border border-stone-200/80 bg-white/82 p-5 shadow-[0_18px_44px_rgba(148,163,184,0.12)]">
      <div>
        <div className="text-xs uppercase tracking-[0.24em] text-stone-500">Node catalog</div>
        <div className="mt-2 text-lg font-semibold text-slate-900">Author the graph directly</div>
        <div className="mt-2 text-sm leading-6 text-slate-600">
          Add node types from the backend catalog. Each one brings its own config schema and execution binding contract.
        </div>
      </div>

      <div className={`rounded-[24px] border p-4 text-sm shadow-[0_12px_28px_rgba(148,163,184,0.1)] ${issueTone(hasErrors)}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="font-semibold">Graph validation</div>
          <div className="rounded-full border border-stone-200 bg-white px-2 py-1 text-xs uppercase tracking-[0.16em] text-slate-600">
            {dirty ? 'Unsaved changes' : 'Saved draft'}
          </div>
        </div>
        <div className="mt-3 leading-6">
          {validationCounts.errors} errors · {validationCounts.warnings} warnings
        </div>
      </div>

      {nodeCatalog.map((item) => (
        <div key={item.kind} className="rounded-[24px] border border-stone-200 bg-stone-50/80 p-4 transition hover:border-stone-300 hover:bg-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">{item.label}</div>
              <div className="mt-2 text-sm leading-6 text-slate-600">{item.description}</div>
            </div>
            <div className="rounded-full border border-stone-200 bg-white px-2 py-1 text-xs text-slate-600">{nodeKinds[item.kind] || 0}</div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
            {(item.config_schema || []).slice(0, 3).map((field) => (
              <span key={field.name} className="rounded-full border border-stone-200 bg-white px-3 py-2">
                {field.label}
              </span>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
              Executor {item.execution_binding_template?.executor || 'n/a'}
            </div>
            <button
              onClick={() => onAddNode?.(item.kind)}
              className="rounded-[20px] border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-700 transition hover:bg-sky-100"
            >
              Add node
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}