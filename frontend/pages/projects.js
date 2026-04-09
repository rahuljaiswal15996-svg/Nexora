import Link from 'next/link';
import { useEffect, useState } from 'react';

import PlatformShell, { EmptyState, PlatformPanel } from '../components/PlatformShell';
import WorkflowGuide from '../components/WorkflowGuide';
import { buildWorkspaceHref } from '../lib/projectWorkspace';
import { extractItems, toErrorMessage } from '../lib/platform';
import { createProject, createWorkspace, getProject, listProjects } from '../services/api';

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceProjectId, setWorkspaceProjectId] = useState('');
  const [feedback, setFeedback] = useState('');
  const [busyKey, setBusyKey] = useState('');

  async function loadProjects() {
    try {
      const payload = await listProjects();
      const items = extractItems(payload);
      const detailed = await Promise.all(items.map(async (project) => getProject(project.id).catch(() => project)));
      setProjects(detailed);
      if (!workspaceProjectId && detailed[0]?.id) {
        setWorkspaceProjectId(detailed[0].id);
      }
      setFeedback('');
    } catch (error) {
      setFeedback(toErrorMessage(error));
    }
  }

  useEffect(() => {
    loadProjects();
  }, []);

  const totalWorkspaces = projects.reduce((sum, project) => sum + (project.workspaces?.length || 0), 0);
  const activeJourneyProject = projects.find((project) => project.id === workspaceProjectId) || projects[0] || null;
  const activeJourneyContext = {
    projectId: activeJourneyProject?.id || '',
    workspaceId: activeJourneyProject?.workspaces?.[0]?.id || '',
  };

  return (
    <PlatformShell
      title="Projects and workspaces"
      description="Create migration programs with default workspaces, then expand them with more workspace slices as teams specialize." 
      actions={feedback ? <div className="rounded-2xl border border-stone-200 bg-white/80 px-4 py-3 text-sm text-slate-600">{feedback}</div> : null}
    >
      <WorkflowGuide
        currentStep="projects"
        context={activeJourneyContext}
        counts={{ projects: projects.length, workspaces: totalWorkspaces }}
        primaryAction={
          activeJourneyContext.projectId && activeJourneyContext.workspaceId
            ? {
                label: 'Open catalog',
                href: buildWorkspaceHref('/catalog', activeJourneyContext),
              }
            : null
        }
        secondaryAction={
          activeJourneyContext.projectId && activeJourneyContext.workspaceId
            ? {
                label: 'Open notebook workspace',
                href: buildWorkspaceHref('/notebooks', activeJourneyContext),
                tone: 'secondary',
              }
            : null
        }
        title="Start every migration inside a scoped project"
        description="Projects and workspaces are the root of the operating model. Once one workspace exists, the rest of the product should be reachable without rebuilding context by hand."
      />

      <PlatformPanel title="Create a project" description="Each new project becomes the anchor for datasets, scenarios, experiments, and deployment history.">
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
          <input
            value={projectName}
            onChange={(event) => setProjectName(event.target.value)}
            placeholder="Retail Migration Program"
            className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-slate-700 outline-none"
          />
          <input
            value={projectDescription}
            onChange={(event) => setProjectDescription(event.target.value)}
            placeholder="Cross-functional modernization effort for retail marts"
            className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-slate-700 outline-none"
          />
          <button
            onClick={async () => {
              setBusyKey('project');
              try {
                await createProject({ name: projectName, description: projectDescription });
                setProjectName('');
                setProjectDescription('');
                setFeedback('Project created.');
                await loadProjects();
              } catch (error) {
                setFeedback(toErrorMessage(error));
              } finally {
                setBusyKey('');
              }
            }}
            disabled={busyKey === 'project' || !projectName.trim()}
            className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busyKey === 'project' ? 'Creating...' : 'Create project'}
          </button>
        </div>
      </PlatformPanel>

      <PlatformPanel title="Add a workspace" description="Use separate workspaces to partition teams, migration phases, or runtime targets inside a single project.">
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
          <select
            value={workspaceProjectId}
            onChange={(event) => setWorkspaceProjectId(event.target.value)}
            className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-slate-700 outline-none"
          >
            <option value="">Select project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>
          <input
            value={workspaceName}
            onChange={(event) => setWorkspaceName(event.target.value)}
            placeholder="Validation Workspace"
            className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-slate-700 outline-none"
          />
          <button
            onClick={async () => {
              setBusyKey('workspace');
              try {
                await createWorkspace(workspaceProjectId, { name: workspaceName, description: 'Created from the dedicated projects page' });
                setWorkspaceName('');
                setFeedback('Workspace created.');
                await loadProjects();
              } catch (error) {
                setFeedback(toErrorMessage(error));
              } finally {
                setBusyKey('');
              }
            }}
            disabled={busyKey === 'workspace' || !workspaceProjectId || !workspaceName.trim()}
            className="rounded-2xl border border-stone-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busyKey === 'workspace' ? 'Adding...' : 'Add workspace'}
          </button>
        </div>
      </PlatformPanel>

      <PlatformPanel title="Project inventory" description="Projects now carry members and workspace lists directly from the backend platform objects.">
        {projects.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {projects.map((project) => (
              <div key={project.id} className="rounded-3xl border border-stone-200/80 bg-white/82 p-5 shadow-[0_18px_44px_rgba(148,163,184,0.12)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold text-slate-900">{project.name}</div>
                    <div className="mt-2 text-sm text-slate-600">{project.description || 'No description yet.'}</div>
                  </div>
                  <div className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-sky-700">
                    {project.workspaces?.length || 0} workspaces
                  </div>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="text-xs uppercase tracking-[0.24em] text-stone-500">Members</div>
                    <div className="mt-2 space-y-2">
                      {(project.members || []).length ? (
                        project.members.map((member) => (
                          <div key={`${project.id}-${member.user_id}`} className="rounded-2xl border border-stone-200 bg-stone-50/80 px-3 py-2 text-sm text-slate-600">
                            {member.user_id} · {member.role}
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-slate-500">No members recorded.</div>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.24em] text-stone-500">Workspaces</div>
                    <div className="mt-2 space-y-2">
                      {(project.workspaces || []).length ? (
                        project.workspaces.map((workspace) => (
                          <div key={workspace.id} className="rounded-2xl border border-stone-200 bg-stone-50/80 px-3 py-2 text-sm text-slate-600">
                            {workspace.name}
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-slate-500">No workspaces recorded.</div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link href={buildWorkspaceHref('/migration-studio', { projectId: project.id, workspaceId: project.workspaces?.[0]?.id })} className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-stone-50">
                    Migration
                  </Link>
                  <Link href={buildWorkspaceHref('/flow', { projectId: project.id, workspaceId: project.workspaces?.[0]?.id })} className="rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-600">
                    Flow
                  </Link>
                  <Link href={buildWorkspaceHref('/notebooks', { projectId: project.id, workspaceId: project.workspaces?.[0]?.id })} className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-stone-50">
                    Notebook
                  </Link>
                  <Link href={buildWorkspaceHref('/catalog', { projectId: project.id, workspaceId: project.workspaces?.[0]?.id })} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-white">
                    Catalog
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No projects yet"
            message="Create a project to start grouping catalog assets, notebook work, flow graphs, and experiment history."
            detail="Once the first project and workspace exist, the rest of the product path becomes scoped automatically."
          />
        )}
      </PlatformPanel>
    </PlatformShell>
  );
}