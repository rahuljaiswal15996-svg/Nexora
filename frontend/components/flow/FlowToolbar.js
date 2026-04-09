import { FLOW_OVERLAY_OPTIONS } from '../../lib/flowBuilder';
import { StatusPill } from '../PlatformShell';

const neutralButtonClass = 'border-stone-200 bg-stone-50/80 text-slate-700 hover:border-stone-300 hover:bg-white';

function overlayButtonClass(isActive) {
  return isActive
    ? 'border-sky-200 bg-sky-50 text-sky-700 shadow-[0_12px_28px_rgba(125,211,252,0.2)]'
    : neutralButtonClass;
}

export default function FlowToolbar({
  viewMode,
  overlayMode,
  hasSourceFlow,
  hasConvertedFlow,
  pipelineId,
  runState,
  busyKey,
  authoringBusyKey,
  hasNodes,
  selectedNode,
  selectedEdge,
  eventCount,
  dirty,
  validationCounts,
  onViewModeChange,
  onOverlayModeChange,
  onValidateGraph,
  onSaveGraph,
  onRun,
  onRetryFromNode,
  onPromote,
  onClearDraft,
}) {
  return (
    <div className="mb-6 rounded-[30px] border border-stone-200/80 bg-white/80 p-4 shadow-[0_18px_44px_rgba(148,163,184,0.12)] backdrop-blur-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-stone-500">Builder controls</div>
          <div className="mt-2 text-sm leading-6 text-slate-600">Switch source and converted flow views, change overlays, and run the same graph you are editing.</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {pipelineId ? <div className="rounded-full border border-stone-200 bg-stone-50 px-4 py-2 text-[11px] uppercase tracking-[0.22em] text-slate-600">Pipeline {pipelineId}</div> : null}
          {runState ? <StatusPill status={runState.status} /> : null}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => onViewModeChange('source')}
          disabled={!hasSourceFlow}
          className={`rounded-[22px] border px-4 py-3 text-sm font-semibold transition ${
            viewMode === 'source'
              ? 'border-sky-200 bg-sky-50 text-sky-700 shadow-[0_12px_28px_rgba(125,211,252,0.2)]'
              : `${neutralButtonClass} disabled:cursor-not-allowed disabled:opacity-35`
          }`}
        >
          Source flow
        </button>
        <button
          onClick={() => onViewModeChange('converted')}
          disabled={!hasConvertedFlow}
          className={`rounded-[22px] border px-4 py-3 text-sm font-semibold transition ${
            viewMode === 'converted'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 shadow-[0_12px_28px_rgba(167,243,208,0.22)]'
              : `${neutralButtonClass} disabled:cursor-not-allowed disabled:opacity-35`
          }`}
        >
          Converted flow
        </button>

        <div className="mx-2 hidden h-8 w-px bg-stone-200 xl:block" />

        {FLOW_OVERLAY_OPTIONS.map((item) => (
          <button
            key={item.id}
            onClick={() => onOverlayModeChange(item.id)}
            className={`rounded-[22px] border px-4 py-3 text-sm font-semibold transition ${overlayButtonClass(overlayMode === item.id)}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={onValidateGraph}
          disabled={authoringBusyKey === 'validate' || !hasNodes}
          className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
        >
          {authoringBusyKey === 'validate' ? 'Validating...' : 'Validate graph'}
        </button>
        <button
          onClick={onSaveGraph}
          disabled={authoringBusyKey === 'save' || !hasNodes}
          className="rounded-[22px] border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-700 transition hover:bg-sky-100 disabled:opacity-50"
        >
          {authoringBusyKey === 'save' ? 'Saving...' : dirty ? 'Save flow draft' : 'Save flow'}
        </button>
        <button
          onClick={onRun}
          disabled={busyKey === 'run' || authoringBusyKey === 'save' || authoringBusyKey === 'validate' || !hasNodes}
          className="rounded-[22px] bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:opacity-50"
        >
          {busyKey === 'run' ? 'Launching flow...' : 'Run flow'}
        </button>
        <button
          onClick={onRetryFromNode}
          disabled={busyKey === 'retry' || authoringBusyKey === 'save' || authoringBusyKey === 'validate' || !selectedNode}
          className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 transition hover:bg-amber-100 disabled:opacity-40"
        >
          {busyKey === 'retry' ? 'Retrying...' : selectedNode ? `Retry from ${selectedNode.label}` : 'Retry from node'}
        </button>
        <button
          onClick={onPromote}
          disabled={busyKey === 'promote' || !hasNodes}
          className="rounded-[22px] border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-semibold text-cyan-700 transition hover:bg-cyan-100 disabled:opacity-50"
        >
          {busyKey === 'promote' ? 'Promoting...' : 'Promote to production flow'}
        </button>
        <button
          onClick={onClearDraft}
          className="rounded-[22px] border border-stone-200 bg-stone-50/80 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-stone-300 hover:bg-white"
        >
          Clear draft
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.2em] text-slate-600">
        <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-2">
          Validation {validationCounts?.errors || 0} errors / {validationCounts?.warnings || 0} warnings
        </span>
        {dirty ? <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-amber-700">Draft changed</span> : null}
        <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-2">Events {eventCount}</span>
        {selectedEdge ? <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-2">Edge {selectedEdge.source} to {selectedEdge.target}</span> : null}
      </div>

      </div>
    </div>
  );
}
