import { useEffect, useState } from 'react';

import PlatformShell, { EmptyState, PlatformPanel, StatusPill } from '../components/PlatformShell';
import { extractItems, formatCurrency, toErrorMessage } from '../lib/platform';
import {
  createComment,
  createGovernancePolicy,
  createReview,
  getTenantCosts,
  listAuditLog,
  listComments,
  listGovernancePolicies,
  listQuotas,
  listReviews,
  resolveReview,
  upsertQuota,
} from '../services/api';

function parseJsonInput(value, fallback = {}) {
  if (!value.trim()) {
    return fallback;
  }
  return JSON.parse(value);
}

export default function GovernancePage() {
  const [policies, setPolicies] = useState([]);
  const [quotas, setQuotas] = useState([]);
  const [costSummary, setCostSummary] = useState({ total_cost: 0, by_service: {}, records: [] });
  const [auditLog, setAuditLog] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [comments, setComments] = useState([]);
  const [feedback, setFeedback] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [forms, setForms] = useState({
    policyName: '',
    policyEnforcement: 'advisory',
    policyRule: '{"residency": "eu", "allow_connectors": ["s3", "snowflake"]}',
    quotaType: 'deployments',
    quotaLimit: '25',
    quotaUnit: 'runs/month',
    commentResourceType: 'project',
    commentResourceId: '',
    commentText: '',
    reviewResourceType: 'scenario',
    reviewResourceId: '',
    reviewAssignedTo: 'lead@nexora.local',
    reviewComment: 'Validate the promoted output before release',
  });

  async function loadGovernance() {
    try {
      const [policyPayload, quotaPayload, costPayload, auditPayload, reviewPayload] = await Promise.all([
        listGovernancePolicies(),
        listQuotas(),
        getTenantCosts(),
        listAuditLog(),
        listReviews(),
      ]);
      setPolicies(extractItems(policyPayload));
      setQuotas(extractItems(quotaPayload));
      setCostSummary(costPayload || { total_cost: 0, by_service: {}, records: [] });
      setAuditLog(extractItems(auditPayload));
      setReviews(extractItems(reviewPayload));
      setFeedback('');
    } catch (error) {
      setFeedback(toErrorMessage(error));
    }
  }

  async function loadComments() {
    if (!forms.commentResourceId) {
      setComments([]);
      return;
    }
    try {
      const payload = await listComments(forms.commentResourceType, forms.commentResourceId);
      setComments(extractItems(payload));
    } catch (error) {
      setFeedback(toErrorMessage(error));
    }
  }

  useEffect(() => {
    loadGovernance();
  }, []);

  useEffect(() => {
    loadComments();
  }, [forms.commentResourceType, forms.commentResourceId]);

  return (
    <PlatformShell
      title="Governance, FinOps, and review loops"
      description="Keep controls separate from asset creation: policies, quotas, comments, reviews, and audit history all live here."
      actions={feedback ? <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-accent/75">{feedback}</div> : null}
    >
      <PlatformPanel title="Policies and quotas" description="These controls shape how the control plane behaves without mixing them into the operational pages.">
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <div className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="text-lg font-semibold text-white">Create policy</div>
            <input
              value={forms.policyName}
              onChange={(event) => setForms((current) => ({ ...current, policyName: event.target.value }))}
              placeholder="EU residency"
              className="w-full rounded-2xl border border-white/10 bg-background/70 px-4 py-3 text-white outline-none"
            />
            <select
              value={forms.policyEnforcement}
              onChange={(event) => setForms((current) => ({ ...current, policyEnforcement: event.target.value }))}
              className="w-full rounded-2xl border border-white/10 bg-background/70 px-4 py-3 text-white outline-none"
            >
              <option value="advisory">Advisory</option>
              <option value="enforced">Enforced</option>
            </select>
            <textarea
              rows={4}
              value={forms.policyRule}
              onChange={(event) => setForms((current) => ({ ...current, policyRule: event.target.value }))}
              className="w-full rounded-2xl border border-white/10 bg-background/70 px-4 py-3 font-mono text-sm text-white outline-none"
            />
            <button
              onClick={async () => {
                setBusyKey('policy');
                try {
                  await createGovernancePolicy({
                    name: forms.policyName,
                    enforcement: forms.policyEnforcement,
                    rule: parseJsonInput(forms.policyRule),
                  });
                  setForms((current) => ({ ...current, policyName: '' }));
                  setFeedback('Governance policy created.');
                  await loadGovernance();
                } catch (error) {
                  setFeedback(toErrorMessage(error));
                } finally {
                  setBusyKey('');
                }
              }}
              disabled={busyKey === 'policy' || !forms.policyName.trim()}
              className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busyKey === 'policy' ? 'Creating...' : 'Create policy'}
            </button>
          </div>

          <div className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="text-lg font-semibold text-white">Upsert quota</div>
            <div className="grid gap-4 md:grid-cols-3">
              <input
                value={forms.quotaType}
                onChange={(event) => setForms((current) => ({ ...current, quotaType: event.target.value }))}
                className="rounded-2xl border border-white/10 bg-background/70 px-4 py-3 text-white outline-none"
              />
              <input
                value={forms.quotaLimit}
                onChange={(event) => setForms((current) => ({ ...current, quotaLimit: event.target.value }))}
                className="rounded-2xl border border-white/10 bg-background/70 px-4 py-3 text-white outline-none"
              />
              <input
                value={forms.quotaUnit}
                onChange={(event) => setForms((current) => ({ ...current, quotaUnit: event.target.value }))}
                className="rounded-2xl border border-white/10 bg-background/70 px-4 py-3 text-white outline-none"
              />
            </div>
            <button
              onClick={async () => {
                setBusyKey('quota');
                try {
                  await upsertQuota({
                    resource_type: forms.quotaType,
                    limit_value: Number(forms.quotaLimit || 0),
                    unit: forms.quotaUnit,
                  });
                  setFeedback('Quota updated.');
                  await loadGovernance();
                } catch (error) {
                  setFeedback(toErrorMessage(error));
                } finally {
                  setBusyKey('');
                }
              }}
              disabled={busyKey === 'quota'}
              className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busyKey === 'quota' ? 'Updating...' : 'Upsert quota'}
            </button>

            <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
              <div className="text-sm text-accent/60">Current tenant cost</div>
              <div className="mt-2 text-3xl font-semibold text-white">{formatCurrency(costSummary.total_cost)}</div>
              <div className="mt-3 space-y-2 text-sm text-accent/68">
                {Object.entries(costSummary.by_service || {}).map(([service, amount]) => (
                  <div key={service} className="flex items-center justify-between gap-3">
                    <span>{service}</span>
                    <span>{formatCurrency(amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </PlatformPanel>

      <PlatformPanel title="Comments and reviews" description="Collaboration has its own page now so review traffic stays visible without crowding project and catalog workflows.">
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <div className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="text-lg font-semibold text-white">Comment thread</div>
            <div className="grid gap-4 md:grid-cols-2">
              <select
                value={forms.commentResourceType}
                onChange={(event) => setForms((current) => ({ ...current, commentResourceType: event.target.value }))}
                className="rounded-2xl border border-white/10 bg-background/70 px-4 py-3 text-white outline-none"
              >
                <option value="project">Project</option>
                <option value="dataset">Dataset</option>
                <option value="scenario">Scenario</option>
              </select>
              <input
                value={forms.commentResourceId}
                onChange={(event) => setForms((current) => ({ ...current, commentResourceId: event.target.value }))}
                placeholder="resource-id"
                className="rounded-2xl border border-white/10 bg-background/70 px-4 py-3 text-white outline-none"
              />
            </div>
            <textarea
              rows={3}
              value={forms.commentText}
              onChange={(event) => setForms((current) => ({ ...current, commentText: event.target.value }))}
              placeholder="Need lineage review before promotion"
              className="w-full rounded-2xl border border-white/10 bg-background/70 px-4 py-3 text-white outline-none"
            />
            <button
              onClick={async () => {
                setBusyKey('comment');
                try {
                  await createComment({
                    resource_type: forms.commentResourceType,
                    resource_id: forms.commentResourceId,
                    text: forms.commentText,
                  });
                  setForms((current) => ({ ...current, commentText: '' }));
                  setFeedback('Comment created.');
                  await loadComments();
                  await loadGovernance();
                } catch (error) {
                  setFeedback(toErrorMessage(error));
                } finally {
                  setBusyKey('');
                }
              }}
              disabled={busyKey === 'comment' || !forms.commentResourceId || !forms.commentText.trim()}
              className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busyKey === 'comment' ? 'Posting...' : 'Post comment'}
            </button>

            <div className="space-y-3">
              {comments.length ? (
                comments.map((comment) => (
                  <div key={comment.id} className="rounded-2xl border border-white/10 bg-black/10 p-4">
                    <div className="text-sm text-white">{comment.text}</div>
                    <div className="mt-2 text-xs text-accent/55">{comment.user_id} · {comment.created_at}</div>
                  </div>
                ))
              ) : (
                <EmptyState message="No comments for the selected resource yet." />
              )}
            </div>
          </div>

          <div className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="text-lg font-semibold text-white">Review requests</div>
            <div className="grid gap-4 md:grid-cols-2">
              <select
                value={forms.reviewResourceType}
                onChange={(event) => setForms((current) => ({ ...current, reviewResourceType: event.target.value }))}
                className="rounded-2xl border border-white/10 bg-background/70 px-4 py-3 text-white outline-none"
              >
                <option value="scenario">Scenario</option>
                <option value="dataset">Dataset</option>
                <option value="pipeline">Pipeline</option>
              </select>
              <input
                value={forms.reviewResourceId}
                onChange={(event) => setForms((current) => ({ ...current, reviewResourceId: event.target.value }))}
                placeholder="resource-id"
                className="rounded-2xl border border-white/10 bg-background/70 px-4 py-3 text-white outline-none"
              />
            </div>
            <input
              value={forms.reviewAssignedTo}
              onChange={(event) => setForms((current) => ({ ...current, reviewAssignedTo: event.target.value }))}
              className="w-full rounded-2xl border border-white/10 bg-background/70 px-4 py-3 text-white outline-none"
            />
            <textarea
              rows={3}
              value={forms.reviewComment}
              onChange={(event) => setForms((current) => ({ ...current, reviewComment: event.target.value }))}
              className="w-full rounded-2xl border border-white/10 bg-background/70 px-4 py-3 text-white outline-none"
            />
            <button
              onClick={async () => {
                setBusyKey('review');
                try {
                  await createReview({
                    resource_type: forms.reviewResourceType,
                    resource_id: forms.reviewResourceId,
                    assigned_to: forms.reviewAssignedTo,
                    comments: [forms.reviewComment],
                  });
                  setFeedback('Review request created.');
                  await loadGovernance();
                } catch (error) {
                  setFeedback(toErrorMessage(error));
                } finally {
                  setBusyKey('');
                }
              }}
              disabled={busyKey === 'review' || !forms.reviewResourceId}
              className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-5 py-3 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-300/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busyKey === 'review' ? 'Creating...' : 'Create review'}
            </button>

            <div className="space-y-3">
              {reviews.length ? (
                reviews.map((review) => (
                  <div key={review.id} className="rounded-2xl border border-white/10 bg-black/10 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm text-white">{review.resource_type} · {review.resource_id}</div>
                      <StatusPill status={review.status} />
                    </div>
                    <div className="mt-2 text-xs text-accent/55">Assigned to {review.assigned_to || 'unassigned'}</div>
                    {review.status !== 'resolved' ? (
                      <button
                        onClick={async () => {
                          setBusyKey(review.id);
                          try {
                            await resolveReview(review.id, { status: 'resolved', comment: 'Resolved from governance workspace' });
                            await loadGovernance();
                          } catch (error) {
                            setFeedback(toErrorMessage(error));
                          } finally {
                            setBusyKey('');
                          }
                        }}
                        disabled={busyKey === review.id}
                        className="mt-3 rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {busyKey === review.id ? 'Resolving...' : 'Resolve'}
                      </button>
                    ) : null}
                  </div>
                ))
              ) : (
                <EmptyState message="No review requests yet." />
              )}
            </div>
          </div>
        </div>
      </PlatformPanel>

      <PlatformPanel title="Audit and cost visibility" description="Use the audit stream as the authoritative record of control-plane mutations.">
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="text-lg font-semibold text-white">Policies and quotas</div>
            <div className="mt-4 space-y-3">
              {policies.length ? (
                policies.map((policy) => (
                  <div key={policy.id} className="rounded-2xl border border-white/10 bg-black/10 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm text-white">{policy.name}</div>
                      <StatusPill status={policy.enforcement} />
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState message="No governance policies yet." />
              )}
              {quotas.map((quota) => (
                <div key={quota.id} className="rounded-2xl border border-white/10 bg-black/10 p-4 text-sm text-accent/70">
                  {quota.resource_type}: {quota.limit_value} {quota.unit || ''}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="text-lg font-semibold text-white">Audit log</div>
            <div className="mt-4 space-y-3">
              {auditLog.length ? (
                auditLog.slice(0, 12).map((entry) => (
                  <div key={entry.id} className="rounded-2xl border border-white/10 bg-black/10 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm text-white">{entry.action} {entry.resource_type}</div>
                      <div className="text-xs text-accent/45">{entry.timestamp}</div>
                    </div>
                    <div className="mt-2 text-xs text-accent/55">{entry.user_id || 'system'} · {entry.resource_id || 'n/a'}</div>
                  </div>
                ))
              ) : (
                <EmptyState message="No audit events yet." />
              )}
            </div>
          </div>
        </div>
      </PlatformPanel>
    </PlatformShell>
  );
}