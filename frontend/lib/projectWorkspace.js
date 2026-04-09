import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

import { getProject, listProjects } from '../services/api';
import { extractItems, toErrorMessage } from './platform';

const PROJECT_WORKSPACE_CONTEXT_KEY = 'nexora.project.workspace.context';
export const PROJECT_WORKSPACE_CONTEXT_EVENT = 'nexora:project-workspace-context';

function isBrowser() {
  return typeof window !== 'undefined';
}

function normalizeContextValue(value) {
  if (Array.isArray(value)) {
    return normalizeContextValue(value[0]);
  }
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function cleanQuery(query = {}) {
  return Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  );
}

function resolvePreferredWorkspaceId(project, preferredWorkspaceId = '') {
  const workspaces = Array.isArray(project?.workspaces) ? project.workspaces : [];
  if (preferredWorkspaceId && workspaces.some((workspace) => workspace.id === preferredWorkspaceId)) {
    return preferredWorkspaceId;
  }
  return workspaces[0]?.id || '';
}

async function loadProjectDetail(projectId, projectSummaries = []) {
  if (!projectId) {
    return null;
  }

  try {
    return await getProject(projectId);
  } catch {
    return projectSummaries.find((project) => project.id === projectId) || null;
  }
}

export function getStoredProjectWorkspaceContext() {
  if (!isBrowser()) {
    return { projectId: '', workspaceId: '' };
  }

  try {
    const raw = window.localStorage.getItem(PROJECT_WORKSPACE_CONTEXT_KEY);
    if (!raw) {
      return { projectId: '', workspaceId: '' };
    }
    const parsed = JSON.parse(raw);
    return {
      projectId: normalizeContextValue(parsed.projectId || parsed.project_id),
      workspaceId: normalizeContextValue(parsed.workspaceId || parsed.workspace_id),
    };
  } catch {
    return { projectId: '', workspaceId: '' };
  }
}

export function saveProjectWorkspaceContext(context = {}) {
  const nextContext = {
    projectId: normalizeContextValue(context.projectId || context.project_id),
    workspaceId: normalizeContextValue(context.workspaceId || context.workspace_id),
  };

  if (!isBrowser()) {
    return nextContext;
  }

  window.localStorage.setItem(PROJECT_WORKSPACE_CONTEXT_KEY, JSON.stringify(nextContext));
  window.dispatchEvent(new CustomEvent(PROJECT_WORKSPACE_CONTEXT_EVENT, { detail: nextContext }));
  return nextContext;
}

export function buildWorkspaceHref(pathname, context = {}, extraQuery = {}) {
  const scopedQuery = cleanQuery({
    ...extraQuery,
    project: normalizeContextValue(context.projectId || context.project_id),
    workspace: normalizeContextValue(context.workspaceId || context.workspace_id),
  });

  if (!Object.keys(scopedQuery).length) {
    return pathname;
  }

  return {
    pathname,
    query: scopedQuery,
  };
}

export function buildNavigationItemHref(item, context = {}) {
  if (!item) {
    return '/home';
  }
  if (item.group !== 'project') {
    return item.href;
  }
  return buildWorkspaceHref(item.href, context);
}

export function buildLayerHref(layerKey, href, context = {}) {
  if (layerKey !== 'project') {
    return href;
  }
  return buildWorkspaceHref(href, context);
}

export function useProjectWorkspace() {
  const router = useRouter();
  const requestedProjectId = normalizeContextValue(router.query.project);
  const requestedWorkspaceId = normalizeContextValue(router.query.workspace);
  const [state, setState] = useState({
    loading: true,
    error: '',
    projects: [],
    activeProject: null,
    activeProjectId: '',
    activeWorkspaceId: '',
  });

  useEffect(() => {
    if (!router.isReady) {
      return undefined;
    }

    let cancelled = false;

    async function hydrateProjectWorkspace() {
      try {
        const projectPayload = await listProjects();
        const projectSummaries = extractItems(projectPayload);
        const savedContext = getStoredProjectWorkspaceContext();
        const preferredProjectId = requestedProjectId || savedContext.projectId || projectSummaries[0]?.id || '';
        const projectDetail = await loadProjectDetail(preferredProjectId, projectSummaries);
        const activeProjectId = projectDetail?.id || preferredProjectId;
        const activeWorkspaceId = resolvePreferredWorkspaceId(
          projectDetail,
          requestedWorkspaceId || savedContext.workspaceId,
        );

        if (cancelled) {
          return;
        }

        setState({
          loading: false,
          error: '',
          projects: projectSummaries,
          activeProject: projectDetail,
          activeProjectId,
          activeWorkspaceId,
        });
        saveProjectWorkspaceContext({ projectId: activeProjectId, workspaceId: activeWorkspaceId });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setState((current) => ({
          ...current,
          loading: false,
          error: toErrorMessage(error),
        }));
      }
    }

    hydrateProjectWorkspace();

    return () => {
      cancelled = true;
    };
  }, [requestedProjectId, requestedWorkspaceId, router.isReady]);

  async function syncRouteContext(projectId, workspaceId) {
    if (!router.isReady) {
      return;
    }

    const nextQuery = { ...router.query };
    if (projectId) {
      nextQuery.project = projectId;
    } else {
      delete nextQuery.project;
    }
    if (workspaceId) {
      nextQuery.workspace = workspaceId;
    } else {
      delete nextQuery.workspace;
    }

    await router.replace(
      {
        pathname: router.pathname,
        query: nextQuery,
      },
      undefined,
      { shallow: true },
    );
  }

  async function setActiveProject(projectId) {
    const nextProject = await loadProjectDetail(projectId, state.projects);
    const nextProjectId = nextProject?.id || normalizeContextValue(projectId);
    const nextWorkspaceId = resolvePreferredWorkspaceId(nextProject);
    const nextContext = saveProjectWorkspaceContext({ projectId: nextProjectId, workspaceId: nextWorkspaceId });

    setState((current) => ({
      ...current,
      activeProject: nextProject,
      activeProjectId: nextContext.projectId,
      activeWorkspaceId: nextContext.workspaceId,
    }));
    await syncRouteContext(nextContext.projectId, nextContext.workspaceId);
  }

  async function setActiveWorkspace(workspaceId) {
    const nextWorkspaceId = resolvePreferredWorkspaceId(state.activeProject, workspaceId);
    const nextContext = saveProjectWorkspaceContext({
      projectId: state.activeProjectId,
      workspaceId: nextWorkspaceId,
    });

    setState((current) => ({
      ...current,
      activeWorkspaceId: nextContext.workspaceId,
    }));
    await syncRouteContext(nextContext.projectId, nextContext.workspaceId);
  }

  return {
    ...state,
    workspaces: Array.isArray(state.activeProject?.workspaces) ? state.activeProject.workspaces : [],
    context: {
      projectId: state.activeProjectId,
      workspaceId: state.activeWorkspaceId,
    },
    setActiveProject,
    setActiveWorkspace,
  };
}