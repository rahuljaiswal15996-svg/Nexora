import '../styles/globals.css'
// import Header from '../components/Header'
// import ErrorBoundary from '../components/ErrorBoundary'

function MyApp({ Component, pageProps }) {
  return (
    // <ErrorBoundary>
      <div className="min-h-screen bg-background text-accent">
        {/* <Header /> */}
        <main className="flex-1">
          <Component {...pageProps} />
        </main>
      </div>
    // </ErrorBoundary>
  )
}

export default MyApp