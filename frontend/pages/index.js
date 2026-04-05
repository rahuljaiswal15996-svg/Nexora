import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8">
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-primary mb-2">Nexora</h1>
        <p className="text-gray-600 text-center">FastAPI backend + Next.js frontend for code upload, conversion, comparison, and history.</p>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl">
        <Link href="/compare" className="bg-white shadow-md rounded-lg p-6 hover:shadow-lg transition-shadow">
          <h2 className="text-xl font-semibold text-primary mb-2">Compare</h2>
          <p className="text-gray-600">Convert and compare code snippets side-by-side.</p>
        </Link>
        <Link href="/history" className="bg-white shadow-md rounded-lg p-6 hover:shadow-lg transition-shadow">
          <h2 className="text-xl font-semibold text-primary mb-2">History</h2>
          <p className="text-gray-600">View past conversions and results.</p>
        </Link>
        <Link href="/upload" className="bg-white shadow-md rounded-lg p-6 hover:shadow-lg transition-shadow">
          <h2 className="text-xl font-semibold text-primary mb-2">Upload / Parse</h2>
          <p className="text-gray-600">Upload files and parse to UIR.</p>
        </Link>
        <Link href="/pipelines" className="bg-white shadow-md rounded-lg p-6 hover:shadow-lg transition-shadow">
          <h2 className="text-xl font-semibold text-primary mb-2">Pipelines</h2>
          <p className="text-gray-600">Manage and run DAG-based pipelines.</p>
        </Link>
        <Link href="/review" className="bg-white shadow-md rounded-lg p-6 hover:shadow-lg transition-shadow">
          <h2 className="text-xl font-semibold text-primary mb-2">Review HITL</h2>
          <p className="text-gray-600">Review AI-generated conversions.</p>
        </Link>
      </div>
    </div>
  );
}
