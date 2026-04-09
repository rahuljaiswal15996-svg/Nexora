import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import ProjectWorkspaceContext from '../components/ProjectWorkspaceContext';
import PlatformShell, { EmptyState, MetricTile, PlatformPanel, StatusPill } from '../components/PlatformShell';
import { buildWorkspaceHref, useProjectWorkspace } from '../lib/projectWorkspace';
import { GLOBAL_NAV_ITEMS } from '../lib/platformExperience';
import { extractItems, isJobActive, toErrorMessage } from '../lib/platform';
import { listCatalogDatasets, listDeployments, listJobs, listProjects } from '../services/api';

const CONTINUE_CARDS = [
  {
    href: '/migration-studio',
    title: 'Start a modernization batch',
    description: 'Bring in legacy assets, parse them, and move quickly into validation and approval.',
    metricLabel: 'Migration entry',
  },
  {
    href: '/flow',
    title: 'Return to Flow Builder',
    description: 'Continue orchestration work from the shared graph where datasets, notebooks, and deploy gates meet.',
    metricLabel: 'Production work',
  },
  {
    href: '/notebooks?mode=new',
    title: 'Launch Jupyter Workspace',
    description: 'Open a notebook-first workbench for exploratory analysis, data preparation, and flow-linked engineering.',
    metricLabel: 'Notebook work',
    query: { mode: 'new' },
  },
];

function formatDate(value) {
  if (!value) {
    return 'Recently active';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Recently active';
  }

  return parsed.toLocaleDateString();
}

export default function ProgramsPage() {
  const {
    activeProject,
    activeWorkspaceId,
    context: projectNavigationContext,
    error: projectWorkspaceError,
    loading: projectWorkspaceLoading,
    projects: projectOptions,
    setActiveProject,
    setActiveWorkspace,
  } = useProjectWorkspace();
  const [overview, setOverview] = useState({
    projects: [],
    datasets: [],
    deployments: [],
    jobs: [],
  });
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadOverview() {
      try {
        const [projects, datasets, deployments, jobs] = await Promise.all([
          listProjects(),
          listCatalogDatasets(),
          listDeployments(),
          listJobs(),
        ]);
        setOverview({
          projects: extractItems(projects),
          datasets: extractItems(datasets),
          deployments: extractItems(deployments),
          jobs: extractItems(jobs),
        });
        setError('');
      } catch (loadError) {
        setError(toErrorMessage(loadError));
      }
    }

    loadOverview();
  }, []);

  const activeJobs = useMemo(() => overview.jobs.filter(isJobActive), [overview.jobs]);
  const sharedWorkspaces = useMemo(() => GLOBAL_NAV_ITEMS.filter((item) => item.href !== '/home'), []);
  const recentActivity = useMemo(
    () => [
      ...activeJobs.slice(0, 4).map((job) => ({
        id: `job-${job.id}`,
        label: job.job_type || 'Platform job',
        detail: job.resource_id || job.id,
        status: job.status,
        href: '/runtime',
      })),
      ...overview.deployments.slice(0, 3).map((deployment) => ({
        id: `deployment-${deployment.id}`,
        label: deployment.name || deployment.id || 'Deployment',
        detail: deployment.environment || deployment.target || 'Promotion activity',
        status: deployment.status,
        href: '/runtime',
      })),
    ],
    [activeJobs, overview.deployments],
  );

  return (
    <PlatformShell
      eyebrow="Home"
      title="See your active programs, shared workspaces, and next actions without opening the whole platform map."
      description="The landing page is now a personal access layer: quick entry into migration, flow, and notebooks, plus visibility into recent operational activity across the platform."
      focus="global"
      navigationContext={projectNavigationContext}
      aside={
        <ProjectWorkspaceContext
          projects={projectOptions}
          activeProject={activeProject}
          activeWorkspaceId={activeWorkspaceId}
          loading={projectWorkspaceLoading}
          error={projectWorkspaceError}
          onProjectChange={setActiveProject}
          onWorkspaceChange={setActiveWorkspace}
        />
      }
      actions={error ? <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}
    >
      <PlatformPanel title="Portfolio snapshot" description="A compact view of the work that matters first: programs, registered assets, deployment posture, and active asynchronous activity.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricTile label="Programs" value={overview.projects.length} detail="Project delivery contexts available to your tenant." />
          <MetricTile label="Catalog Assets" value={overview.datasets.length} detail="Datasets already registered into the shared asset graph." />
          <MetricTile label="Deployments" value={overview.deployments.length} detail="Promotion records across runtime environments." />
          <MetricTile label="Active Jobs" value={activeJobs.length} detail="Queued or running background work items that may need operator attention." />
        </div>
      </PlatformPanel>

      <PlatformPanel title="Continue working" description="Go straight back into the workflow you were doing instead of stepping through a generic summary page.">
        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="grid gap-4 md:grid-cols-3">
            {CONTINUE_CARDS.map((card) => (
              <Link key={card.href} href={buildWorkspaceHref(card.href.replace(/\?.*$/, ''), projectNavigationContext, card.query)} className="group rounded-[30px] border border-stone-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(245,245,244,0.88))] p-5 shadow-[0_20px_46px_rgba(148,163,184,0.14)] transition hover:-translate-y-1 hover:border-sky-200 hover:shadow-[0_24px_54px_rgba(125,211,252,0.14)]">
                <div className="text-[10px] uppercase tracking-[0.28em] text-sky-700/70">{card.metricLabel}</div>
                <div className="mt-4 text-xl font-semibold text-slate-900">{card.title}</div>
                <div className="mt-3 text-sm leading-6 text-accent/88">{card.description}</div>
                <div className="mt-6 text-xs uppercase tracking-[0.24em] text-sky-700 transition group-hover:text-sky-800">Open workspace</div>
              </Link>
            ))}
          </div>

          <div className="rounded-[30px] border border-stone-200/80 bg-white/80 p-5 shadow-[0_18px_44px_rgba(148,163,184,0.12)]">
            <div className="text-[10px] uppercase tracking-[0.28em] text-accent/50">Recent platform activity</div>
            <div className="mt-4 space-y-3">
              {recentActivity.length ? (
                recentActivity.map((item) => (
                  <Link key={item.id} href={item.href} className="flex items-center justify-between gap-3 rounded-[24px] border border-stone-200 bg-stone-50/80 px-4 py-3 transition hover:border-stone-300 hover:bg-white">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{item.label}</div>
                      <div className="mt-1 text-xs text-slate-500">{item.detail}</div>
                    </div>
                    <StatusPill status={item.status} />
                  </Link>
                ))
              ) : (
                <EmptyState message="No active jobs or recent deployment events are visible yet." />
              )}
            </div>
          </div>
        </div>
      </PlatformPanel>

      <PlatformPanel title="Programs" description="Projects are the organizing context. Open the project layer from here instead of mixing program navigation into every page.">
        {overview.projects.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {overview.projects.slice(0, 6).map((project) => (
              <div key={project.id} className="rounded-[30px] border border-stone-200/80 bg-white/82 p-5 shadow-[0_18px_44px_rgba(148,163,184,0.12)]">
                <div className="text-[10px] uppercase tracking-[0.28em] text-accent/50">Program</div>
                <div className="mt-4 text-xl font-semibold text-slate-900">{project.name || 'Untitled program'}</div>
                <div className="mt-3 min-h-[4.5rem] text-sm leading-6 text-accent/68">
                  {project.description || 'This project is ready for migration, notebook exploration, and flow-based delivery.'}
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-accent/72">
                  <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-2">Owner {project.owner_id || 'shared team'}</span>
                  <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-2">Updated {formatDate(project.updated_at)}</span>
                </div>
                <div className="mt-6 flex flex-wrap gap-2">
                  <Link href={buildWorkspaceHref('/flow', { projectId: project.id })} className="rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-600">
                    Open Flow
                  </Link>
                  <Link href={buildWorkspaceHref('/notebooks', { projectId: project.id }, { mode: 'new' })} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-stone-300 hover:bg-white">
                    Open Notebook
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState message="No programs are registered yet. Create one from the Projects page and return here for quick access." />
        )}
      </PlatformPanel>

      <PlatformPanel title="Shared workspaces" description="These cross-project spaces stay available from Home, but they no longer crowd the navigation inside project workspaces.">
        <div className="grid gap-4 md:grid-cols-3">
          {sharedWorkspaces.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-[30px] border border-stone-200/80 bg-white/82 p-5 shadow-[0_18px_44px_rgba(148,163,184,0.12)] transition hover:-translate-y-1 hover:border-sky-200 hover:bg-white">
              <div className="text-lg font-semibold text-slate-900">{item.label}</div>
              <div className="mt-3 text-sm leading-6 text-accent/68">{item.description}</div>
              <div className="mt-6 text-xs uppercase tracking-[0.24em] text-sky-700">Open shared workspace</div>
            </Link>
          ))}
        </div>
      </PlatformPanel>
    </PlatformShell>
  );
}