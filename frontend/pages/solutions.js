import Link from 'next/link';

import MarketingLayout from '../components/MarketingLayout';

const INDUSTRIES = [
  {
    title: 'Financial services',
    description: 'Modernize regulated analytics pipelines, audit-heavy reporting, and warehouse logic without losing governance control.',
  },
  {
    title: 'Life sciences',
    description: 'Translate research, clinical, and quality workflows into governed modern stacks with clearer operating boundaries.',
  },
  {
    title: 'Manufacturing',
    description: 'Rebuild supply, planning, and operational reporting pipelines while keeping transformation programs visible across teams.',
  },
  {
    title: 'Retail and CPG',
    description: 'Move legacy merchandising, planning, and customer analytics into dedicated data product workspaces.',
  },
];

const PROGRAM_STEPS = [
  'Discover the estate and identify high-value migration candidates.',
  'Convert and validate code in isolated workspaces with review paths.',
  'Promote assets through projects, catalog, operations, governance, and ML pages.',
];

export default function SolutionsPage() {
  return (
    <MarketingLayout>
      <section className="mx-auto max-w-7xl px-4 pb-12 pt-14 sm:px-6 lg:px-8 lg:pt-20">
        <div className="max-w-4xl">
          <div className="text-[11px] uppercase tracking-[0.34em] text-slate-500">Solutions</div>
          <h1 className="mt-4 text-5xl font-semibold tracking-[-0.04em] text-slate-950 lg:text-6xl">
            Solution pages explain who Nexora is for, without turning the homepage into a catalog dump.
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600">
            This page is where industry and transformation-program framing belongs. The public site stays narrative here, while the product pages stay operational elsewhere.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {INDUSTRIES.map((industry) => (
            <div key={industry.title} className="rounded-[28px] border border-slate-900/10 bg-white/78 p-6 shadow-[0_18px_36px_rgba(15,23,42,0.08)]">
              <div className="text-[11px] uppercase tracking-[0.26em] text-slate-500">Industry</div>
              <div className="mt-3 text-2xl font-semibold text-slate-950">{industry.title}</div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{industry.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[32px] border border-slate-900/10 bg-slate-950 p-8 text-white shadow-[0_30px_60px_rgba(15,23,42,0.22)]">
            <div className="text-[11px] uppercase tracking-[0.32em] text-cyan-200/70">Program shape</div>
            <h2 className="mt-4 text-3xl font-semibold">Nexora fits multi-phase modernization programs.</h2>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              Solutions pages should show the transformation motion and expected operating model before users enter the application itself.
            </p>
          </div>

          <div className="rounded-[32px] border border-slate-900/10 bg-white/80 p-8 shadow-[0_20px_40px_rgba(15,23,42,0.08)]">
            <div className="text-[11px] uppercase tracking-[0.32em] text-slate-500">Typical engagement</div>
            <div className="mt-5 space-y-4">
              {PROGRAM_STEPS.map((step) => (
                <div key={step} className="rounded-2xl border border-slate-900/10 bg-[#f7f2e8] px-5 py-4 text-sm leading-6 text-slate-700">
                  {step}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="rounded-[36px] border border-slate-900/10 bg-[#dcfce7] px-8 py-10 shadow-[0_30px_60px_rgba(34,197,94,0.12)] lg:flex lg:items-center lg:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.32em] text-slate-500">Continue</div>
            <h2 className="mt-4 max-w-2xl text-3xl font-semibold text-slate-950">Use the demo page for a guided walkthrough, then enter the product pages for execution.</h2>
          </div>
          <div className="mt-6 flex flex-wrap gap-3 lg:mt-0">
            <Link href="/demo" className="rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800">
              View demo flow
            </Link>
            <Link href="/product" className="rounded-full border border-slate-900/12 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-white/70">
              View product map
            </Link>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}