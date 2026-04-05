import { useEffect, useState } from "react";
import CodeEditor from "../components/CodeEditor";
import DiffViewer from "../components/DiffViewer";
import { convertFile, convertText } from "../services/api";
import { fetchHistory, clearHistory, loadLocalHistory } from "../services/history";

const initialSample = `PROC SQL\nSELECT * FROM users;`;
const SOURCE_LANGUAGE_OPTIONS = [
  { value: "auto", label: "Auto-detect" },
  { value: "sas", label: "SAS / PROC SQL" },
  { value: "sql", label: "SQL" },
  { value: "python", label: "Python" },
  { value: "r", label: "R" },
  { value: "spark_sql", label: "Spark SQL" },
  { value: "scala", label: "Scala" },
  { value: "shell", label: "Shell" },
];
const TARGET_LANGUAGE_OPTIONS = [
  { value: "python", label: "Python" },
  { value: "sql", label: "SQL" },
  { value: "pyspark", label: "PySpark" },
  { value: "dbt", label: "dbt Model SQL" },
];

export default function Compare() {
  const [file, setFile] = useState(null);
  const [code, setCode] = useState(initialSample);
  const [sourceLanguage, setSourceLanguage] = useState("sas");
  const [targetLanguage, setTargetLanguage] = useState("python");
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
      const data = file
        ? await convertFile(file, { sourceLanguage, targetLanguage })
        : await convertText(code, { sourceLanguage, targetLanguage });
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
    <div className="bg-secondary min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">Compare Code</h1>
          <p className="text-accent">Upload a file or paste code below, then convert and compare the original and transformed output.</p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-8">
          <div className="xl:col-span-1 bg-surface shadow-sm rounded-lg p-6 border border-surface-hover">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-accent mb-2">Source language</label>
                <select
                  value={sourceLanguage}
                  onChange={(event) => setSourceLanguage(event.target.value)}
                  className="w-full rounded-lg border border-surface-hover bg-background px-3 py-2 text-accent"
                >
                  {SOURCE_LANGUAGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-accent mb-2">Target language</label>
                <select
                  value={targetLanguage}
                  onChange={(event) => setTargetLanguage(event.target.value)}
                  className="w-full rounded-lg border border-surface-hover bg-background px-3 py-2 text-accent"
                >
                  {TARGET_LANGUAGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-accent mb-2">Upload code file:</label>
                <input
                  type="file"
                  accept=".sql,.sas,.py,.r,.scala,.sh,.txt"
                  onChange={(event) => setFile(event.target.files?.[0] || null)}
                  className="block w-full text-sm text-accent file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary/90"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-accent mb-2">Paste code directly</label>
                <textarea
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  rows={10}
                  className="w-full p-4 border border-surface-hover rounded-lg font-mono bg-background text-accent focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {loading ? "Converting…" : "Convert & Compare"}
              </button>

              {error && (
                <div className="bg-danger/10 border border-danger/20 text-danger px-4 py-3 rounded">
                  {error}
                </div>
              )}
            </form>

            <div className="mt-8">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-primary">Conversion History</h2>
                <button
                  type="button"
                  onClick={handleClearHistory}
                  className="px-4 py-2 bg-surface-hover text-accent rounded-lg hover:bg-surface-hover/80 border border-surface-hover"
                >
                  Clear history
                </button>
              </div>
              {history.length === 0 ? (
                <p className="text-accent/70">No history yet. Convert a file to save history.</p>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {history.map((entry) => (
                    <button
                      type="button"
                      key={entry.id}
                      onClick={() => handleHistoryLoad(entry)}
                      className="w-full text-left p-4 border border-surface-hover rounded-lg bg-surface hover:bg-surface-hover transition-colors"
                    >
                      <div className="font-semibold text-accent">{entry.summary}</div>
                      <div className="text-sm text-accent/70">{new Date(entry.timestamp).toLocaleString()}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="xl:col-span-2">
            {result ? (
              <section className="bg-surface shadow-sm rounded-lg p-6 border border-surface-hover">
                <h2 className="text-2xl font-semibold text-primary mb-6">Conversion Result</h2>
                <div className="mb-4 flex flex-wrap gap-2 text-sm">
                  <span className="rounded-full bg-primary/10 px-3 py-2 text-primary">
                    Source: {result.source_language || sourceLanguage}
                  </span>
                  <span className="rounded-full bg-green-100 px-3 py-2 text-green-700">
                    Target: {result.target_language || targetLanguage}
                  </span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                  <div>
                    <h3 className="text-lg font-medium text-accent mb-2">Original</h3>
                    <CodeEditor value={result.original} label="" readOnly />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-accent mb-2">Converted</h3>
                    <CodeEditor value={result.converted} label="" readOnly />
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="bg-background p-4 rounded-lg border border-surface-hover">
                    <h4 className="text-lg font-medium text-accent mb-3">Metrics</h4>
                    <ul className="space-y-1 text-sm text-accent/80">
                      <li>Changed: {result.comparison.changed ? "Yes" : "No"}</li>
                      <li>Original length: {result.comparison.original_length}</li>
                      <li>Converted length: {result.comparison.converted_length}</li>
                      <li>Original lines: {result.comparison.original_line_count}</li>
                      <li>Converted lines: {result.comparison.converted_line_count}</li>
                      <li>Similarity ratio: {result.comparison.similarity_ratio}</li>
                      <li>Diff tokens: {result.comparison.diff_count}</li>
                    </ul>
                  </div>
                  <div className="lg:col-span-2 bg-background p-4 rounded-lg border border-surface-hover">
                    <h4 className="text-lg font-medium text-accent mb-3">Enhanced Diff Viewer</h4>
                    <DiffViewer original={result.original} converted={result.converted} />
                  </div>
                </div>
              </section>
            ) : (
              <div className="bg-surface shadow-sm rounded-lg p-6 text-center border border-surface-hover">
                <div className="text-6xl mb-4">🔄</div>
                <h3 className="text-xl font-semibold text-accent mb-2">Ready to Convert</h3>
                <p className="text-accent/70">Upload a file or paste code on the left, then click "Convert & Compare" to see the results here.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
