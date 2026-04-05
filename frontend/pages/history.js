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
    <main style={{ padding: "2rem", fontFamily: "Arial, sans-serif", maxWidth: "980px" }}>
      <h1>Conversion History</h1>
      <p>Review previous conversions saved by the backend.</p>
      <button onClick={handleClear} style={{ marginBottom: "1rem", padding: "0.7rem 1.2rem", borderRadius: "8px" }}>
        Clear history
      </button>

      {loading ? (
        <p>Loading history...</p>
      ) : error ? (
        <p style={{ color: "#b91c1c" }}>{error}</p>
      ) : history.length === 0 ? (
        <p>No conversion history found.</p>
      ) : (
        <div style={{ display: "grid", gap: "1rem" }}>
          {history.map((entry) => (
            <div key={entry.id} style={{ padding: "1rem", borderRadius: "12px", border: "1px solid #e5e7eb", background: "#ffffff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                <span style={{ fontWeight: 600 }}>{entry.filename}</span>
                <span style={{ color: "#6b7280" }}>{new Date(entry.timestamp).toLocaleString()}</span>
              </div>
              <div style={{ marginBottom: "0.75rem", color: "#374151" }}>{entry.summary}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "0.75rem" }}>
                <div style={{ padding: "0.75rem", borderRadius: "10px", background: "#f8fafc" }}>
                  <div style={{ fontWeight: 600 }}>Similarity</div>
                  <div>{entry.similarity_ratio}</div>
                </div>
                <div style={{ padding: "0.75rem", borderRadius: "10px", background: "#f8fafc" }}>
                  <div style={{ fontWeight: 600 }}>Diff count</div>
                  <div>{entry.diff_count}</div>
                </div>
                <div style={{ padding: "0.75rem", borderRadius: "10px", background: "#f8fafc" }}>
                  <div style={{ fontWeight: 600 }}>Original length</div>
                  <div>{entry.original_length}</div>
                </div>
              </div>
              <div style={{ marginTop: "0.75rem", fontSize: "0.9rem", color: "#4b5563" }}>
                <div><strong>Original preview:</strong> {entry.original_preview}</div>
                <div><strong>Converted preview:</strong> {entry.converted_preview}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
