import { useEffect, useState } from 'react';

import GovernanceDeskNav from '../../components/GovernanceDeskNav';
import PlatformShell, { EmptyState, MetricTile, PlatformPanel, StatusPill } from '../../components/PlatformShell';
import WorkflowGuide from '../../components/WorkflowGuide';
import { extractItems, toErrorMessage } from '../../lib/platform';
import {
  createComment,
  createReview,
  listAuditLog,
  listComments,
  listReviews,
  resolveReview,
} from '../../services/api';

export default function GovernanceReviewsPage() {
  const [reviews, setReviews] = useState([]);
  const [comments, setComments] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [feedback, setFeedback] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [form, setForm] = useState({
    reviewResourceType: 'pipeline',
    reviewResourceId: '',
    reviewAssignedTo: 'lead@nexora.local',
    reviewComment: 'Validate the promotion evidence before release.',
    commentResourceType: 'pipeline',
    commentResourceId: '',
    commentText: '',
  });

  async function loadReviewDesk() {
    try {
      const [reviewPayload, auditPayload] = await Promise.all([listReviews(), listAuditLog('review_request')]);
      setReviews(extractItems(reviewPayload));
      setAuditLog(extractItems(auditPayload));
    } catch (error) {
      setFeedback(toErrorMessage(error));
    }
  }

  async function loadCommentsForResource(resourceType, resourceId) {
    if (!resourceId) {
      setComments([]);
      return;
    }
    try {
      const payload = await listComments(resourceType, resourceId);
      setComments(extractItems(payload));
    } catch (error) {
      setFeedback(toErrorMessage(error));
    }
  }

  useEffect(() => {
    loadReviewDesk();
  }, []);

  useEffect(() => {
    loadCommentsForResource(form.commentResourceType, form.commentResourceId);
  }, [form.commentResourceId, form.commentResourceType]);

  const reviewGuideSteps = [
    {
      key: 'request',
      label: 'Request',
      description: 'Create explicit approval work for pipelines, datasets, scenarios, or deployments.',
      state: reviews.length ? 'complete' : 'next',
      value: `${reviews.length} open reviews`,
      href: '/governance/reviews',
    },
    {
      key: 'governance',
      label: 'Governance',
      description: 'Review, comment, and resolve approval work with the governance team.',
      state: 'current',
      value: `${comments.length} comments loaded`,
      href: '/governance/reviews',
    },
    {
      key: 'audit',
      label: 'Audit',
      description: 'Keep every approval action tied to a visible audit stream.',
      state: auditLog.length ? 'complete' : 'next',
      value: `${auditLog.length} audit events`,
      href: '/governance/reviews',
    },
    {
      key: 'runtime',
      label: 'Runtime',
      description: 'Send resolved work back to the operator console or the project workbench.',
      state: reviews.length ? 'next' : 'upcoming',
      value: 'Return to execution or rollout work',
      href: '/runtime',
    },
  ];

  return (
    <PlatformShell
      eyebrow="Governance Reviews"
      title="Handle review requests, comment threads, and audit-linked approval work from one dedicated governance surface."
      description="Review traffic is now separated from policies and spend so approvals, comments, and resolution state have a clear home in Governance Desk."
      focus="global"
      aside={<GovernanceDeskNav />}
      actions={feedback ? <div className="rounded-2xl border border-stone-200 bg-white/80 px-4 py-3 text-sm text-slate-600">{feedback}</div> : null}
    >
      <WorkflowGuide
        currentStep="governance"
        steps={reviewGuideSteps}
        primaryAction={{ label: 'Open Runtime Ops', href: '/runtime' }}
        secondaryAction={{ label: 'Open policies desk', href: '/governance/policies', tone: 'secondary' }}
        title="Keep approvals, discussion, and audit evidence inside one governed path"
        description="Governance review should behave like a controlled checkpoint, not an isolated backlog. This surface now shows the approval flow from request creation through audit evidence and back into operational execution."
      />

      <PlatformPanel title="Review desk snapshot" description="The queue, live comment thread, and audit evidence remain visible before the user dives into any single review item.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricTile label="Open Reviews" value={reviews.length} detail="Approval requests still waiting on governance resolution." />
          <MetricTile label="Comments" value={comments.length} detail="Discussion currently loaded for the selected resource context." />
          <MetricTile label="Audit Events" value={auditLog.length} detail="Review-related evidence emitted into the audit stream." />
          <MetricTile label="Active Context" value={form.commentResourceId || 'none'} detail="The resource id currently loaded for review discussion." />
        </div>
      </PlatformPanel>

      <PlatformPanel title="Review queue" description="Create and resolve approval work without reopening the retired mixed governance page.">
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-4 rounded-3xl border border-stone-200/80 bg-white/82 p-5 shadow-[0_18px_44px_rgba(148,163,184,0.12)]">
            <div className="text-lg font-semibold text-slate-900">Create review request</div>
            <div className="grid gap-4 md:grid-cols-2">
              <select
                value={form.reviewResourceType}
                onChange={(event) => setForm((current) => ({ ...current, reviewResourceType: event.target.value }))}
                className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-slate-700 outline-none"
              >
                <option value="pipeline">Pipeline</option>
                <option value="dataset">Dataset</option>
                <option value="scenario">Scenario</option>
                <option value="deployment">Deployment</option>
              </select>
              <input
                value={form.reviewResourceId}
                onChange={(event) => setForm((current) => ({ ...current, reviewResourceId: event.target.value }))}
                placeholder="resource-id"
                className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-slate-700 outline-none"
              />
            </div>
            <input
              value={form.reviewAssignedTo}
              onChange={(event) => setForm((current) => ({ ...current, reviewAssignedTo: event.target.value }))}
              className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-slate-700 outline-none"
            />
            <textarea
              rows={3}
              value={form.reviewComment}
              onChange={(event) => setForm((current) => ({ ...current, reviewComment: event.target.value }))}
              className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-slate-700 outline-none"
            />
            <button
              onClick={async () => {
                setBusyKey('review');
                try {
                  await createReview({
                    resource_type: form.reviewResourceType,
                    resource_id: form.reviewResourceId,
                    assigned_to: form.reviewAssignedTo,
                    comments: [form.reviewComment],
                  });
                  setFeedback('Created a governance review request.');
                  setForm((current) => ({
                    ...current,
                    reviewResourceId: '',
                    commentResourceType: current.reviewResourceType,
                    commentResourceId: current.reviewResourceId,
                  }));
                  await loadReviewDesk();
                  await loadCommentsForResource(form.reviewResourceType, form.reviewResourceId);
                } catch (error) {
                  setFeedback(toErrorMessage(error));
                } finally {
                  setBusyKey('');
                }
              }}
              disabled={busyKey === 'review' || !form.reviewResourceId.trim()}
              className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:opacity-50"
            >
              {busyKey === 'review' ? 'Creating...' : 'Create review'}
            </button>
          </div>

          <div className="space-y-3 rounded-3xl border border-stone-200/80 bg-white/82 p-5 shadow-[0_18px_44px_rgba(148,163,184,0.12)]">
            <div className="text-lg font-semibold text-slate-900">Open requests</div>
            {reviews.length ? (
              reviews.map((review) => (
                <div key={review.id} className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{review.resource_type} · {review.resource_id}</div>
                      <div className="mt-1 text-xs text-slate-500">Assigned to {review.assigned_to || 'unassigned'}</div>
                    </div>
                    <StatusPill status={review.status} />
                  </div>
                  {review.status !== 'resolved' ? (
                    <button
                      onClick={async () => {
                        setBusyKey(review.id);
                        try {
                          await resolveReview(review.id, { status: 'resolved', comment: 'Resolved from Governance Reviews.' });
                          setFeedback('Resolved the selected review request.');
                          await loadReviewDesk();
                        } catch (error) {
                          setFeedback(toErrorMessage(error));
                        } finally {
                          setBusyKey('');
                        }
                      }}
                      disabled={busyKey === review.id}
                      className="mt-3 rounded-2xl border border-stone-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-stone-50 disabled:opacity-50"
                    >
                      {busyKey === review.id ? 'Resolving...' : 'Resolve'}
                    </button>
                  ) : null}
                </div>
              ))
            ) : (
              <EmptyState
                title="No review requests are open"
                message="There is nothing waiting on governance resolution right now."
                detail="Create a request from the left panel whenever a pipeline, dataset, scenario, or deployment needs explicit approval evidence."
              />
            )}
          </div>
        </div>
      </PlatformPanel>

      <PlatformPanel title="Comments and audit evidence" description="Review discussions and audit evidence stay close to the approval flow instead of living inside a mixed governance page.">
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-4 rounded-3xl border border-stone-200/80 bg-white/82 p-5 shadow-[0_18px_44px_rgba(148,163,184,0.12)]">
            <div className="text-lg font-semibold text-slate-900">Comment thread</div>
            <div className="grid gap-4 md:grid-cols-2">
              <select
                value={form.commentResourceType}
                onChange={(event) => setForm((current) => ({ ...current, commentResourceType: event.target.value }))}
                className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-slate-700 outline-none"
              >
                <option value="pipeline">Pipeline</option>
                <option value="dataset">Dataset</option>
                <option value="deployment">Deployment</option>
                <option value="scenario">Scenario</option>
              </select>
              <input
                value={form.commentResourceId}
                onChange={(event) => setForm((current) => ({ ...current, commentResourceId: event.target.value }))}
                placeholder="resource-id"
                className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-slate-700 outline-none"
              />
            </div>
            <textarea
              rows={3}
              value={form.commentText}
              onChange={(event) => setForm((current) => ({ ...current, commentText: event.target.value }))}
              placeholder="Capture approval evidence or escalation context"
              className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-slate-700 outline-none"
            />
            <button
              onClick={async () => {
                setBusyKey('comment');
                try {
                  await createComment({
                    resource_type: form.commentResourceType,
                    resource_id: form.commentResourceId,
                    text: form.commentText,
                  });
                  setFeedback('Added a governance comment.');
                  setForm((current) => ({ ...current, commentText: '' }));
                  await loadCommentsForResource(form.commentResourceType, form.commentResourceId);
                  await loadReviewDesk();
                } catch (error) {
                  setFeedback(toErrorMessage(error));
                } finally {
                  setBusyKey('');
                }
              }}
              disabled={busyKey === 'comment' || !form.commentResourceId.trim() || !form.commentText.trim()}
              className="rounded-2xl border border-stone-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-stone-50 disabled:opacity-50"
            >
              {busyKey === 'comment' ? 'Posting...' : 'Post comment'}
            </button>

            <div className="space-y-3">
              {comments.length ? (
                comments.map((comment) => (
                  <div key={comment.id} className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4 text-sm text-slate-600">
                    <div className="text-slate-900">{comment.text}</div>
                    <div className="mt-2 text-xs text-slate-500">{comment.user_id} · {comment.created_at}</div>
                  </div>
                ))
              ) : (
                <EmptyState
                  title="No comment thread loaded"
                  message="Select a resource id to load discussion and evidence for that approval context."
                  detail="Comments remain scoped to the current resource type and id so governance conversations do not get mixed together."
                />
              )}
            </div>
          </div>

          <div className="space-y-3 rounded-3xl border border-stone-200/80 bg-white/82 p-5 shadow-[0_18px_44px_rgba(148,163,184,0.12)]">
            <div className="text-lg font-semibold text-slate-900">Review audit stream</div>
            {auditLog.length ? (
              auditLog.slice(0, 10).map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4 text-sm text-slate-600">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-slate-900">{entry.action} {entry.resource_type}</div>
                    <div className="text-xs text-stone-500">{entry.timestamp}</div>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">{entry.user_id || 'system'} · {entry.resource_id || 'n/a'}</div>
                </div>
              ))
            ) : (
              <EmptyState
                title="No review audit events yet"
                message="The audit stream is waiting for the next review-related mutation."
                detail="Once requests are created, commented, or resolved, the evidence trail appears here automatically."
              />
            )}
          </div>
        </div>
      </PlatformPanel>
    </PlatformShell>
  );
}