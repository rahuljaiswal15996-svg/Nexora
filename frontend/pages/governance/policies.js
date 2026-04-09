import Link from 'next/link';
import { useEffect, useState } from 'react';

import GovernanceDeskNav from '../../components/GovernanceDeskNav';
import PlatformShell, { EmptyState, MetricTile, PlatformPanel, StatusPill } from '../../components/PlatformShell';
import WorkflowGuide from '../../components/WorkflowGuide';
import { extractItems, toErrorMessage } from '../../lib/platform';
import { createGovernancePolicy, listGovernancePolicies, listQuotas, upsertQuota } from '../../services/api';

function parseJsonInput(value, fallback = {}) {
  if (!value.trim()) {
    return fallback;
  }
  return JSON.parse(value);
}

export default function GovernancePoliciesPage() {
  const [policies, setPolicies] = useState([]);
  const [quotas, setQuotas] = useState([]);
  const [feedback, setFeedback] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [form, setForm] = useState({
    policyName: '',
    enforcement: 'advisory',
    rule: '{"residency": "eu", "allow_connectors": ["s3", "snowflake"]}',
    quotaType: 'deployments',
    quotaLimit: '25',
    quotaUnit: 'runs/month',
  });

  async function loadGovernance() {
    try {
      const [policyPayload, quotaPayload] = await Promise.all([
        listGovernancePolicies(),
        listQuotas(),
      ]);
      setPolicies(extractItems(policyPayload));
      setQuotas(extractItems(quotaPayload));
    } catch (error) {
      setFeedback(toErrorMessage(error));
    }
  }

  useEffect(() => {
    loadGovernance();
  }, []);

  const enforcedCount = policies.filter((policy) => policy.enforcement === 'enforced').length;
  const advisoryCount = policies.filter((policy) => policy.enforcement !== 'enforced').length;
  const policyGuideSteps = [
    {
      key: 'policies',
      label: 'Policies',
      description: 'Set residency, connector, and control rules for the tenant.',
      state: 'current',
      value: `${policies.length} active policy records`,
      href: '/governance/policies',
    },
    {
      key: 'finops',
      label: 'FinOps',
      description: 'Keep spend controls and quota evidence adjacent to policy posture.',
      state: quotas.length ? 'complete' : 'next',
      value: `${quotas.length} quota records`,
      href: '/governance/finops',
    },
    {
      key: 'reviews',
      label: 'Reviews',
      description: 'Escalate policy-sensitive execution or rollout work into governed review.',
      state: policies.length ? 'next' : 'upcoming',
      value: 'Open governance review desk',
      href: '/governance/reviews',
    },
    {
      key: 'runtime',
      label: 'Runtime',
      description: 'Return governed work into the operator console after policy decisions are in place.',
      state: policies.length || quotas.length ? 'next' : 'upcoming',
      value: 'Resume operational execution',
      href: '/runtime',
    },
  ];

  return (
    <PlatformShell
      eyebrow="Governance Policies"
      title="Define policy and quota controls without mixing governance into project execution surfaces."
      description="Governance Desk is now split into focused workspaces. This page owns policy rules and quota posture, while FinOps and Reviews stay on their own surfaces."
      focus="global"
      aside={<GovernanceDeskNav />}
      actions={feedback ? <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-accent/75">{feedback}</div> : null}
    >
      <WorkflowGuide
        currentStep="policies"
        steps={policyGuideSteps}
        primaryAction={{ label: 'Open FinOps', href: '/governance/finops' }}
        secondaryAction={{ label: 'Open Reviews', href: '/governance/reviews', tone: 'secondary' }}
        title="Keep governance policy, quota, and review work on one explicit desk path"
        description="Policies define the guardrails, FinOps validates spend posture, and the review desk handles the explicit approval work that follows from those controls."
      />

      <PlatformPanel title="Policy snapshot" description="See the current rule and quota posture before editing any single control.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricTile label="Policies" value={policies.length} detail="Registered governance policies for this tenant." />
          <MetricTile label="Enforced" value={enforcedCount} detail="Policies currently running in enforced mode." />
          <MetricTile label="Advisory" value={advisoryCount} detail="Policies that are visible but not yet blocking execution." />
          <MetricTile label="Quotas" value={quotas.length} detail="Quota rules tied to the same governance boundary." />
        </div>
      </PlatformPanel>

      <PlatformPanel title="Governance controls" description="Create tenant policies and update quotas in a single focused surface.">
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <div className="space-y-4 rounded-3xl border border-stone-200/80 bg-white/82 p-5 shadow-[0_18px_44px_rgba(148,163,184,0.12)]">
            <div className="text-lg font-semibold text-slate-900">Create policy</div>
            <input
              value={form.policyName}
              onChange={(event) => setForm((current) => ({ ...current, policyName: event.target.value }))}
              placeholder="EU residency"
              className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-slate-700 outline-none"
            />
            <select
              value={form.enforcement}
              onChange={(event) => setForm((current) => ({ ...current, enforcement: event.target.value }))}
              className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-slate-700 outline-none"
            >
              <option value="advisory">Advisory</option>
              <option value="enforced">Enforced</option>
            </select>
            <textarea
              rows={4}
              value={form.rule}
              onChange={(event) => setForm((current) => ({ ...current, rule: event.target.value }))}
              className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 font-mono text-sm text-slate-700 outline-none"
            />
            <button
              onClick={async () => {
                setBusyKey('policy');
                try {
                  await createGovernancePolicy({
                    name: form.policyName,
                    enforcement: form.enforcement,
                    rule: parseJsonInput(form.rule),
                  });
                  setFeedback('Governance policy created.');
                  setForm((current) => ({ ...current, policyName: '' }));
                  await loadGovernance();
                } catch (error) {
                  setFeedback(toErrorMessage(error));
                } finally {
                  setBusyKey('');
                }
              }}
              disabled={busyKey === 'policy' || !form.policyName.trim()}
              className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:opacity-50"
            >
              {busyKey === 'policy' ? 'Creating...' : 'Create policy'}
            </button>
          </div>

          <div className="space-y-4 rounded-3xl border border-stone-200/80 bg-white/82 p-5 shadow-[0_18px_44px_rgba(148,163,184,0.12)]">
            <div className="text-lg font-semibold text-slate-900">Quota posture</div>
            <div className="grid gap-4 md:grid-cols-3">
              <input
                value={form.quotaType}
                onChange={(event) => setForm((current) => ({ ...current, quotaType: event.target.value }))}
                className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-slate-700 outline-none"
              />
              <input
                value={form.quotaLimit}
                onChange={(event) => setForm((current) => ({ ...current, quotaLimit: event.target.value }))}
                className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-slate-700 outline-none"
              />
              <input
                value={form.quotaUnit}
                onChange={(event) => setForm((current) => ({ ...current, quotaUnit: event.target.value }))}
                className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-slate-700 outline-none"
              />
            </div>
            <button
              onClick={async () => {
                setBusyKey('quota');
                try {
                  await upsertQuota({
                    resource_type: form.quotaType,
                    limit_value: Number(form.quotaLimit || 0),
                    unit: form.quotaUnit,
                  });
                  setFeedback('Tenant quota updated.');
                  await loadGovernance();
                } catch (error) {
                  setFeedback(toErrorMessage(error));
                } finally {
                  setBusyKey('');
                }
              }}
              disabled={busyKey === 'quota'}
              className="rounded-2xl border border-sky-200 bg-sky-50 px-5 py-3 text-sm font-semibold text-sky-700 transition hover:bg-sky-100 disabled:opacity-50"
            >
              {busyKey === 'quota' ? 'Updating...' : 'Upsert quota'}
            </button>
            <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4 text-sm text-slate-600">
              <div className="text-stone-500">Desk boundary</div>
              <div className="mt-2 font-semibold text-slate-900">Policies and quotas stay here.</div>
              <div className="mt-3 leading-6">Spend analysis moves to FinOps, and collaboration traffic moves to Reviews so Governance no longer behaves like a mixed catch-all page.</div>
            </div>
          </div>
        </div>
      </PlatformPanel>

      <PlatformPanel title="Current controls" description="Review active policy and quota records without reopening the retired mixed page.">
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <div className="space-y-3 rounded-3xl border border-stone-200/80 bg-white/82 p-5 shadow-[0_18px_44px_rgba(148,163,184,0.12)]">
            {policies.length ? (
              policies.map((policy) => (
                <div key={policy.id} className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-900">{policy.name}</div>
                    <StatusPill status={policy.enforcement} />
                  </div>
                  <div className="mt-3 text-xs leading-5 text-slate-500">{JSON.stringify(policy.rule || {})}</div>
                </div>
              ))
            ) : (
              <EmptyState
                title="No governance policies yet"
                message="Create a policy to define residency, connector, or control posture for the tenant."
                detail="Policies created here become the explicit governance baseline before work reaches FinOps or review flows."
              />
            )}
          </div>

          <div className="space-y-3 rounded-3xl border border-stone-200/80 bg-white/82 p-5 shadow-[0_18px_44px_rgba(148,163,184,0.12)]">
            {quotas.length ? (
              quotas.map((quota) => (
                <div key={quota.id} className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4 text-sm text-slate-600">
                  <div className="font-semibold text-slate-900">{quota.resource_type}</div>
                  <div className="mt-2">{quota.limit_value} {quota.unit || ''}</div>
                </div>
              ))
            ) : (
              <EmptyState
                title="No quotas configured"
                message="Quota posture is empty for this tenant."
                detail="Use the left panel to add the first resource limit so policy and spend controls stay aligned."
              />
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/governance/finops" className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-stone-50">
            Open FinOps
          </Link>
          <Link href="/governance/reviews" className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-white">
            Open Reviews
          </Link>
        </div>
      </PlatformPanel>
    </PlatformShell>
  );
}