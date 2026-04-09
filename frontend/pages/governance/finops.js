import { useEffect, useState } from 'react';

import GovernanceDeskNav from '../../components/GovernanceDeskNav';
import PlatformShell, { EmptyState, MetricTile, PlatformPanel } from '../../components/PlatformShell';
import WorkflowGuide from '../../components/WorkflowGuide';
import { extractItems, formatCurrency, toErrorMessage } from '../../lib/platform';
import { getTenantCosts, listAuditLog, recordTenantCost } from '../../services/api';

export default function GovernanceFinOpsPage() {
  const [costSummary, setCostSummary] = useState({ total_cost: 0, by_service: {}, records: [] });
  const [auditLog, setAuditLog] = useState([]);
  const [feedback, setFeedback] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [form, setForm] = useState({
    period: 'current',
    serviceType: 'compute',
    quantity: '1',
    cost: '25',
  });

  async function loadFinOps() {
    try {
      const [costPayload, auditPayload] = await Promise.all([getTenantCosts(), listAuditLog('cost')]);
      setCostSummary(costPayload || { total_cost: 0, by_service: {}, records: [] });
      setAuditLog(extractItems(auditPayload));
    } catch (error) {
      setFeedback(toErrorMessage(error));
    }
  }

  useEffect(() => {
    loadFinOps();
  }, []);

  const finopsGuideSteps = [
    {
      key: 'policies',
      label: 'Policies',
      description: 'Keep quota and connector guardrails visible before spend decisions are recorded.',
      state: 'complete',
      value: 'Open governance policies',
      href: '/governance/policies',
    },
    {
      key: 'finops',
      label: 'FinOps',
      description: 'Track service spend, evidence, and recorded cost events for the tenant.',
      state: 'current',
      value: `${(costSummary.records || []).length} cost records`,
      href: '/governance/finops',
    },
    {
      key: 'reviews',
      label: 'Reviews',
      description: 'Escalate higher-risk approvals or release-sensitive budget decisions into governed review.',
      state: auditLog.length ? 'next' : 'upcoming',
      value: `${auditLog.length} audit events`,
      href: '/governance/reviews',
    },
    {
      key: 'runtime',
      label: 'Runtime',
      description: 'Return cost-governed work into operational execution after the controls are visible.',
      state: (costSummary.records || []).length ? 'next' : 'upcoming',
      value: 'Resume execution path',
      href: '/runtime',
    },
  ];

  return (
    <PlatformShell
      eyebrow="Governance FinOps"
      title="Track service spend and cost evidence without blending it into policy or review workflows."
      description="FinOps is now a dedicated governance surface for service-cost summary, manual cost records, and audit-linked budget evidence."
      focus="global"
      aside={<GovernanceDeskNav />}
      actions={feedback ? <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-accent/75">{feedback}</div> : null}
    >
      <WorkflowGuide
        currentStep="finops"
        steps={finopsGuideSteps}
        primaryAction={{ label: 'Open Policies', href: '/governance/policies' }}
        secondaryAction={{ label: 'Open Reviews', href: '/governance/reviews', tone: 'secondary' }}
        title="Use FinOps as the spend and evidence branch of Governance Desk"
        description="FinOps should make cost posture explicit, keep its audit trail visible, and then hand policy-sensitive or release-sensitive work into the review desk rather than mixing every control into one page."
      />

      <PlatformPanel title="FinOps snapshot" description="Use one surface for spend summary, record volume, and the service mix shaping platform cost.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricTile label="Total Cost" value={formatCurrency(costSummary.total_cost || 0)} detail="Current tenant spend." />
          <MetricTile label="Service Types" value={Object.keys(costSummary.by_service || {}).length} detail="Distinct service buckets with recorded cost." />
          <MetricTile label="Cost Records" value={(costSummary.records || []).length} detail="Tracked cost entries in the current period." />
          <MetricTile label="Audit Events" value={auditLog.length} detail="Recent FinOps mutations in the audit stream." />
        </div>
      </PlatformPanel>

      <PlatformPanel title="Service spend" description="Service-level summary and record capture stay together so FinOps can explain spend without reopening Governance Policies.">
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-4 rounded-3xl border border-stone-200/80 bg-white/82 p-5 shadow-[0_18px_44px_rgba(148,163,184,0.12)]">
            <div className="text-lg font-semibold text-slate-900">Record cost evidence</div>
            <div className="grid gap-4 md:grid-cols-2">
              <input
                value={form.period}
                onChange={(event) => setForm((current) => ({ ...current, period: event.target.value }))}
                className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-slate-700 outline-none"
                placeholder="current"
              />
              <input
                value={form.serviceType}
                onChange={(event) => setForm((current) => ({ ...current, serviceType: event.target.value }))}
                className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-slate-700 outline-none"
                placeholder="compute"
              />
              <input
                value={form.quantity}
                onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))}
                className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-slate-700 outline-none"
                placeholder="1"
              />
              <input
                value={form.cost}
                onChange={(event) => setForm((current) => ({ ...current, cost: event.target.value }))}
                className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-slate-700 outline-none"
                placeholder="25"
              />
            </div>
            <button
              onClick={async () => {
                setBusyKey('record');
                try {
                  await recordTenantCost({
                    period: form.period,
                    service_type: form.serviceType,
                    quantity: Number(form.quantity || 0),
                    cost: Number(form.cost || 0),
                    metadata: { recorded_from: 'governance-finops' },
                  });
                  setFeedback('Recorded a FinOps cost event.');
                  await loadFinOps();
                } catch (error) {
                  setFeedback(toErrorMessage(error));
                } finally {
                  setBusyKey('');
                }
              }}
              disabled={busyKey === 'record'}
              className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:opacity-50"
            >
              {busyKey === 'record' ? 'Recording...' : 'Record cost'}
            </button>
          </div>

          <div className="space-y-3 rounded-3xl border border-stone-200/80 bg-white/82 p-5 shadow-[0_18px_44px_rgba(148,163,184,0.12)]">
            <div className="text-lg font-semibold text-slate-900">By service</div>
            {Object.entries(costSummary.by_service || {}).length ? (
              Object.entries(costSummary.by_service || {}).map(([service, amount]) => (
                <div key={service} className="flex items-center justify-between rounded-2xl border border-stone-200 bg-stone-50/80 px-4 py-3 text-sm text-slate-600">
                  <span>{service}</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(amount)}</span>
                </div>
              ))
            ) : (
              <EmptyState
                title="No service cost records yet"
                message="Record a cost event from the left panel to populate this service mix view."
                detail="FinOps summaries stay empty until spend evidence is captured for the tenant."
              />
            )}
          </div>
        </div>
      </PlatformPanel>

      <PlatformPanel title="FinOps audit stream" description="Audit evidence for recorded cost and quota-related changes stays visible without reopening the old mixed governance page.">
        <div className="space-y-3">
          {auditLog.length ? (
            auditLog.slice(0, 10).map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-stone-200 bg-white/82 p-4 text-sm text-slate-600 shadow-[0_14px_30px_rgba(148,163,184,0.08)]">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold text-slate-900">{entry.action} {entry.resource_type}</div>
                  <div className="text-xs text-stone-500">{entry.timestamp}</div>
                </div>
                <div className="mt-2 text-xs text-stone-500">{entry.user_id || 'system'} · {entry.resource_id || 'n/a'}</div>
              </div>
            ))
          ) : (
            <EmptyState
              title="No FinOps audit events yet"
              message="Cost and quota mutations will appear here once the desk records them."
              detail="This panel exists so spend evidence stays inspectable without reopening the older mixed governance surface."
            />
          )}
        </div>
      </PlatformPanel>
    </PlatformShell>
  );
}