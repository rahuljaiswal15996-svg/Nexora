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
    <main style={{ padding: "2rem", fontFamily: "Arial, sans-serif" }}>
      <h1>Compare Code</h1>
      <p>Upload a file or paste code below, then convert and compare the original and transformed output.</p>

      <div style={{ display: "grid", gap: "2rem", maxWidth: "1200px" }}>
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1rem" }}>
          <label>
            Upload code file:
            <input type="file" accept=".sql,.txt,.sas,.txt" onChange={(event) => setFile(event.target.files?.[0] || null)} />
          </label>

          <div>
            <div style={{ marginBottom: "0.5rem", fontWeight: "600" }}>Paste code directly</div>
            <textarea
              value={code}
              onChange={(event) => setCode(event.target.value)}
              rows={10}
              style={{ width: "100%", padding: "1rem", borderRadius: "8px", border: "1px solid #d1d5db", fontFamily: "monospace" }}
            />
          </div>

          <button type="submit" disabled={loading} style={{ padding: "0.8rem 1.2rem", borderRadius: "8px", width: "fit-content" }}>
            {loading ? "Converting…" : "Convert & Compare"}
          </button>

          {error && <div style={{ color: "#b91c1c", fontWeight: 600 }}>{error}</div>}
        </form>

        <section style={{ display: "grid", gap: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2>Conversion History</h2>
            <button type="button" onClick={handleClearHistory} style={{ padding: "0.5rem 1rem", borderRadius: "8px" }}>
              Clear history
            </button>
          </div>
          {history.length === 0 ? (
            <p style={{ color: "#6b7280" }}>No history yet. Convert a file to save history.</p>
          ) : (
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {history.map((entry) => (
                <button
                  type="button"
                  key={entry.id}
                  onClick={() => handleHistoryLoad(entry)}
                  style={{
                    textAlign: "left",
                    padding: "1rem",
                    borderRadius: "10px",
                    border: "1px solid #d1d5db",
                    background: "white",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{entry.summary}</div>
                  <div style={{ color: "#4b5563", fontSize: "0.9rem" }}>{new Date(entry.timestamp).toLocaleString()}</div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      {result && (
        <section style={{ marginTop: "2rem", maxWidth: "1200px", display: "grid", gap: "1.5rem" }}>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: "320px" }}>
              <h3>Original</h3>
              <CodeEditor value={result.original} label="Original code" readOnly />
            </div>
            <div style={{ flex: 1, minWidth: "320px" }}>
              <h3>Converted</h3>
              <CodeEditor value={result.converted} label="Converted code" readOnly />
            </div>
          </div>

          <div style={{ display: "grid", gap: "1rem" }}>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: "220px", padding: "1rem", borderRadius: "12px", background: "#f8fafc", border: "1px solid #e5e7eb" }}>
                <h4>Metrics</h4>
                <ul style={{ paddingLeft: "1.25rem", color: "#111827" }}>
                  <li>Changed: {result.comparison.changed ? "Yes" : "No"}</li>
                  <li>Original length: {result.comparison.original_length}</li>
                  <li>Converted length: {result.comparison.converted_length}</li>
                  <li>Original lines: {result.comparison.original_line_count}</li>
                  <li>Converted lines: {result.comparison.converted_line_count}</li>
                  <li>Similarity ratio: {result.comparison.similarity_ratio}</li>
                  <li>Diff tokens: {result.comparison.diff_count}</li>
                </ul>
              </div>
              <div style={{ flex: 2, minWidth: "320px", padding: "1rem", borderRadius: "12px", background: "#f8fafc", border: "1px solid #e5e7eb" }}>
                <h4>Enhanced Diff Viewer</h4>
                <DiffViewer original={result.original} converted={result.converted} />
              </div>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
