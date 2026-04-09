import { RUNTIME_TABS } from '../../lib/platformExperience';

const controlClass = 'rounded-[22px] border border-stone-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100';

export default function RuntimeToolbar({
  tab,
  statusFilter,
  searchText,
  lastUpdatedAt,
  onTabChange,
  onStatusFilterChange,
  onSearchChange,
}) {
  return (
    <div className="mb-6 rounded-[30px] border border-stone-200/80 bg-white/80 p-4 shadow-[0_18px_44px_rgba(148,163,184,0.12)] backdrop-blur-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-stone-500">Operator controls</div>
          <div className="mt-2 text-sm leading-6 text-slate-600">Switch runtime domains, filter by lifecycle state, and keep inventory and drill-down synchronized.</div>
        </div>
        <div className="rounded-full border border-stone-200 bg-stone-50 px-4 py-2 text-[11px] uppercase tracking-[0.24em] text-slate-600">
          {lastUpdatedAt ? `Updated ${new Date(lastUpdatedAt).toLocaleTimeString()}` : 'Waiting for runtime data'}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {RUNTIME_TABS.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`rounded-[22px] border px-4 py-3 text-sm font-semibold transition ${
              tab === item.id
                ? 'border-sky-200 bg-sky-50 text-sky-700 shadow-[0_12px_28px_rgba(125,211,252,0.2)]'
                : 'border-stone-200 bg-stone-50/80 text-slate-700 hover:border-stone-300 hover:bg-white'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <select
          value={statusFilter}
          onChange={(event) => onStatusFilterChange(event.target.value)}
          className={controlClass}
        >
          <option value="">All statuses</option>
          <option value="queued">Queued</option>
          <option value="running">Running</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <input
          value={searchText}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search id, pipeline, worker, or target"
          className={`${controlClass} min-w-[280px] flex-1`}
        />
        <div className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-[11px] uppercase tracking-[0.24em] text-emerald-700">
          Live runtime inventory
        </div>
      </div>
    </div>
  );
}