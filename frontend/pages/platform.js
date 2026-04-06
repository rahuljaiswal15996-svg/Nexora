import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import PlatformShell, { EmptyState, MetricTile, PlatformPanel, StatusPill } from '../components/PlatformShell';
import { extractItems, isJobActive, toErrorMessage } from '../lib/platform';
import { listCatalogDatasets, listDeployments, listExperiments, listJobs, listProjects } from '../services/api';

const HUB_SECTIONS = [
  {
    href: '/projects',
    title: 'Projects',
    description: 'Portfolio ownership, default workspaces, and project-scoped migration programs.',
  },
  {
    href: '/catalog',
    title: 'Catalog',
    description: 'Dataset registration, quality checks, and the first step toward lineage-driven operations.',
  },
  {
    href: '/operations',
    title: 'Operations',
    description: 'Scenario versions, deployment targets, promotion records, and queue activity.',
  },
  {
    href: '/governance',
    title: 'Governance',
    description: 'Policies, quotas, collaboration, reviews, and tenant audit visibility.',
  },
  {
    href: '/ml',
    title: 'ML',
    description: 'Experiments, asynchronous experiment runs, and serving endpoint registration.',
  },
];

export default function PlatformPage() {
  const [overview, setOverview] = useState({
    projects: [],
    datasets: [],
    deployments: [],
    experiments: [],
    jobs: [],
  });
  const [error, setError] = useState('');

  async function loadOverview() {
    try {
      const [projects, datasets, deployments, experiments, jobs] = await Promise.all([
        listProjects(),
        listCatalogDatasets(),
        listDeployments(),
        listExperiments(),
        listJobs(),
      ]);
      setOverview({
        projects: extractItems(projects),
        datasets: extractItems(datasets),
        deployments: extractItems(deployments),
        experiments: extractItems(experiments),
        jobs: extractItems(jobs),
      });
      setError('');
    } catch (loadError) {
      setError(toErrorMessage(loadError));
    }
  }

  useEffect(() => {
    loadOverview();
  }, []);

  const activeJobs = useMemo(() => overview.jobs.filter(isJobActive), [overview.jobs]);

  useEffect(() => {
    if (!activeJobs.length) {
      return undefined;
    }
    const handle = window.setInterval(() => {
      loadOverview();
    }, 2500);
    return () => window.clearInterval(handle);
  }, [activeJobs.length]);

  return (
    <PlatformShell
      eyebrow="Enterprise Control Plane"
      title="Operate Nexora through focused workspaces instead of one monolithic admin screen."
      description="The control plane is now split by outcome: portfolio, catalog, operations, governance, and ML. Recent queued work is visible below and kept live through job polling."
      actions={
        error ? (
          <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div>
        ) : null
      }
    >
      <PlatformPanel title="Control-plane snapshot" description="High-signal counts across the new platform modules.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricTile label="Projects" value={overview.projects.length} detail="Tenant programs and workspaces." />
          <MetricTile label="Catalog Assets" value={overview.datasets.length} detail="Datasets registered in the catalog." />
          <MetricTile label="Deployments" value={overview.deployments.length} detail="Promotion records and target history." />
          <MetricTile label="Experiments" value={overview.experiments.length} detail="Tracked ML lifecycle entries." />
          <MetricTile label="Active Jobs" value={activeJobs.length} detail="Queued or running asynchronous work." />
        </div>
      </PlatformPanel>

      <PlatformPanel title="Dedicated workspaces" description="Use the focused pages below instead of operating everything from one large dashboard.">
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {HUB_SECTIONS.map((section) => (
            <Link key={section.href} href={section.href} className="rounded-3xl border border-white/10 bg-white/5 p-5 transition hover:bg-white/10">
              <div className="text-xl font-semibold text-white">{section.title}</div>
              <div className="mt-2 text-sm text-accent/68">{section.description}</div>
              <div className="mt-4 text-xs uppercase tracking-[0.24em] text-cyan-100/70">Open workspace</div>
            </Link>
          ))}
        </div>
      </PlatformPanel>

      <PlatformPanel title="Recent queue activity" description="Deployment, dataset quality, and experiment jobs now run asynchronously and can be polled live.">
        {overview.jobs.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {overview.jobs.slice(0, 8).map((job) => (
              <div key={job.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">{job.job_type}</div>
                    <div className="mt-1 text-xs text-accent/55">{job.resource_type} · {job.resource_id || 'n/a'}</div>
                  </div>
                  <StatusPill status={job.status} />
                </div>
                <div className="mt-3 text-xs text-accent/45">Created {job.created_at}</div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState message="No queued jobs yet. Trigger a dataset quality check, deployment, or experiment run to populate the queue." />
        )}
      </PlatformPanel>
    </PlatformShell>
  );
}