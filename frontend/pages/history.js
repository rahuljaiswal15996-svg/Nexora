import { useEffect, useState } from "react";
import { fetchHistory, clearHistory } from "../services/history";
import LoadingSpinner from "../components/LoadingSpinner";

export default function History() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setHistory(await fetchHistory());
      } catch (err) {
        setError(err.message || "Unable to load history");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleClear = async () => {
    try {
      await clearHistory();
      setHistory([]);
    } catch (err) {
      setError(err.message || "Unable to clear history");
    }
  };

  return (
    <div className="bg-secondary min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">Conversion History</h1>
          <p className="text-accent">Review previous conversions saved by the backend.</p>
          <button
            onClick={handleClear}
            className="mt-4 px-4 py-2 bg-secondary text-accent rounded-lg hover:bg-gray-200 border border-gray-300"
          >
            Clear history
          </button>
        </div>

        {loading ? (
          <LoadingSpinner message="Loading history..." />
        ) : error ? (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        ) : history.length === 0 ? (
          <div className="text-center text-gray-500">No conversion history found.</div>
        ) : (
          <div className="space-y-6">
            {history.map((entry) => (
              <div key={entry.id} className="bg-white shadow-md rounded-lg p-6">
                <div className="flex justify-between items-start mb-4">
                  <span className="font-semibold text-lg text-gray-800">{entry.filename}</span>
                  <span className="text-sm text-accent/70">{new Date(entry.timestamp).toLocaleString()}</span>
                </div>
                <div className="mb-4 text-accent">{entry.summary}</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="bg-background p-4 rounded-lg border border-surface-hover">
                    <div className="font-semibold text-accent">Similarity</div>
                    <div className="text-accent/70">{entry.similarity_ratio}</div>
                  </div>
                  <div className="bg-background p-4 rounded-lg border border-surface-hover">
                    <div className="font-semibold text-accent">Diff count</div>
                    <div className="text-accent/70">{entry.diff_count}</div>
                  </div>
                  <div className="bg-background p-4 rounded-lg border border-surface-hover">
                    <div className="font-semibold text-accent">Original length</div>
                    <div className="text-accent/70">{entry.original_length}</div>
                  </div>
                </div>
                <div className="text-sm text-accent/70">
                  <div><strong>Original preview:</strong> {entry.original_preview}</div>
                  <div><strong>Converted preview:</strong> {entry.converted_preview}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
