import Link from 'next/link';

import { buildWorkspaceHref } from '../lib/projectWorkspace';

const PROJECT_WORKSPACE_LINKS = [
  {
    href: '/migration-studio',
    label: 'Migration Studio',
    description: 'Intake, convert, compare, and seed downstream project assets.',
  },
  {
    href: '/flow',
    label: 'Flow Builder',
    description: 'Stay on the shared DAG where datasets, recipes, notebooks, and deploy gates meet.',
  },
  {
    href: '/notebooks',
    label: 'Notebook Workspace',
    description: 'Open notebook-first engineering without leaving the active program context.',
  },
  {
    href: '/catalog',
    label: 'Catalog + Lineage',
    description: 'Inspect project-scoped assets, lineage, and quality evidence from one asset graph.',
  },
  {
    href: '/ml',
    label: 'ML Studio',
    description: 'Track experiments and serving handoff inside the same delivery context.',
  },
];

export default function ProjectWorkspaceContext({
  projects = [],
  activeProject,
  activeWorkspaceId,
  loading = false,
  error = '',
  onProjectChange,
  onWorkspaceChange,
}) {
  const workspaces = Array.isArray(activeProject?.workspaces) ? activeProject.workspaces : [];
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId) || workspaces[0] || null;
  const projectContext = {
    projectId: activeProject?.id,
    workspaceId: activeWorkspace?.id || activeWorkspaceId,
  };

  return (
    <div className="space-y-4 text-sm text-slate-600">
      <div>
        <div className="text-[10px] uppercase tracking-[0.24em] text-stone-500">Program focus</div>
        <div className="mt-2 text-base font-semibold text-slate-900">{activeProject?.name || 'Select a program'}</div>
        <div className="mt-2 leading-6 text-slate-600">
          {activeProject?.description || 'Keep migration, flow, notebooks, catalog, and ML inside one real project context.'}
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.24em] text-stone-500">Program</div>
          <select
            value={activeProject?.id || ''}
            onChange={(event) => onProjectChange?.(event.target.value)}
            disabled={loading || !projects.length}
            className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-3 py-3 text-sm font-semibold text-slate-900 outline-none disabled:opacity-60"
          >
            <option value="">Select program</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-[0.24em] text-stone-500">Workspace</div>
          <select
            value={activeWorkspace?.id || ''}
            onChange={(event) => onWorkspaceChange?.(event.target.value)}
            disabled={loading || !workspaces.length}
            className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-3 py-3 text-sm font-semibold text-slate-900 outline-none disabled:opacity-60"
          >
            <option value="">Select workspace</option>
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>{workspace.name}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-stone-200 bg-stone-50 px-3 py-3 text-sm text-slate-600">Loading program context...</div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-3 py-3 text-sm text-rose-100">{error}</div>
      ) : null}

      {activeProject ? (
        <div className="rounded-2xl border border-stone-200 bg-stone-50/80 px-3 py-3">
          <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.18em] text-stone-500">
            <span>{workspaces.length} workspaces</span>
            <span>{activeProject.members?.length || 0} members</span>
          </div>
          {activeWorkspace ? (
            <div className="mt-3 rounded-2xl border border-stone-200 bg-white px-3 py-3">
              <div className="text-[10px] uppercase tracking-[0.24em] text-stone-500">Current workspace</div>
              <div className="mt-2 font-semibold text-slate-900">{activeWorkspace.name}</div>
              <div className="mt-2 text-xs leading-5 text-slate-600">{activeWorkspace.description || 'Workspace-specific team or phase context.'}</div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50/80 px-3 py-3 text-sm text-slate-600">
          Create a program first so the project layer behaves like a real workspace instead of a loose set of pages.
          <Link href="/projects" className="mt-3 inline-flex rounded-2xl border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 transition hover:bg-stone-50">
            Open Projects
          </Link>
        </div>
      )}

      {activeProject ? (
        <div>
          <div className="text-[10px] uppercase tracking-[0.24em] text-stone-500">Project workspaces</div>
          <div className="mt-3 grid gap-2">
            {PROJECT_WORKSPACE_LINKS.map((item) => (
              <Link
                key={item.href}
                href={buildWorkspaceHref(item.href, projectContext)}
                className="rounded-2xl border border-stone-200 bg-white/80 px-3 py-3 transition hover:bg-stone-50"
              >
                <div className="font-semibold text-slate-900">{item.label}</div>
                <div className="mt-1 text-xs leading-5 text-slate-600">{item.description}</div>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}