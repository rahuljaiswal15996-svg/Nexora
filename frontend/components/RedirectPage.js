import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

export default function RedirectPage({ href, title, description }) {
  const router = useRouter();

  useEffect(() => {
    const handle = window.setTimeout(() => {
      router.replace(href);
    }, 80);
    return () => window.clearTimeout(handle);
  }, [href, router]);

  return (
    <div className="min-h-[70vh] bg-background px-4 py-20 text-accent sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl rounded-[32px] border border-white/10 bg-surface/80 p-8 shadow-[0_32px_90px_rgba(0,0,0,0.32)]">
        <div className="text-xs uppercase tracking-[0.32em] text-cyan-200/70">Nexora Route Update</div>
        <h1 className="mt-4 text-4xl font-semibold text-white">{title}</h1>
        <p className="mt-4 text-base leading-7 text-accent/72">{description}</p>
        <Link href={href} className="mt-8 inline-flex rounded-2xl border border-cyan-300/25 bg-cyan-300/10 px-5 py-3 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-300/15">
          Open the focused workspace
        </Link>
      </div>
    </div>
  );
}