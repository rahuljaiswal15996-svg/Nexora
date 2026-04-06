import Link from 'next/link';
import { useRouter } from 'next/router';

import { statusTone } from '../lib/platform';

const NAV_ITEMS = [
  { href: '/platform', label: 'Overview' },
  { href: '/projects', label: 'Projects' },
  { href: '/catalog', label: 'Catalog' },
  { href: '/operations', label: 'Operations' },
  { href: '/governance', label: 'Governance' },
  { href: '/ml', label: 'ML' },
];

export function PlatformPanel({ title, description, children, actions }) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-surface/80 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.28)]">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">{title}</h2>
          {description ? <p className="mt-2 max-w-3xl text-sm text-accent/70">{description}</p> : null}
        </div>
        {actions ? <div className="text-sm text-accent/60">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function MetricTile({ label, value, detail }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
      <div className="text-xs uppercase tracking-[0.28em] text-accent/50">{label}</div>
      <div className="mt-3 text-3xl font-semibold text-white">{value}</div>
      {detail ? <div className="mt-2 text-sm text-accent/70">{detail}</div> : null}
    </div>
  );
}

export function StatusPill({ status }) {
  return (
    <span className={`rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] ${statusTone(status)}`}>
      {status || 'unknown'}
    </span>
  );
}

export function EmptyState({ message }) {
  return <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-6 text-sm text-accent/60">{message}</div>;
}

export default function PlatformShell({ eyebrow = 'Nexora Platform', title, description, children, actions }) {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(0,85,204,0.22),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.18),_transparent_24%),linear-gradient(180deg,#080d18_0%,#0b1220_38%,#0f0f0f_100%)] text-accent">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[36px] border border-white/10 bg-black/20 shadow-[0_40px_120px_rgba(0,0,0,0.45)] backdrop-blur-sm">
          <div className="grid gap-6 px-6 py-8 lg:grid-cols-[1.1fr_0.9fr] lg:px-10 lg:py-10">
            <div>
              <div className="text-xs uppercase tracking-[0.36em] text-cyan-200/70">{eyebrow}</div>
              <h1 className="mt-4 max-w-4xl text-4xl font-semibold leading-tight text-white lg:text-5xl">{title}</h1>
              {description ? <p className="mt-4 max-w-3xl text-base leading-7 text-accent/72 lg:text-lg">{description}</p> : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {NAV_ITEMS.map((item) => {
                const isActive = router.pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-2xl border px-4 py-4 text-sm font-medium transition ${
                      isActive
                        ? 'border-cyan-300/30 bg-cyan-300/12 text-cyan-50'
                        : 'border-white/10 bg-white/5 text-accent/80 hover:bg-white/10'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {actions ? <div className="mt-6">{actions}</div> : null}

        <div className="mt-8 grid gap-8">{children}</div>
      </div>
    </div>
  );
}