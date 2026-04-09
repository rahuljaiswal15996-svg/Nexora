import Link from 'next/link';

import MarketingLayout from '../components/MarketingLayout';

const PRINCIPLES = [
  {
    title: 'Clarity over clutter',
    description: 'The public site explains the platform. The application routes are reserved for actual work.',
  },
  {
    title: 'Enterprise operating model',
    description: 'Projects, governance, operations, and ML are treated as first-class control-plane concerns.',
  },
  {
    title: 'Incremental modernization',
    description: 'Teams can start with conversion and validation, then expand into broader platform programs.',
  },
];

export default function CompanyPage() {
  return (
    <MarketingLayout>
      <section className="mx-auto max-w-7xl px-4 pb-12 pt-14 sm:px-6 lg:px-8 lg:pt-20">
        <div className="max-w-4xl">
          <div className="text-[11px] uppercase tracking-[0.34em] text-slate-500">Company</div>
          <h1 className="mt-4 text-5xl font-semibold tracking-[-0.04em] text-slate-950 lg:text-6xl">
            The company page should explain the point of view behind the product structure.
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600">
            Nexora is designed around a simple principle: public explanation and application execution should not compete for the same page. That separation now shows up in the site architecture itself.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
        <div className="grid gap-5 lg:grid-cols-3">
          {PRINCIPLES.map((principle) => (
            <div key={principle.title} className="rounded-[28px] border border-slate-900/10 bg-white/78 p-6 shadow-[0_18px_36px_rgba(15,23,42,0.08)]">
              <div className="text-[11px] uppercase tracking-[0.26em] text-slate-500">Principle</div>
              <h2 className="mt-3 text-2xl font-semibold text-slate-950">{principle.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">{principle.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-[32px] border border-slate-900/10 bg-white/82 p-8 shadow-[0_20px_40px_rgba(15,23,42,0.08)]">
            <div className="text-[11px] uppercase tracking-[0.32em] text-slate-500">Operating model</div>
            <h2 className="mt-4 text-3xl font-semibold text-slate-950">Website for orientation. Workspace routes for action.</h2>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              Visitors can now learn about Nexora through dedicated menu pages first. Once they are ready to do work, they move into the product routes such as upload, compare, pipelines, notebooks, and the platform hub.
            </p>
          </div>

          <div className="rounded-[32px] border border-slate-900/10 bg-slate-950 p-8 text-white shadow-[0_30px_60px_rgba(15,23,42,0.22)]">
            <div className="text-[11px] uppercase tracking-[0.32em] text-cyan-200/70">Why it matters</div>
            <h2 className="mt-4 text-3xl font-semibold">The product feels more credible when each page has a single job.</h2>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              That is the direction this restructure takes: less homepage overload, clearer navigation, and a more believable enterprise product posture.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="rounded-[36px] border border-slate-900/10 bg-[#fecaca] px-8 py-10 shadow-[0_30px_60px_rgba(239,68,68,0.12)] lg:flex lg:items-center lg:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.32em] text-slate-500">Continue</div>
            <h2 className="mt-4 max-w-2xl text-3xl font-semibold text-slate-950">See the product map next, then open the live platform hub when you want to operate the app.</h2>
          </div>
          <div className="mt-6 flex flex-wrap gap-3 lg:mt-0">
            <Link href="/product" className="rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800">
              View product map
            </Link>
            <Link href="/home" className="rounded-full border border-slate-900/12 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-white/70">
              Open home summary
            </Link>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}