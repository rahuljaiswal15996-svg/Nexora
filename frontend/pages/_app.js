import { useEffect } from 'react';
import { useRouter } from 'next/router';

import Header from '../components/Header';
import { ensureDevSession } from '../services/api';
import '../styles/globals.css'

const MARKETING_ROUTES = new Set(['/', '/product', '/solutions', '/stories', '/company', '/demo']);

function MyApp({ Component, pageProps }) {
  const router = useRouter();
  const isMarketingRoute = MARKETING_ROUTES.has(router.pathname);

  useEffect(() => {
    if (isMarketingRoute) {
      return undefined;
    }

    ensureDevSession().catch((error) => {
      console.error('Failed to initialize Nexora session', error);
    });
    return undefined;
  }, [isMarketingRoute]);

  return (
      <div className={isMarketingRoute ? 'min-h-screen bg-[#f5efe2] text-slate-900' : 'min-h-screen bg-[#f4efe4] text-slate-900'}>
        {!isMarketingRoute ? <Header /> : null}
        <main className="flex-1">
          <Component {...pageProps} />
        </main>
      </div>
  )
}

export default MyApp