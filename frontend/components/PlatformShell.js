import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

import { buildLayerHref, buildNavigationItemHref } from '../lib/projectWorkspace';
import { statusTone } from '../lib/platform';
import { GLOBAL_NAV_ITEMS, PLATFORM_LAYER_META, PROJECT_NAV_ITEMS, matchesRoute } from '../lib/platformExperience';

const SIDEBAR_STATE_KEY = 'nexora.platform.shell.collapsed';

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

function SidebarToggleIcon({ collapsed, className = '' }) {
  return collapsed ? (
    <IconBase className={className}>
      <path d="m10 6 6 6-6 6" />
    </IconBase>
  ) : (
    <IconBase className={className}>
      <path d="m14 6-6 6 6 6" />
    </IconBase>
  );
}

function LayerIcon({ layer, className = '' }) {
  if (layer === 'global') {
    return (
      <IconBase className={className}>
        <circle cx="12" cy="12" r="8" />
        <path d="M4.5 12h15" />
        <path d="M12 4.5a12.5 12.5 0 0 1 0 15" />
        <path d="M12 4.5a12.5 12.5 0 0 0 0 15" />
      </IconBase>
    );
  }

  return (
    <IconBase className={className}>
      <path d="M4.5 8.5 12 4l7.5 4.5L12 13z" />
      <path d="M4.5 12.5 12 17l7.5-4.5" />
      <path d="M4.5 16.5 12 21l7.5-4.5" />
    </IconBase>
  );
}

function NavigationIcon({ href, className = '' }) {
  if (href === '/home') {
    return (
      <IconBase className={className}>
        <path d="M4.5 10.5 12 4l7.5 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-3.5v-6h-5v6H6A1.5 1.5 0 0 1 4.5 19z" />
      </IconBase>
    );
  }

  if (href.includes('runtime')) {
    return (
      <IconBase className={className}>
        <rect x="4.5" y="6" width="15" height="12" rx="2.5" />
        <path d="M8 10.5h8" />
        <path d="M8 14h5" />
      </IconBase>
    );
  }

  if (href.includes('connections')) {
    return (
      <IconBase className={className}>
        <circle cx="7" cy="12" r="2.5" />
        <circle cx="17" cy="7" r="2.5" />
        <circle cx="17" cy="17" r="2.5" />
        <path d="m9.2 10.8 5.7-2.6" />
        <path d="m9.2 13.2 5.7 2.6" />
      </IconBase>
    );
  }

  if (href.includes('governance')) {
    return (
      <IconBase className={className}>
        <path d="M12 4.5 18.5 7v4.5c0 4-2.4 7.5-6.5 8.9-4.1-1.4-6.5-4.9-6.5-8.9V7z" />
        <path d="m9.5 12 1.7 1.7 3.3-3.4" />
      </IconBase>
    );
  }

  if (href.includes('migration')) {
    return (
      <IconBase className={className}>
        <path d="M7 4.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 19V6A1.5 1.5 0 0 1 7 4.5z" />
        <path d="M14 4.5V9h4" />
        <path d="M8.5 14h7" />
        <path d="m12.5 11 3 3-3 3" />
      </IconBase>
    );
  }

  if (href.includes('flow')) {
    return (
      <IconBase className={className}>
        <circle cx="7" cy="7" r="2.5" />
        <circle cx="17" cy="7" r="2.5" />
        <circle cx="12" cy="17" r="2.5" />
        <path d="M9.5 7h5" />
        <path d="m8.5 9.2 2.4 5.1" />
        <path d="m15.5 9.2-2.4 5.1" />
      </IconBase>
    );
  }

  if (href.includes('notebooks')) {
    return (
      <IconBase className={className}>
        <path d="M6.5 5.5h9.5A2.5 2.5 0 0 1 18.5 8v11a2 2 0 0 0-2-2H6.5A2 2 0 0 0 4.5 19V7.5a2 2 0 0 1 2-2z" />
        <path d="M8.5 9.5h6" />
        <path d="M8.5 13h6" />
      </IconBase>
    );
  }

  if (href.includes('catalog')) {
    return (
      <IconBase className={className}>
        <ellipse cx="12" cy="6.5" rx="6.5" ry="2.5" />
        <path d="M5.5 6.5V12c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5V6.5" />
        <path d="M5.5 12v5.5c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5V12" />
      </IconBase>
    );
  }

  if (href.includes('ml')) {
    return (
      <IconBase className={className}>
        <path d="M5.5 17.5 10 12l3 3 5.5-7" />
        <path d="M18.5 8H15" />
        <path d="M18.5 8v3.5" />
      </IconBase>
    );
  }

  return (
    <IconBase className={className}>
      <circle cx="12" cy="12" r="7" />
      <path d="M12 8v8" />
      <path d="M8 12h8" />
    </IconBase>
  );
}

export function PlatformPanel({ title, description, children, actions }) {
  return (
    <section className="rounded-[28px] border border-stone-200/80 bg-white/78 p-6 shadow-[0_20px_55px_rgba(148,163,184,0.16)] backdrop-blur-sm">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h2>
          {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p> : null}
        </div>
        {actions ? <div className="text-sm text-slate-500">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function MetricTile({ label, value, detail }) {
  return (
    <div className="relative overflow-hidden rounded-[24px] border border-stone-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(248,250,252,0.9))] p-5 shadow-[0_16px_36px_rgba(148,163,184,0.12)]">
      <div className="absolute right-4 top-4 h-10 w-10 rounded-2xl border border-sky-200 bg-sky-50" />
      <div className="relative">
        <div className="text-[10px] uppercase tracking-[0.28em] text-stone-500">{label}</div>
        <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{value}</div>
        {detail ? <div className="mt-2 text-sm leading-6 text-slate-600">{detail}</div> : null}
      </div>
    </div>
  );
}

export function StatusPill({ status }) {
  return (
    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${statusTone(status)}`}>
      {status || 'unknown'}
    </span>
  );
}

export function EmptyState({ title = '', message, detail = '', actions = null }) {
  return (
    <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50/80 px-4 py-6 text-sm text-slate-600">
      {title ? <div className="text-sm font-semibold text-slate-900">{title}</div> : null}
      <div className={title ? 'mt-2' : ''}>{message}</div>
      {detail ? <div className="mt-2 leading-6 text-slate-500">{detail}</div> : null}
      {actions ? <div className="mt-4 flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export default function PlatformShell({ eyebrow = 'Nexora Platform', title, description, children, actions, focus = 'project', aside, navigationContext }) {
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const primaryItems = focus === 'global' ? GLOBAL_NAV_ITEMS : PROJECT_NAV_ITEMS;
  const alternateFocus = focus === 'global' ? 'project' : 'global';
  const activeItem = [...GLOBAL_NAV_ITEMS, ...PROJECT_NAV_ITEMS].find((item) => matchesRoute(router.pathname, item.href));
  const layerMeta = PLATFORM_LAYER_META[focus];
  const alternateLayerMeta = PLATFORM_LAYER_META[alternateFocus];
  const detailVisibilityClass = sidebarCollapsed ? 'xl:hidden' : '';

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const storedValue = window.localStorage.getItem(SIDEBAR_STATE_KEY);
    setSidebarCollapsed(storedValue === '1');
  }, []);

  function toggleSidebar() {
    setSidebarCollapsed((current) => {
      const nextValue = !current;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(SIDEBAR_STATE_KEY, nextValue ? '1' : '0');
      }
      return nextValue;
    });
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_28%),radial-gradient(circle_at_78%_0%,_rgba(245,158,11,0.14),_transparent_22%),linear-gradient(180deg,#f4efe4_0%,#f7f3eb_40%,#eef4f7_100%)] text-slate-900">
      <div className="mx-auto max-w-[1680px] px-4 py-6 sm:px-6 lg:px-8">
        <div className={`grid gap-6 ${sidebarCollapsed ? 'xl:grid-cols-[92px_minmax(0,1fr)]' : 'xl:grid-cols-[308px_minmax(0,1fr)]'}`}>
          <aside className="xl:sticky xl:top-28 xl:self-start">
            <div className="overflow-hidden rounded-[32px] border border-stone-200/80 bg-[rgba(255,255,255,0.82)] p-4 shadow-[0_24px_60px_rgba(148,163,184,0.16)] backdrop-blur-xl">
              <div className="flex items-center justify-between gap-3">
                <Link href="/home" className={`flex min-w-0 items-center gap-3 ${sidebarCollapsed ? 'xl:justify-center' : ''}`}>
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0f766e,#0ea5e9)] text-white shadow-[0_16px_34px_rgba(14,116,144,0.16)]">
                    <BrandIcon className="h-5 w-5" />
                  </span>
                  <span className={`min-w-0 ${detailVisibilityClass}`}>
                    <span className="block text-[10px] uppercase tracking-[0.34em] text-sky-700/70">Nexora</span>
                    <span className="block truncate text-base font-semibold tracking-tight text-slate-900">Platform workspaces</span>
                  </span>
                </Link>

                <button
                  type="button"
                  onClick={toggleSidebar}
                  className="hidden h-10 w-10 items-center justify-center rounded-2xl border border-stone-200 bg-white text-slate-600 transition hover:bg-stone-50 xl:inline-flex"
                  aria-label={sidebarCollapsed ? 'Expand navigation sidebar' : 'Collapse navigation sidebar'}
                >
                  <SidebarToggleIcon collapsed={sidebarCollapsed} className="h-4 w-4" />
                </button>
              </div>

              <div className={`mt-4 rounded-[26px] border border-sky-200 bg-[linear-gradient(180deg,rgba(240,249,255,0.95),rgba(236,253,245,0.8))] px-4 py-4 ${detailVisibilityClass}`}>
                <div className="text-[10px] uppercase tracking-[0.32em] text-sky-700/70">Navigation model</div>
                <div className="mt-2 text-lg font-semibold tracking-tight text-slate-900">One rail, one active context</div>
                <div className="mt-2 text-sm leading-6 text-slate-600">The shell keeps the primary layer, current surface, and project context in one place so each page reads like part of a single product.</div>
              </div>

              <div className="mt-5 grid gap-2">
                {Object.entries(PLATFORM_LAYER_META).map(([layerKey, meta]) => {
                  const isActive = layerKey === focus;
                  return (
                    <Link
                      key={layerKey}
                      href={buildLayerHref(layerKey, meta.entryHref, navigationContext)}
                      title={meta.label}
                      className={`group flex items-center gap-3 rounded-2xl border px-3 py-3 transition ${
                        isActive
                          ? 'border-sky-200 bg-sky-50 text-sky-700 shadow-[0_12px_28px_rgba(125,211,252,0.2)]'
                          : 'border-stone-200 bg-white/75 text-slate-700 hover:bg-stone-50'
                      } ${sidebarCollapsed ? 'xl:justify-center' : ''}`}
                    >
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${
                        isActive ? 'border-sky-200 bg-white text-sky-700' : 'border-stone-200 bg-stone-50 text-slate-500'
                      }`}>
                        <LayerIcon layer={layerKey} className="h-4 w-4" />
                      </span>
                      <span className={`min-w-0 ${detailVisibilityClass}`}>
                        <span className="block text-sm font-semibold">{meta.label}</span>
                        <span className="mt-1 block text-xs leading-5 text-slate-500">{meta.description}</span>
                      </span>
                    </Link>
                  );
                })}
              </div>

              <div className="mt-5 space-y-2">
                {primaryItems.map((item) => {
                  const isActive = matchesRoute(router.pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={buildNavigationItemHref(item, navigationContext)}
                      title={item.label}
                      className={`group flex items-center gap-3 rounded-2xl border px-3 py-3 transition ${
                        isActive
                          ? 'border-sky-200 bg-sky-50 text-slate-900 shadow-[0_12px_28px_rgba(125,211,252,0.16)]'
                          : 'border-stone-200 bg-stone-50/70 text-slate-700 hover:bg-white'
                      } ${sidebarCollapsed ? 'xl:justify-center' : ''}`}
                    >
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${
                        isActive ? 'border-sky-200 bg-white text-sky-700' : 'border-stone-200 bg-white text-slate-500'
                      }`}>
                        <NavigationIcon href={item.href} className="h-4 w-4" />
                      </span>
                      <span className={`min-w-0 ${detailVisibilityClass}`}>
                        <span className="block text-sm font-semibold">{item.label}</span>
                        <span className="mt-1 block text-xs leading-5 text-slate-500">{item.description}</span>
                      </span>
                    </Link>
                  );
                })}
              </div>

              <div className={`mt-5 space-y-4 ${detailVisibilityClass}`}>
                <div className="rounded-[26px] border border-stone-200 bg-stone-50/80 px-4 py-4">
                  <div className="text-[10px] uppercase tracking-[0.3em] text-stone-500">Current layer</div>
                  <div className="mt-2 text-base font-semibold text-slate-900">{layerMeta.label}</div>
                  <div className="mt-2 text-sm leading-6 text-slate-600">{activeItem?.description || layerMeta.description}</div>
                </div>

                <div className="rounded-[26px] border border-stone-200 bg-stone-50/80 px-4 py-4">
                  <div className="text-[10px] uppercase tracking-[0.3em] text-stone-500">Switch layer</div>
                  <div className="mt-2 text-sm leading-6 text-slate-600">{alternateLayerMeta.description}</div>
                  <Link href={buildLayerHref(alternateFocus, alternateLayerMeta.entryHref, navigationContext)} className="mt-4 inline-flex rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-stone-50">
                    Open {alternateLayerMeta.label}
                  </Link>
                </div>

                {aside ? (
                  <div className="rounded-[26px] border border-stone-200 bg-stone-50/80 p-4">
                    <div className="text-[10px] uppercase tracking-[0.3em] text-stone-500">Context</div>
                    <div className="mt-3">{aside}</div>
                  </div>
                ) : null}
              </div>
            </div>
          </aside>

          <div className="min-w-0">
            <section className="overflow-hidden rounded-[34px] border border-stone-200/80 bg-[rgba(255,255,255,0.76)] px-6 py-7 shadow-[0_24px_70px_rgba(148,163,184,0.14)] backdrop-blur-xl lg:px-8">
              <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-sky-700/72">
                    <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5">{eyebrow}</span>
                    <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-slate-600">{layerMeta.label}</span>
                  </div>
                  <h1 className="mt-4 max-w-5xl text-3xl font-semibold tracking-tight text-slate-900 lg:text-5xl">{title}</h1>
                  {description ? <p className="mt-4 max-w-4xl text-base leading-7 text-slate-600 lg:text-lg">{description}</p> : null}
                  <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-600">
                    <span className="rounded-full border border-stone-200 bg-white px-3 py-2">{activeItem?.label || 'Platform workspace'}</span>
                    <span className="rounded-full border border-stone-200 bg-white px-3 py-2">{primaryItems.length} surfaces in this layer</span>
                    {focus === 'project' && navigationContext?.projectId ? <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-2 text-sky-700">Project scoped</span> : null}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:w-[360px]">
                  <div className="rounded-[26px] border border-stone-200 bg-stone-50/80 px-4 py-4">
                    <div className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Current surface</div>
                    <div className="mt-2 text-base font-semibold text-slate-900">{activeItem?.label || layerMeta.label}</div>
                    <div className="mt-2 text-sm leading-6 text-slate-600">{activeItem?.description || layerMeta.description}</div>
                  </div>
                  <div className="rounded-[26px] border border-stone-200 bg-stone-50/80 px-4 py-4">
                    <div className="text-[10px] uppercase tracking-[0.28em] text-stone-500">Working model</div>
                    <div className="mt-2 text-base font-semibold text-slate-900">{focus === 'global' ? 'Shared operations' : 'Project delivery'}</div>
                    <div className="mt-2 text-sm leading-6 text-slate-600">
                      {focus === 'global'
                        ? 'Portfolio, runtime, connections, and governance stay reachable without crowding each project page.'
                        : 'Migration, flow, notebooks, catalog, and ML stay anchored to the same project and workspace context.'}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <div className="mt-5 overflow-x-auto xl:hidden">
              <div className="flex min-w-max gap-2 rounded-[24px] border border-stone-200 bg-white/75 p-2 backdrop-blur-sm">
                {primaryItems.map((item) => {
                  const isActive = matchesRoute(router.pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={buildNavigationItemHref(item, navigationContext)}
                      className={`rounded-[20px] px-4 py-3 text-sm font-semibold transition ${
                        isActive ? 'bg-sky-50 text-sky-700' : 'text-slate-600 hover:bg-stone-50 hover:text-slate-900'
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>

            {actions ? <div className="mt-5">{actions}</div> : null}

            <div className="mt-6 grid gap-6">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}