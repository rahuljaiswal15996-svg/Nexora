import Link from 'next/link';
import { useRouter } from 'next/router';

import { GOVERNANCE_DESK_ITEMS, matchesRoute } from '../lib/platformExperience';

export default function GovernanceDeskNav() {
  const router = useRouter();

  return (
    <div className="rounded-3xl border border-stone-200/80 bg-white/82 p-4 shadow-[0_18px_44px_rgba(148,163,184,0.12)]">
      <div className="text-[10px] uppercase tracking-[0.3em] text-stone-500">Governance Desk</div>
      <div className="mt-3 space-y-2">
        {GOVERNANCE_DESK_ITEMS.map((item) => {
          const isActive = matchesRoute(router.pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-2xl border px-4 py-3 transition ${
                isActive
                  ? 'border-sky-200 bg-sky-50 text-sky-700 shadow-[0_14px_30px_rgba(125,211,252,0.18)]'
                  : 'border-stone-200 bg-stone-50/80 text-slate-700 hover:border-stone-300 hover:bg-white'
              }`}
            >
              <div className="text-sm font-semibold">{item.label}</div>
              <div className="mt-1 text-xs leading-5 text-slate-500">{item.description}</div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}