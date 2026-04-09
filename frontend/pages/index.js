import Link from 'next/link';

import MarketingLayout from '../components/MarketingLayout';

const EXPLORATION_PAGES = [
  {
    href: '/product',
    label: 'Product',
    description: 'See the workspace model, operating modules, and how the application is split by outcome.',
  },
  {
    href: '/solutions',
    label: 'Solutions',
    description: 'Review the industry motions and transformation programs Nexora is designed to support.',
  },
  {
    href: '/stories',
    label: 'Stories',
    description: 'Read outcome-driven narratives instead of packing customer proof into the homepage.',
  },
  {
    href: '/company',
    label: 'Company',
    description: 'Understand the team, operating model, and why the platform is structured the way it is.',
  },
];

const OUTCOME_PILLARS = [
  {
    title: 'Modernize legacy logic',
    description: 'Convert legacy SQL, SAS, analytics scripts, and warehouse procedures into governed modern workflows.',
  },
  {
    title: 'Operate in dedicated workspaces',
    description: 'Keep conversion, validation, connections, notebooks, and control-plane tasks on separate pages instead of one crowded screen.',
  },
  {
    title: 'Scale with governance',
    description: 'Move from individual migrations to project, catalog, operations, governance, and ML workstreams.',
  },
];

const APPLICATION_ENTRIES = [
  { href: '/upload', label: 'Conversion workspace' },
  { href: '/compare', label: 'Validation workspace' },
  { href: '/home', label: 'Home summary' },
  { href: '/notebooks', label: 'Jupyter workspace' },
];

export default function Home() {
  return (
    <MarketingLayout>
      <section className="mx-auto grid max-w-7xl gap-10 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:px-8 lg:pb-24 lg:pt-20">
        <div>
          <div className="inline-flex rounded-full border border-slate-900/10 bg-white/70 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.34em] text-slate-600 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
            Introductory landing page
          </div>
          <h1 className="mt-6 max-w-4xl text-5xl font-semibold tracking-[-0.04em] text-slate-950 lg:text-7xl">
            Enterprise data modernization, introduced clearly and operated in separate workspaces.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600 lg:text-xl">
            Nexora now presents the public website as a focused introduction. Product detail, solutions, stories, company content, and the live application each have their own dedicated route.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/product"
              className="rounded-full bg-slate-950 px-6 py-3 text-sm font-medium text-white shadow-[0_18px_30px_rgba(15,23,42,0.2)] transition hover:bg-slate-800"
            >
              Explore product
            </Link>
            <Link
              href="/demo"
              className="rounded-full border border-slate-900/12 px-6 py-3 text-sm font-medium text-slate-700 transition hover:bg-white/70 hover:text-slate-950"
            >
              Request demo
            </Link>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <div className="rounded-[32px] border border-slate-900/10 bg-slate-950 p-8 text-white shadow-[0_30px_60px_rgba(15,23,42,0.22)]">
            <div className="text-[11px] uppercase tracking-[0.32em] text-cyan-200/70">Site structure</div>
            <div className="mt-4 text-3xl font-semibold">Public site up front. Application behind focused routes.</div>
            <div className="mt-4 text-sm leading-6 text-slate-300">
              The landing page is now intentionally short. Menu items open dedicated pages, and application work happens inside the workspace routes.
            </div>
          </div>
          <div className="rounded-[32px] border border-slate-900/10 bg-white/75 p-8 shadow-[0_24px_50px_rgba(15,23,42,0.08)] backdrop-blur-sm">
            <div className="text-[11px] uppercase tracking-[0.32em] text-slate-500">Launch points</div>
            <div className="mt-5 grid gap-3">
              {APPLICATION_ENTRIES.map((entry) => (
                <Link
                  key={entry.href}
                  href={entry.href}
                  className="rounded-2xl border border-slate-900/10 bg-[#f7f2e8] px-4 py-4 text-sm font-medium text-slate-700 transition hover:-translate-y-0.5 hover:bg-white hover:text-slate-950"
                >
                  {entry.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {OUTCOME_PILLARS.map((pillar) => (
            <div key={pillar.title} className="rounded-[28px] border border-slate-900/10 bg-white/72 p-7 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm">
              <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Outcome</div>
              <h2 className="mt-4 text-2xl font-semibold text-slate-950">{pillar.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">{pillar.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.32em] text-slate-500">Explore the site</div>
            <h2 className="mt-3 text-3xl font-semibold text-slate-950 lg:text-4xl">Every major menu item now has its own page.</h2>
          </div>
          <p className="max-w-2xl text-sm leading-6 text-slate-600">
            This keeps the homepage introductory and pushes deeper explanation into the routes visitors expect from the main navigation.
          </p>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {EXPLORATION_PAGES.map((page) => (
            <Link
              key={page.href}
              href={page.href}
              className="rounded-[28px] border border-slate-900/10 bg-white/78 p-6 shadow-[0_20px_36px_rgba(15,23,42,0.08)] transition hover:-translate-y-1 hover:bg-white"
            >
              <div className="text-[11px] uppercase tracking-[0.26em] text-slate-500">Menu page</div>
              <div className="mt-3 text-2xl font-semibold text-slate-950">{page.label}</div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{page.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="rounded-[36px] border border-slate-900/10 bg-slate-950 px-8 py-10 text-white shadow-[0_40px_90px_rgba(15,23,42,0.22)] lg:flex lg:items-center lg:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.32em] text-cyan-200/70">Next step</div>
            <h2 className="mt-4 max-w-2xl text-3xl font-semibold">Start with the product page, then move into the live workspaces when you want to operate the application.</h2>
          </div>
          <div className="mt-6 flex flex-wrap gap-3 lg:mt-0">
            <Link href="/product" className="rounded-full bg-white px-5 py-3 text-sm font-medium text-slate-950 transition hover:bg-slate-100">
              View product map
            </Link>
            <Link href="/home" className="rounded-full border border-white/20 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10">
              Open home summary
            </Link>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
