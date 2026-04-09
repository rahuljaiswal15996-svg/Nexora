import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';

import { buildNavigationItemHref, getStoredProjectWorkspaceContext, PROJECT_WORKSPACE_CONTEXT_EVENT } from '../lib/projectWorkspace';
import { GLOBAL_NAV_ITEMS, PROJECT_NAV_ITEMS, matchesRoute } from '../lib/platformExperience';
import { ensureDevSession, getWorkspaceSession, updateWorkspaceRole } from '../services/api';

const HEADER_NAV_ITEMS = [...GLOBAL_NAV_ITEMS, ...PROJECT_NAV_ITEMS];

function IconBase({ children, className = '' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function BrandIcon({ className = '' }) {
  return (
    <IconBase className={className}>
      <path d="M6.5 6.5h5.25l5.75 11h-4.5l-2.15-4.25H8.95v4.25H6.5z" />
      <path d="M8.9 10.5h3.5" />
    </IconBase>
  );
}

function SearchIcon({ className = '' }) {
  return (
    <IconBase className={className}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </IconBase>
  );
}

function BellIcon({ className = '' }) {
  return (
    <IconBase className={className}>
      <path d="M15.5 17H20l-1.2-1.2a2 2 0 0 1-.6-1.4v-3.2a6.2 6.2 0 1 0-12.4 0v3.2a2 2 0 0 1-.6 1.4L4 17h4.5" />
      <path d="M10 17a2 2 0 0 0 4 0" />
    </IconBase>
  );
}

function UserIcon({ className = '' }) {
  return (
    <IconBase className={className}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5.5 20a7.5 7.5 0 0 1 13 0" />
    </IconBase>
  );
}

function OpenIcon({ className = '' }) {
  return (
    <IconBase className={className}>
      <path d="m7 17 10-10" />
      <path d="M9 7h8v8" />
    </IconBase>
  );
}

function shortenContextValue(label, value) {
  if (!value) {
    return `${label} off`;
  }

  if (value.length <= 18) {
    return `${label} ${value}`;
  }

  return `${label} ${value.slice(0, 6)}...${value.slice(-4)}`;
}

export default function Header() {
  const router = useRouter();
  const [session, setSession] = useState(getWorkspaceSession());
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);
  const [projectContext, setProjectContext] = useState(getStoredProjectWorkspaceContext());
  const [commandText, setCommandText] = useState('');

  useEffect(() => {
    let mounted = true;

    ensureDevSession()
      .then((nextSession) => {
        if (mounted) {
          setSession(nextSession);
        }
      })
      .catch((error) => {
        console.error('Unable to initialize session', error);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    function syncProjectContext(event) {
      setProjectContext(event?.detail || getStoredProjectWorkspaceContext());
    }

    window.addEventListener(PROJECT_WORKSPACE_CONTEXT_EVENT, syncProjectContext);
    return () => {
      window.removeEventListener(PROJECT_WORKSPACE_CONTEXT_EVENT, syncProjectContext);
    };
  }, []);

  useEffect(() => {
    setCommandText('');
  }, [router.asPath]);

  const activeItem = useMemo(
    () => HEADER_NAV_ITEMS.find((item) => matchesRoute(router.pathname, item.href)) || HEADER_NAV_ITEMS[0],
    [router.pathname],
  );

  const quickOpenItems = useMemo(
    () => HEADER_NAV_ITEMS.map((item) => ({
      ...item,
      resolvedHref: buildNavigationItemHref(item, projectContext),
      searchText: `${item.label} ${item.description || ''}`.toLowerCase(),
    })),
    [projectContext],
  );

  const matchingItems = useMemo(() => {
    const query = commandText.trim().toLowerCase();
    if (!query) {
      return [];
    }

    return quickOpenItems.filter((item) => item.searchText.includes(query)).slice(0, 5);
  }, [commandText, quickOpenItems]);

  const handleRoleChange = async (event) => {
    const nextRole = event.target.value;
    setIsUpdatingRole(true);
    try {
      const nextSession = await updateWorkspaceRole(nextRole);
      setSession(nextSession);
    } catch (error) {
      console.error('Unable to change workspace role', error);
    } finally {
      setIsUpdatingRole(false);
    }
  };

  function openCommand(targetHref) {
    setCommandText('');
    void router.push(targetHref);
  }

  const handleQuickOpen = (event) => {
    event.preventDefault();
    const query = commandText.trim().toLowerCase();
    if (!query) {
      return;
    }

    const target = matchingItems[0] || quickOpenItems.find((item) => item.label.toLowerCase() === query);
    if (!target) {
      return;
    }

    openCommand(target.resolvedHref);
  };

  const tenantId = session?.tenant_id || 'tenant-dev';
  const userLabel = session?.user || 'Nexora Operator';
  const userInitial = userLabel.slice(0, 1).toUpperCase();
  const sessionRole = session?.role || 'viewer';
  const scopedProject = shortenContextValue('Project', projectContext.projectId);
  const scopedWorkspace = shortenContextValue('Workspace', projectContext.workspaceId);

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200/80 bg-[rgba(247,243,236,0.9)] backdrop-blur-xl">
      <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 py-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <Link href="/home" className="flex min-w-0 items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0f766e,#0ea5e9)] text-white shadow-[0_16px_34px_rgba(14,116,144,0.22)]">
                <BrandIcon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-[10px] uppercase tracking-[0.34em] text-sky-700/70">Nexora</span>
                <span className="block truncate text-base font-semibold tracking-tight text-slate-900">Unified Data Workspace</span>
              </span>
            </Link>

            <div className="hidden h-10 w-px bg-stone-200 xl:block" />

            <div className="hidden min-w-0 xl:block">
              <div className="text-[10px] uppercase tracking-[0.32em] text-stone-500">Current surface</div>
              <div className="mt-1 truncate text-sm font-semibold text-slate-900">{activeItem?.label || 'Platform overview'}</div>
              <div className="mt-1 max-w-md truncate text-xs text-slate-600">{activeItem?.description || 'Search or jump between platform surfaces from one shared command bar.'}</div>
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-3 xl:max-w-[980px] xl:flex-row xl:items-center xl:justify-end">
            <form onSubmit={handleQuickOpen} className="relative flex-1 xl:max-w-xl">
              <label htmlFor="nexora-command-bar" className="sr-only">Quick open platform surfaces</label>
              <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="nexora-command-bar"
                type="search"
                value={commandText}
                onChange={(event) => setCommandText(event.target.value)}
                placeholder="Search workspaces, runtime, notebooks, flow..."
                className="w-full rounded-full border border-stone-200 bg-white py-3 pl-11 pr-16 text-sm text-slate-800 shadow-sm outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
              />
              <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-slate-700 transition hover:bg-white">
                Go
              </button>

              {commandText.trim() ? (
                <div className="absolute inset-x-0 top-[calc(100%+0.75rem)] rounded-[24px] border border-stone-200 bg-[rgba(255,255,255,0.96)] p-2 shadow-[0_24px_60px_rgba(148,163,184,0.18)] backdrop-blur-sm">
                  {matchingItems.length ? (
                    matchingItems.map((item) => (
                      <button
                        key={item.href}
                        type="button"
                        onClick={() => openCommand(item.resolvedHref)}
                        className="flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left transition hover:bg-stone-50"
                      >
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{item.label}</div>
                          <div className="mt-1 text-xs text-slate-500">{item.description}</div>
                        </div>
                        <OpenIcon className="h-4 w-4 shrink-0 text-slate-400" />
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-sm text-slate-500">No surfaces match this search.</div>
                  )}
                </div>
              ) : null}
            </form>

            <div className="flex flex-wrap items-center gap-2 xl:gap-3">
              <div className="hidden items-center gap-2 rounded-full border border-stone-200 bg-white/80 px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-slate-600 md:flex">
                <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-sky-700">{scopedProject}</span>
                <span className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-slate-700">{scopedWorkspace}</span>
              </div>

              <div className="hidden items-center gap-3 rounded-[22px] border border-stone-200 bg-white/85 px-3 py-2.5 lg:flex">
                <div className="text-right leading-tight">
                  <div className="text-[10px] uppercase tracking-[0.24em] text-stone-500">Workspace</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">{tenantId}</div>
                </div>
                <div className="h-8 w-px bg-stone-200" />
                <div className="leading-tight">
                  <div className="text-[10px] uppercase tracking-[0.24em] text-stone-500">Role</div>
                  <select
                    value={sessionRole}
                    onChange={handleRoleChange}
                    disabled={isUpdatingRole}
                    className="mt-1 bg-transparent text-sm font-semibold text-slate-900 outline-none"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>

              <button
                type="button"
                className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-stone-200 bg-white text-slate-600 transition hover:bg-stone-50"
                aria-label="View notifications"
              >
                <BellIcon className="h-4 w-4" />
                <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-sky-500" />
              </button>

              <div className="flex items-center gap-3 rounded-[22px] border border-stone-200 bg-white/85 px-3 py-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-100 text-sm font-semibold text-sky-700">
                  {userInitial}
                </div>
                <div className="hidden sm:block leading-tight">
                  <div className="text-sm font-semibold text-slate-900">{userLabel}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-[0.24em] text-stone-500">Signed into workspace</div>
                </div>
                <UserIcon className="hidden h-4 w-4 text-slate-400 sm:block" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}