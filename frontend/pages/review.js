import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';

import PlatformShell, { EmptyState, MetricTile, PlatformPanel } from '../components/PlatformShell';
import ReviewPanel from '../components/ReviewPanel';
import WorkflowGuide from '../components/WorkflowGuide';
import { createShadowRun, getShadowRun, listShadowRuns } from '../services/api';

export default function ReviewPage() {
  const router = useRouter();
  const [shadows, setShadows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [selected, setSelected] = useState(null);
  const requestedShadowId = Array.isArray(router.query.shadow) ? router.query.shadow[0] : router.query.shadow || '';

  async function load(preferredShadowId = requestedShadowId) {
    setLoading(true);
    setError('');
    try {
      const response = await listShadowRuns('manual_review');
      let items = response.items || [];
      let preferredShadow = null;

      if (preferredShadowId) {
        try {
          preferredShadow = await getShadowRun(preferredShadowId);
        } catch {
          preferredShadow = null;
        }
      }

      if (preferredShadow && !items.some((item) => item.id === preferredShadow.id)) {
        items = [preferredShadow, ...items];
      }

      setShadows(items);
      setSelected((current) => {
        if (preferredShadow) {
          return preferredShadow;
        }
        if (!items.length) {
          return null;
        }
        if (current && items.some((item) => item.id === current.id)) {
          return items.find((item) => item.id === current.id) || current;
        }
        return items[0];
      });
    } catch (err) {
      setError(err.message || 'Failed to load shadow runs.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!router.isReady) {
      return;
    }
    load(requestedShadowId);
  }, [requestedShadowId, router.isReady]);

  const seedDemo = async () => {
    try {
      setLoading(true);
      setError('');
      const created = await createShadowRun('PROC SQL; SELECT id, name FROM customers; quit;', 'code', 0.99);
      if (created?.shadow_id) {
        await router.replace(
          {
            pathname: '/review',
            query: {
              ...router.query,
              shadow: created.shadow_id,
            },
          },
          undefined,
          { shallow: true },
        );
      }
      setFeedback('Seeded a demo shadow run for review.');
      await load(created?.shadow_id || requestedShadowId);
    } catch (err) {
      setError(err.message || 'Failed to seed a demo shadow run.');
    } finally {
      setLoading(false);
    }
  };

  const openShadow = async (id) => {
    setError('');
    try {
      const shadowRun = await getShadowRun(id);
      setSelected(shadowRun);
      if (router.isReady) {
        void router.replace(
          {
            pathname: '/review',
            query: {
              ...router.query,
              shadow: id,
            },
          },
          undefined,
          { shallow: true },
        );
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch the selected shadow run.');
    }
  };

  const handleReviewed = async () => {
    setFeedback('Review decision recorded.');
    await load(requestedShadowId);
  };

  const highConfidenceCount = useMemo(() => shadows.filter((shadow) => Number(shadow.confidence) >= 0.8).length, [shadows]);
  const lowConfidenceCount = useMemo(() => shadows.filter((shadow) => Number(shadow.confidence) < 0.6).length, [shadows]);
  const reviewGuideSteps = [
    {
      key: 'migration',
      label: 'Migration',
      description: 'Generate converted candidates that still need human sign-off.',
      state: shadows.length ? 'complete' : 'next',
      value: shadows.length ? `${shadows.length} candidates queued` : 'No pending candidates yet',
      href: '/compare',
    },
    {
      key: 'shadow-review',
      label: 'Shadow Review',
      description: 'Inspect diffs, confidence, and reviewer comments before promotion.',
      state: 'current',
      value: `${shadows.length} pending reviews`,
      href: '/review',
    },
    {
      key: 'governance',
      label: 'Governance',
      description: 'Escalate tracked approvals into the governed review desk when needed.',
      state: selected ? 'next' : 'upcoming',
      value: 'Escalate higher-risk approvals',
      href: '/governance/reviews',
    },
    {
      key: 'runtime',
      label: 'Runtime',
      description: 'Return approved work to execution and operational validation.',
      state: 'upcoming',
      value: 'Inspect promoted runs and jobs',
      href: '/runtime',
    },
  ];

  return (
    <PlatformShell
      eyebrow="Shadow Review"
      title="Review AI-generated migration output before it moves into governed approval and runtime execution."
      description="This page is now part of the shared product shell instead of a detached admin screen. Reviewers can inspect confidence, compare code changes, and escalate into governance without losing the operating context."
      focus="global"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {feedback ? <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-slate-600">{feedback}</div> : null}
          <button
            onClick={seedDemo}
            disabled={loading}
            className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-700 transition hover:bg-sky-100 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Seed demo run'}
          </button>
        </div>
      }
    >
      <WorkflowGuide
        currentStep="shadow-review"
        steps={reviewGuideSteps}
        primaryAction={{ label: 'Open governance reviews', href: '/governance/reviews' }}
        secondaryAction={{ label: 'Open compare workspace', href: '/compare', tone: 'secondary' }}
        title="Keep migration review inside the main operating path"
        description="Shadow review should be an explicit checkpoint between conversion output and governed promotion. The user should always know whether to inspect code, escalate the decision, or continue toward runtime validation."
      />

      {error ? (
        <PlatformPanel title="Review status" description="Current issue while loading or opening shadow-review evidence.">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        </PlatformPanel>
      ) : null}

      <PlatformPanel title="Review queue snapshot" description="Use confidence and selection state to triage the next review decision quickly.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricTile label="Pending" value={shadows.length} detail="Shadow runs waiting on reviewer action." />
          <MetricTile label="High Confidence" value={highConfidenceCount} detail="Candidates likely ready for quick approval." />
          <MetricTile label="Needs Attention" value={lowConfidenceCount} detail="Lower-confidence runs that likely need deeper review." />
          <MetricTile label="Selected" value={selected ? selected.id.slice(0, 8).toUpperCase() : 'none'} detail="The currently inspected shadow run." />
        </div>
      </PlatformPanel>

      <PlatformPanel title="Human review workspace" description="The review list and the diff inspection panel now sit inside one consistent workbench. Open a shadow run, inspect the code delta, then approve, reject, or request a fix.">
        {loading ? (
          <EmptyState
            title="Loading shadow review queue"
            message="The review workspace is refreshing candidate conversions."
            detail="If the queue stays empty after load, seed a demo run or route new conversion work from the compare workspace."
          />
        ) : (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
            <div className="rounded-[28px] border border-stone-200/80 bg-white/82 p-5 shadow-[0_18px_44px_rgba(148,163,184,0.12)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.3em] text-stone-500">Pending reviews</div>
                  <div className="mt-2 text-xl font-semibold tracking-tight text-slate-900">{shadows.length} shadow runs</div>
                </div>
                <div className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-amber-700">Review queue</div>
              </div>

              <div className="mt-4 max-h-[38rem] space-y-3 overflow-y-auto pr-1">
                {shadows.length ? (
                  shadows.map((shadow) => (
                    <button
                      key={shadow.id}
                      onClick={() => openShadow(shadow.id)}
                      className={`w-full rounded-[24px] border p-4 text-left transition ${
                        selected?.id === shadow.id
                          ? 'border-sky-200 bg-sky-50 shadow-[0_14px_30px_rgba(125,211,252,0.18)]'
                          : 'border-stone-200 bg-stone-50/80 hover:border-stone-300 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-sm font-semibold text-slate-900">{shadow.id.slice(0, 8).toUpperCase()}</div>
                        <div className="text-[11px] text-stone-500">{new Date(shadow.created_at).toLocaleString()}</div>
                      </div>
                      <div className="mt-3 inline-flex rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                        Confidence {Number(shadow.confidence).toFixed(3)}
                      </div>
                      <div className="mt-3 text-sm leading-6 text-slate-600">{(shadow.input_blob || '').slice(0, 120) || 'No source preview available.'}</div>
                    </button>
                  ))
                ) : (
                  <EmptyState
                    title="No pending shadow reviews"
                    message="There are no conversion candidates waiting for manual approval."
                    detail="Seed a demo run here or generate fresh output from the compare workspace to repopulate the queue."
                    actions={
                      <>
                        <button
                          onClick={seedDemo}
                          className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-700 transition hover:bg-sky-100"
                        >
                          Seed demo run
                        </button>
                        <a href="/compare" className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-stone-50">
                          Open compare workspace
                        </a>
                      </>
                    }
                  />
                )}
              </div>
            </div>

            <div className="lg:col-span-3">
              {selected ? (
                <ReviewPanel shadow={selected} onReviewed={handleReviewed} />
              ) : (
                <EmptyState
                  title="Select a shadow run"
                  message="Choose an item from the queue to inspect its diff and record a review decision."
                  detail="The right panel will show the original input, converted output, confidence, and reviewer comment controls once a shadow run is selected."
                />
              )}
            </div>
          </div>
        )}
      </PlatformPanel>
    </PlatformShell>
  );
}
