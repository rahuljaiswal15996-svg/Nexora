import PlatformShell, { MetricTile, PlatformPanel, StatusPill } from '../components/PlatformShell';
import {
  architectureReview,
  buildArchitectureJson,
  buildArchitectureMarkdown,
  buildCapabilityCsv,
} from '../lib/architectureReviewData';

function downloadText(filename, content, mimeType) {
  if (typeof window === 'undefined') {
    return;
  }
  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

function statusLabel(status) {
  if (status === 'aligned' || status === 'strong') {
    return 'aligned';
  }
  if (status === 'missing-ui') {
    return 'missing';
  }
  if (status === 'overloaded') {
    return 'overloaded';
  }
  if (status === 'thin' || status === 'needs-depth' || status === 'partial') {
    return 'needs review';
  }
  return status || 'unknown';
}

export default function ArchitectureReviewPage() {
  return (
    <PlatformShell
      eyebrow="Architecture Review"
      title="Review the real frontend-backend alignment before reshaping the product."
      description="This page captures the current Nexora architecture as implemented: frontend workspaces, backend route groups, service ownership, overload points, and where the UI and backend no longer feel like the same product."
      actions={
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => downloadText('nexora-architecture-review.json', buildArchitectureJson(), 'application/json')}
            className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 font-semibold text-white transition hover:bg-white/15"
          >
            Download JSON
          </button>
          <button
            onClick={() => downloadText('nexora-architecture-review.md', buildArchitectureMarkdown(), 'text/markdown')}
            className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 font-semibold text-white transition hover:bg-white/15"
          >
            Download Markdown
          </button>
          <button
            onClick={() => downloadText('nexora-capability-matrix.csv', buildCapabilityCsv(), 'text/csv')}
            className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 font-semibold text-cyan-50 transition hover:bg-cyan-300/15"
          >
            Download CSV Matrix
          </button>
        </div>
      }
    >
      <PlatformPanel title="Snapshot" description="High-level scan of the implemented architecture, not a roadmap fantasy model.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {architectureReview.summary.map((item) => (
            <MetricTile key={item.label} label={item.label} value={item.value} detail={item.detail} />
          ))}
        </div>
      </PlatformPanel>

      <PlatformPanel title="Capability Matrix" description="Each row maps a user-facing capability to its actual backend route and service footprint.">
        <div className="overflow-x-auto rounded-3xl border border-white/10">
          <table className="min-w-full divide-y divide-white/10 text-left text-sm text-accent/75">
            <thead className="bg-white/5 text-xs uppercase tracking-[0.22em] text-accent/50">
              <tr>
                <th className="px-4 py-3">Capability</th>
                <th className="px-4 py-3">Frontend</th>
                <th className="px-4 py-3">Backend</th>
                <th className="px-4 py-3">Services</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Health</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 bg-black/10">
              {architectureReview.capabilityMatrix.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-4 align-top">
                    <div className="font-semibold text-white">{item.capability}</div>
                    <div className="mt-1 text-xs text-accent/45">{item.category} · {item.id}</div>
                    <div className="mt-2 text-xs text-accent/60">{item.notes}</div>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <div className="space-y-1">
                      {item.frontend.length ? item.frontend.map((entry) => <div key={entry}>{entry}</div>) : <div className="text-accent/45">No dedicated page</div>}
                    </div>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <div className="space-y-1">
                      {item.backendRoutes.map((entry) => <div key={entry}>{entry}</div>)}
                    </div>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <div className="space-y-1">
                      {item.services.map((entry) => <div key={entry}>{entry}</div>)}
                    </div>
                  </td>
                  <td className="px-4 py-4 align-top"><StatusPill status={statusLabel(item.status)} /></td>
                  <td className="px-4 py-4 align-top">
                    <div className="font-semibold text-white">{item.health}%</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PlatformPanel>

      <PlatformPanel title="Where The Disconnect Shows" description="These are the places where the frontend and backend feel like different products or where the UI is carrying too many concepts at once.">
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="text-lg font-semibold text-white">Overloaded pages</div>
            <div className="mt-4 space-y-3">
              {architectureReview.disconnects.overloadedPages.map((item) => (
                <div key={item.page} className="rounded-2xl border border-white/10 bg-black/10 p-4">
                  <div className="font-semibold text-white">{item.page}</div>
                  <div className="mt-2 text-sm text-accent/70">{item.issue}</div>
                  <div className="mt-2 text-xs text-cyan-100/70">{item.recommendation}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="text-lg font-semibold text-white">Thin frontend surfaces</div>
            <div className="mt-4 space-y-3">
              {architectureReview.disconnects.thinPages.map((item) => (
                <div key={item.page} className="rounded-2xl border border-white/10 bg-black/10 p-4">
                  <div className="font-semibold text-white">{item.page}</div>
                  <div className="mt-2 text-sm text-accent/70">{item.issue}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="text-lg font-semibold text-white">Backend modules lacking a real UI</div>
            <div className="mt-4 space-y-3">
              {architectureReview.disconnects.orphanedBackend.map((item) => (
                <div key={item.concept} className="rounded-2xl border border-white/10 bg-black/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-white">{item.concept}</div>
                    <StatusPill status={item.priority} />
                  </div>
                  <div className="mt-2 text-sm text-accent/70">{item.detail}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </PlatformPanel>

      <PlatformPanel title="Page Coverage" description="This makes the UI load problem obvious: some pages are deep and real, while others are wrappers or too broad for one screen.">
        <div className="grid gap-4 lg:grid-cols-2">
          {architectureReview.pageCoverage.map((item) => (
            <div key={item.page} className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xl font-semibold text-white">{item.page}</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.22em] text-accent/45">{item.type}</div>
                </div>
                <StatusPill status={statusLabel(item.status)} />
              </div>
              <div className="mt-4 text-sm text-accent/68">Health {item.health}%</div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-accent/45">Routes</div>
                  <div className="mt-2 space-y-1 text-sm text-accent/72">
                    {item.routes.map((entry) => <div key={entry}>{entry}</div>)}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-accent/45">Services</div>
                  <div className="mt-2 space-y-1 text-sm text-accent/72">
                    {item.services.map((entry) => <div key={entry}>{entry}</div>)}
                  </div>
                </div>
              </div>
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/10 p-4 text-sm text-accent/70">
                {item.gaps.map((gap) => (
                  <div key={gap}>{gap}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PlatformPanel>

      <PlatformPanel title="Backend Route Status" description="Backend maturity often exceeds what the UI reveals. This section shows which route modules are ahead of their frontend surfaces.">
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {architectureReview.backendModules.map((item) => (
            <div key={item.module} className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="text-lg font-semibold text-white">{item.module}</div>
                <StatusPill status={statusLabel(item.status)} />
              </div>
              <div className="mt-3 text-sm text-accent/72">{item.note}</div>
              <div className="mt-4 text-xs uppercase tracking-[0.2em] text-accent/45">Connected pages</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {item.pages.map((entry) => (
                  <span key={entry} className="rounded-full border border-white/10 bg-black/10 px-3 py-2 text-xs text-accent/75">{entry}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PlatformPanel>

      <PlatformPanel title="Recommended Information Architecture" description="If you want the frontend and backend to feel like the same system, this is the split that best matches the implemented backend model.">
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {architectureReview.recommendedInformationArchitecture.map((item) => (
            <div key={item.workspace} className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="text-xl font-semibold text-white">{item.workspace}</div>
              <div className="mt-3 text-sm text-accent/72">{item.scope}</div>
            </div>
          ))}
        </div>
      </PlatformPanel>
    </PlatformShell>
  );
}