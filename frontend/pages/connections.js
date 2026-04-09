import CloudConnectionsManager from '../components/CloudConnectionsManager';
import ProjectWorkspaceContext from '../components/ProjectWorkspaceContext';
import PlatformShell, { PlatformPanel } from '../components/PlatformShell';
import WorkflowGuide from '../components/WorkflowGuide';
import { CONNECTIONS_HUB_PILLARS } from '../lib/platformExperience';
import { buildWorkspaceHref, useProjectWorkspace } from '../lib/projectWorkspace';

export default function ConnectionsPage() {
  const {
    activeProject,
    activeProjectId,
    activeWorkspaceId,
    context: projectNavigationContext,
    error: projectWorkspaceError,
    loading: projectWorkspaceLoading,
    projects: projectOptions,
    setActiveProject,
    setActiveWorkspace,
  } = useProjectWorkspace();

  const connectionGuideSteps = [
    {
      key: 'project',
      label: 'Project',
      description: 'Keep source onboarding attached to the current delivery context.',
      state: activeProjectId && activeWorkspaceId ? 'complete' : 'next',
      value: activeProject?.name || 'Select active project',
      href: '/projects',
    },
    {
      key: 'connections',
      label: 'Connections',
      description: 'Validate connectors, browse source datasets, and inspect schema in one place.',
      state: 'current',
      value: 'Source discovery and handoff',
      href: buildWorkspaceHref('/connections', projectNavigationContext),
    },
    {
      key: 'catalog',
      label: 'Catalog',
      description: 'Register the selected dataset into lineage and quality-aware catalog context.',
      state: activeProjectId ? 'next' : 'upcoming',
      value: 'Register discovered source assets',
      href: buildWorkspaceHref('/catalog', projectNavigationContext),
    },
    {
      key: 'notebook',
      label: 'Notebook',
      description: 'Open the selected dataset in notebook-first exploration without losing project scope.',
      state: activeProjectId ? 'next' : 'upcoming',
      value: 'Inspect or engineer against source data',
      href: buildWorkspaceHref('/notebooks', projectNavigationContext),
    },
  ];

  return (
    <PlatformShell
      eyebrow="Connections Hub"
      title="Manage enterprise data and compute connections with testing, discovery, and credential posture in one place."
      description="Connections Hub now exposes connection health, dataset browsing, schema discovery, and secure-credential posture as a dedicated global workspace."
      focus="global"
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
    >
      <WorkflowGuide
        currentStep="connections"
        steps={connectionGuideSteps}
        primaryAction={{ label: 'Open Catalog + Lineage', href: buildWorkspaceHref('/catalog', projectNavigationContext) }}
        secondaryAction={{ label: 'Open Notebook Workspace', href: buildWorkspaceHref('/notebooks', projectNavigationContext), tone: 'secondary' }}
        title="Use Connections Hub as the controlled source-entry point into project workspaces"
        description="Connector health, schema discovery, and source browsing now lead directly into catalog registration and notebook exploration instead of forcing users to restart the workflow elsewhere."
      />

      <PlatformPanel title="Connections operating model" description="This workspace is responsible for testing, schema discovery, source browsing, and secure connector posture before data enters the rest of the platform.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {CONNECTIONS_HUB_PILLARS.map((item) => (
            <div key={item.title} className="rounded-3xl border border-stone-200/80 bg-white/88 p-5 shadow-[0_14px_32px_rgba(148,163,184,0.1)]">
              <div className="text-lg font-semibold text-slate-900">{item.title}</div>
              <div className="mt-3 text-sm leading-6 text-slate-600">{item.description}</div>
            </div>
          ))}
        </div>
      </PlatformPanel>

      <PlatformPanel title="Connection management" description="Test sources, browse datasets, discover schemas, and validate connector health from the same surface.">
        <CloudConnectionsManager projectContext={projectNavigationContext} />
      </PlatformPanel>
    </PlatformShell>
  );
}