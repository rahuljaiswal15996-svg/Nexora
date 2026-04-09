import Link from 'next/link';

import MarketingLayout from '../components/MarketingLayout';

const DEMO_FLOW = [
  {
    step: '01',
    title: 'Estate intake',
    description: 'Start with a sample legacy asset and show how conversion is launched in the dedicated upload workspace.',
  },
  {
    step: '02',
    title: 'Validation pass',
    description: 'Move to compare and review so stakeholders can inspect diffs and conversion metrics on a separate page.',
  },
  {
    step: '03',
    title: 'Operational rollout',
    description: 'Finish in the platform hub to show projects, catalog, operations, governance, and ML as distinct enterprise pages.',
  },
];

export default function DemoPage() {
  return (
    <MarketingLayout>
      <section className="mx-auto max-w-7xl px-4 pb-12 pt-14 sm:px-6 lg:px-8 lg:pt-20">
        <div className="max-w-4xl">
          <div className="text-[11px] uppercase tracking-[0.34em] text-slate-500">Demo</div>
          <h1 className="mt-4 text-5xl font-semibold tracking-[-0.04em] text-slate-950 lg:text-6xl">
            A demo page should guide the journey instead of sending users through a single overloaded homepage.
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600">
            This route frames the sequence you would walk through in a product demonstration: conversion, validation, and platform operations, each on its own page.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
        <div className="grid gap-5 lg:grid-cols-3">
          {DEMO_FLOW.map((item) => (
            <div key={item.step} className="rounded-[28px] border border-slate-900/10 bg-white/80 p-7 shadow-[0_18px_36px_rgba(15,23,42,0.08)]">
              <div className="text-sm font-semibold text-slate-500">{item.step}</div>
              <h2 className="mt-3 text-2xl font-semibold text-slate-950">{item.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="rounded-[36px] border border-slate-900/10 bg-slate-950 px-8 py-10 text-white shadow-[0_30px_60px_rgba(15,23,42,0.22)] lg:flex lg:items-center lg:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.32em] text-cyan-200/70">Live route examples</div>
            <h2 className="mt-4 max-w-2xl text-3xl font-semibold">The demo should move between real workspaces, not simulate everything on the landing page.</h2>
          </div>
          <div className="mt-6 flex flex-wrap gap-3 lg:mt-0">
            <Link href="/upload" className="rounded-full bg-white px-5 py-3 text-sm font-medium text-slate-950 transition hover:bg-slate-100">
              Open upload
            </Link>
            <Link href="/compare" className="rounded-full border border-white/20 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10">
              Open compare
            </Link>
            <Link href="/home" className="rounded-full border border-white/20 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10">
              Open home
            </Link>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}