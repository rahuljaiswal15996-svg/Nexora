import { useEffect, useState } from "react";
import CodeEditor from "../components/CodeEditor";
import DiffViewer from "../components/DiffViewer";
import { convertFile, convertText } from "../services/api";
import { fetchHistory, clearHistory, loadLocalHistory } from "../services/history";

const initialSample = `PROC SQL\nSELECT * FROM users;`;

export default function Compare() {
  const [file, setFile] = useState(null);
  const [code, setCode] = useState(initialSample);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setHistory(await fetchHistory());
      } catch (err) {
        setHistory(loadLocalHistory());
      }
    }
    load();
  }, []);

  const saveResult = async (data) => {
    const entry = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      summary: data.comparison.changed ? "Changed" : "No change",
      originalPreview: data.original.slice(0, 120),
      convertedPreview: data.converted.slice(0, 120),
      data,
    };

    setHistory((existing) => [entry, ...(existing || [])].slice(0, 20));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setResult(null);

    if (!file && !code.trim()) {
      setError("Please upload a file or paste code to convert.");
      return;
    }

    setLoading(true);

    try {
      const data = file ? await convertFile(file) : await convertText(code);
      setResult(data);
      saveResult(data);
      setHistory(await fetchHistory());
    } catch (err) {
      setError(err.message || "Conversion failed");
    } finally {
      setLoading(false);
    }
  };

  const handleHistoryLoad = (entry) => {
    setResult(entry.data);
  };

  const handleClearHistory = async () => {
    try {
      await clearHistory();
      setHistory([]);
    } catch (err) {
      setError(err.message || "Unable to clear history");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">Compare Code</h1>
          <p className="text-gray-600">Upload a file or paste code below, then convert and compare the original and transformed output.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-white shadow-md rounded-lg p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Upload code file:</label>
                <input
                  type="file"
                  accept=".sql,.txt,.sas,.txt"
                  onChange={(event) => setFile(event.target.files?.[0] || null)}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-blue-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Paste code directly</label>
                <textarea
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  rows={10}
                  className="w-full p-4 border border-gray-300 rounded-lg font-mono focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "Converting…" : "Convert & Compare"}
              </button>

              {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                  {error}
                </div>
              )}
            </form>
          </div>

          <div className="bg-white shadow-md rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-primary">Conversion History</h2>
              <button
                type="button"
                onClick={handleClearHistory}
                className="px-4 py-2 bg-secondary text-accent rounded-lg hover:bg-gray-200"
              >
                Clear history
              </button>
            </div>
            {history.length === 0 ? (
              <p className="text-gray-500">No history yet. Convert a file to save history.</p>
            ) : (
              <div className="space-y-3">
                {history.map((entry) => (
                  <button
                    type="button"
                    key={entry.id}
                    onClick={() => handleHistoryLoad(entry)}
                    className="w-full text-left p-4 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors"
                  >
                    <div className="font-semibold text-gray-800">{entry.summary}</div>
                    <div className="text-sm text-gray-500">{new Date(entry.timestamp).toLocaleString()}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {result && (
          <section className="bg-white shadow-md rounded-lg p-6">
            <h2 className="text-2xl font-semibold text-primary mb-6">Conversion Result</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div>
                <h3 className="text-lg font-medium text-gray-800 mb-2">Original</h3>
                <CodeEditor value={result.original} label="" readOnly />
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-800 mb-2">Converted</h3>
                <CodeEditor value={result.converted} label="" readOnly />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-gray-50 p-4 rounded-lg border">
                <h4 className="text-lg font-medium text-gray-800 mb-3">Metrics</h4>
                <ul className="space-y-1 text-sm text-gray-700">
                  <li>Changed: {result.comparison.changed ? "Yes" : "No"}</li>
                  <li>Original length: {result.comparison.original_length}</li>
                  <li>Converted length: {result.comparison.converted_length}</li>
                  <li>Original lines: {result.comparison.original_line_count}</li>
                  <li>Converted lines: {result.comparison.converted_line_count}</li>
                  <li>Similarity ratio: {result.comparison.similarity_ratio}</li>
                  <li>Diff tokens: {result.comparison.diff_count}</li>
                </ul>
              </div>
              <div className="lg:col-span-2 bg-gray-50 p-4 rounded-lg border">
                <h4 className="text-lg font-medium text-gray-800 mb-3">Enhanced Diff Viewer</h4>
                <DiffViewer original={result.original} converted={result.converted} />
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
