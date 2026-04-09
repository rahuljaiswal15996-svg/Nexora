import Link from 'next/link';

import MarketingLayout from '../components/MarketingLayout';

const WORKSPACES = [
  {
    href: '/upload',
    title: 'Conversion workspace',
    description: 'Parse legacy code, control source and target language selection, and generate transformed output.',
  },
  {
    href: '/compare',
    title: 'Validation workspace',
    description: 'Review original and converted logic side by side with metrics, history, and diff output.',
  },
  {
    href: '/connections',
    title: 'Connections workspace',
    description: 'Register external storage and warehouse connectivity instead of mixing setup into the landing page.',
  },
  {
    href: '/notebooks',
    title: 'Notebook workspace',
    description: 'Work interactively in notebooks without collapsing collaboration and execution into the homepage.',
  },
  {
    href: '/pipelines',
    title: 'Pipeline workspace',
    description: 'Handle DAG editing, orchestration, and optimization in a purpose-built page.',
  },
  {
    href: '/home',
    title: 'Home summary',
    description: 'Start from a summary-only home page, then move into runtime, governance, and project workspaces as needed.',
  },
];

const PLATFORM_PILLARS = [
  {
    title: 'Modular user journey',
    description: 'Visitors first understand the platform on marketing pages, then move into the correct operating area.',
  },
  {
    title: 'Dedicated operating routes',
    description: 'Each workflow has a route of its own, which keeps state, navigation, and responsibilities clearer.',
  },
  {
    title: 'Enterprise control plane',
    description: 'Projects, catalog, operations, governance, and ML have already been split into dedicated platform pages.',
  },
];

export default function ProductPage() {
  return (
    <MarketingLayout>
      <section className="mx-auto max-w-7xl px-4 pb-12 pt-14 sm:px-6 lg:px-8 lg:pb-16 lg:pt-20">
        <div className="max-w-4xl">
          <div className="text-[11px] uppercase tracking-[0.34em] text-slate-500">Product</div>
          <h1 className="mt-4 text-5xl font-semibold tracking-[-0.04em] text-slate-950 lg:text-6xl">
            One platform, separated into the workspaces teams actually need.
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600">
            Nexora is no longer presented as a single overloaded front page. The product map below shows where each workflow lives and how users move from exploration into execution.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {PLATFORM_PILLARS.map((pillar) => (
            <div key={pillar.title} className="rounded-[28px] border border-slate-900/10 bg-white/76 p-7 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
              <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Design principle</div>
              <h2 className="mt-4 text-2xl font-semibold text-slate-950">{pillar.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">{pillar.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.32em] text-slate-500">Workspace map</div>
            <h2 className="mt-3 text-3xl font-semibold text-slate-950 lg:text-4xl">Application areas that now belong on their own routes.</h2>
          </div>
          <p className="max-w-2xl text-sm leading-6 text-slate-600">
            These links move directly into the operating product. They should remain separate from the introductory website pages.
          </p>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {WORKSPACES.map((workspace) => (
            <Link
              key={workspace.href}
              href={workspace.href}
              className="rounded-[28px] border border-slate-900/10 bg-white/82 p-6 shadow-[0_20px_36px_rgba(15,23,42,0.08)] transition hover:-translate-y-1 hover:bg-white"
            >
              <div className="text-[11px] uppercase tracking-[0.26em] text-slate-500">Application page</div>
              <div className="mt-3 text-2xl font-semibold text-slate-950">{workspace.title}</div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{workspace.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="rounded-[36px] border border-slate-900/10 bg-[#dbeafe] px-8 py-10 shadow-[0_30px_60px_rgba(59,130,246,0.12)] lg:flex lg:items-center lg:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.32em] text-slate-500">Launch</div>
            <h2 className="mt-4 max-w-2xl text-3xl font-semibold text-slate-950">Start in the control-plane hub or go directly into the conversion workflow.</h2>
          </div>
          <div className="mt-6 flex flex-wrap gap-3 lg:mt-0">
            <Link href="/home" className="rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800">
              Open home summary
            </Link>
            <Link href="/upload" className="rounded-full border border-slate-900/12 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-white/70">
              Open conversion workspace
            </Link>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}