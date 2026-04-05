import { useEffect } from 'react';

import Header from '../components/Header';
import { ensureDevSession } from '../services/api';
import '../styles/globals.css'

function MyApp({ Component, pageProps }) {
  useEffect(() => {
    ensureDevSession().catch((error) => {
      console.error('Failed to initialize Nexora session', error);
    });
  }, []);

  return (
      <div className="min-h-screen bg-background text-accent">
        <Header />
        <main className="flex-1">
          <Component {...pageProps} />
        </main>
      </div>
  )
}

export default MyApp