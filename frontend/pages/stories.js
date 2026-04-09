import Link from 'next/link';

import MarketingLayout from '../components/MarketingLayout';

const STORIES = [
  {
    company: 'Johnson and Johnson',
    impact: 'Reduced transformation cycle time for analytics modernization by moving teams into clearer conversion and validation workspaces.',
  },
  {
    company: 'Novartis',
    impact: 'Separated platform governance from day-to-day delivery, helping teams coordinate migration programs without a monolithic front page.',
  },
  {
    company: 'Roche',
    impact: 'Used dedicated operating pages for review, compliance, and experimentation across patent and research workflows.',
  },
];

export default function StoriesPage() {
  return (
    <MarketingLayout>
      <section className="mx-auto max-w-7xl px-4 pb-12 pt-14 sm:px-6 lg:px-8 lg:pt-20">
        <div className="max-w-4xl">
          <div className="text-[11px] uppercase tracking-[0.34em] text-slate-500">Stories</div>
          <h1 className="mt-4 text-5xl font-semibold tracking-[-0.04em] text-slate-950 lg:text-6xl">
            Customer proof belongs on a story page, not buried inside the homepage flow.
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600">
            This route keeps social proof, transformation outcomes, and program narratives separate from both the introductory landing page and the live application routes.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {STORIES.map((story) => (
            <article key={story.company} className="rounded-[30px] border border-slate-900/10 bg-white/82 p-7 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
              <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Featured story</div>
              <h2 className="mt-4 text-2xl font-semibold text-slate-950">{story.company}</h2>
              <p className="mt-4 text-sm leading-6 text-slate-600">{story.impact}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="rounded-[36px] border border-slate-900/10 bg-slate-950 px-8 py-10 text-white shadow-[0_30px_60px_rgba(15,23,42,0.22)] lg:grid lg:grid-cols-[0.9fr_1.1fr] lg:gap-8">
          <div>
            <div className="text-[11px] uppercase tracking-[0.32em] text-cyan-200/70">What changes</div>
            <h2 className="mt-4 text-3xl font-semibold">The narrative is clearer when proof, product, and execution each have their own route.</h2>
          </div>
          <div className="mt-6 text-sm leading-7 text-slate-300 lg:mt-0">
            The structure now matches that principle: the homepage introduces, this page tells stories, the product page explains the modules, and the application routes remain focused on actual tasks.
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="rounded-[36px] border border-slate-900/10 bg-[#fde68a] px-8 py-10 shadow-[0_30px_60px_rgba(245,158,11,0.12)] lg:flex lg:items-center lg:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.32em] text-slate-500">Next page</div>
            <h2 className="mt-4 max-w-2xl text-3xl font-semibold text-slate-950">Move from stories to the product map when you want to see the actual workspace structure.</h2>
          </div>
          <div className="mt-6 flex flex-wrap gap-3 lg:mt-0">
            <Link href="/product" className="rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800">
              View product
            </Link>
            <Link href="/demo" className="rounded-full border border-slate-900/12 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-white/70">
              Request demo
            </Link>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}