import Link from 'next/link';
import { useRouter } from 'next/router';

const NAV_ITEMS = [
  { href: '/product', label: 'Product' },
  { href: '/solutions', label: 'Solutions' },
  { href: '/stories', label: 'Stories' },
  { href: '/company', label: 'Company' },
  { href: '/demo', label: 'Demo' },
];

const FOOTER_LINKS = [
  { href: '/home', label: 'Home summary' },
  { href: '/upload', label: 'Conversion workspace' },
  { href: '/compare', label: 'Validation workspace' },
  { href: '/notebooks', label: 'Jupyter workspace' },
];

export default function MarketingLayout({ children }) {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(14,116,144,0.12),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(37,99,235,0.18),_transparent_24%),linear-gradient(180deg,#f7f2e8_0%,#f6f1e7_42%,#f3ede0_100%)] text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-900/10 bg-[#f7f2e8]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-sm font-semibold text-white shadow-[0_18px_32px_rgba(15,23,42,0.22)]">
              NX
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.34em] text-slate-500">Nexora</div>
              <div className="text-base font-semibold text-slate-950">AI modernization for enterprise data teams</div>
            </div>
          </Link>

          <nav className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
            {NAV_ITEMS.map((item) => {
              const isActive = router.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-full px-4 py-2 transition ${
                    isActive ? 'bg-slate-950 text-white' : 'hover:bg-white/70 hover:text-slate-950'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/demo"
              className="rounded-full border border-slate-900/12 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-white/70 hover:text-slate-950"
            >
              Request demo
            </Link>
            <Link
              href="/home"
              className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white shadow-[0_16px_30px_rgba(15,23,42,0.22)] transition hover:bg-slate-800"
            >
              Open workspace
            </Link>
          </div>
        </div>
      </header>

      <main>{children}</main>

      <footer className="border-t border-slate-900/10 bg-[#efe7d8]">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
          <div>
            <div className="text-[11px] uppercase tracking-[0.34em] text-slate-500">Nexora</div>
            <h2 className="mt-3 max-w-xl text-2xl font-semibold text-slate-950">A clearer split between the public website and the operating application.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              The public site explains the platform, while the application workspaces stay focused on conversion, validation, operations, governance, and ML delivery.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {FOOTER_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-3xl border border-slate-900/10 bg-white/70 px-5 py-4 text-sm text-slate-700 transition hover:-translate-y-0.5 hover:bg-white"
              >
                <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Workspace</div>
                <div className="mt-2 text-base font-semibold text-slate-950">{item.label}</div>
              </Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}