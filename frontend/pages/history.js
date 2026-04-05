import { useEffect, useState } from "react";
import { fetchHistory, clearHistory } from "../services/history";

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
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">Conversion History</h1>
          <p className="text-gray-600">Review previous conversions saved by the backend.</p>
          <button
            onClick={handleClear}
            className="mt-4 px-4 py-2 bg-secondary text-accent rounded-lg hover:bg-gray-200"
          >
            Clear history
          </button>
        </header>

        {loading ? (
          <div className="text-center text-gray-500">Loading history...</div>
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
                  <span className="text-sm text-gray-500">{new Date(entry.timestamp).toLocaleString()}</span>
                </div>
                <div className="mb-4 text-gray-700">{entry.summary}</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="font-semibold text-gray-800">Similarity</div>
                    <div className="text-gray-600">{entry.similarity_ratio}</div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="font-semibold text-gray-800">Diff count</div>
                    <div className="text-gray-600">{entry.diff_count}</div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="font-semibold text-gray-800">Original length</div>
                    <div className="text-gray-600">{entry.original_length}</div>
                  </div>
                </div>
                <div className="text-sm text-gray-600">
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
