import { useEffect, useState } from 'react';

import PlatformShell, { EmptyState, PlatformPanel } from '../components/PlatformShell';
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

  return (
    <PlatformShell
      title="Projects and workspaces"
      description="Create migration programs with default workspaces, then expand them with more workspace slices as teams specialize." 
      actions={feedback ? <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-accent/75">{feedback}</div> : null}
    >
      <PlatformPanel title="Create a project" description="Each new project becomes the anchor for datasets, scenarios, experiments, and deployment history.">
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
          <input
            value={projectName}
            onChange={(event) => setProjectName(event.target.value)}
            placeholder="Retail Migration Program"
            className="rounded-2xl border border-white/10 bg-background/70 px-4 py-3 text-white outline-none"
          />
          <input
            value={projectDescription}
            onChange={(event) => setProjectDescription(event.target.value)}
            placeholder="Cross-functional modernization effort for retail marts"
            className="rounded-2xl border border-white/10 bg-background/70 px-4 py-3 text-white outline-none"
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
            className="rounded-2xl border border-white/10 bg-background/70 px-4 py-3 text-white outline-none"
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
            className="rounded-2xl border border-white/10 bg-background/70 px-4 py-3 text-white outline-none"
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
            className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busyKey === 'workspace' ? 'Adding...' : 'Add workspace'}
          </button>
        </div>
      </PlatformPanel>

      <PlatformPanel title="Project inventory" description="Projects now carry members and workspace lists directly from the backend platform objects.">
        {projects.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {projects.map((project) => (
              <div key={project.id} className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold text-white">{project.name}</div>
                    <div className="mt-2 text-sm text-accent/65">{project.description || 'No description yet.'}</div>
                  </div>
                  <div className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-cyan-100">
                    {project.workspaces?.length || 0} workspaces
                  </div>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="text-xs uppercase tracking-[0.24em] text-accent/45">Members</div>
                    <div className="mt-2 space-y-2">
                      {(project.members || []).length ? (
                        project.members.map((member) => (
                          <div key={`${project.id}-${member.user_id}`} className="rounded-2xl border border-white/10 bg-black/10 px-3 py-2 text-sm text-accent/75">
                            {member.user_id} · {member.role}
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-accent/55">No members recorded.</div>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.24em] text-accent/45">Workspaces</div>
                    <div className="mt-2 space-y-2">
                      {(project.workspaces || []).length ? (
                        project.workspaces.map((workspace) => (
                          <div key={workspace.id} className="rounded-2xl border border-white/10 bg-black/10 px-3 py-2 text-sm text-accent/75">
                            {workspace.name}
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-accent/55">No workspaces recorded.</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState message="No projects yet. Create a project to start grouping catalog assets, scenarios, and experiments." />
        )}
      </PlatformPanel>
    </PlatformShell>
  );
}