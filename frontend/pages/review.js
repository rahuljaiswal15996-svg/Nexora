import { useEffect, useState } from "react";
import { listShadowRuns, getShadowRun } from "../services/api";
import ReviewPanel from "../components/ReviewPanel";

export default function ReviewPage() {
  const [shadows, setShadows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await listShadowRuns("manual_review");
      const items = res.items || [];
      setShadows(items);
      setSelected((current) => {
        if (items.length === 0) {
          return null;
        }
        if (current && items.some((item) => item.id === current.id)) {
          return items.find((item) => item.id === current.id) || current;
        }
        return items[0];
      });
    } catch (err) {
      setError(err.message || "Failed to load shadow runs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const seedDemo = async () => {
    try {
      setLoading(true);
      // small demo input
      await createShadowRun("PROC SQL; SELECT id, name FROM customers; quit;", "code", 0.99);
      await load();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const openShadow = async (id) => {
    setError("");
    try {
      const s = await getShadowRun(id);
      setSelected(s);
    } catch (err) {
      setError(err.message || "Failed to fetch shadow run");
    }
  };

  const handleReviewed = (res) => {
    // refresh list and clear selection
    load();
    setSelected(null);
  };

  return (
    <main style={{ padding: "2rem", fontFamily: "Arial, sans-serif", maxWidth: "1100px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <h1 style={{ margin: 0 }}>Human-in-the-Loop Review</h1>
          <p style={{ margin: 0, color: "#6b7280" }}>Pending shadow runs requiring manual review.</p>
        </div>
        <div>
          <button onClick={seedDemo} style={{ padding: "8px 10px", borderRadius: 6, background: "#2563eb", color: "white", border: "none" }}>Seed demo</button>
        </div>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : error ? (
        <p style={{ color: "#b91c1c" }}>{error}</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: "1rem" }}>
          <div>
            {shadows.length === 0 ? (
              <div style={{ padding: "1rem", borderRadius: "8px", border: "1px solid #e5e7eb", background: "#fff" }}>No pending shadow runs.</div>
            ) : (
              <div style={{ display: "grid", gap: "0.5rem" }}>
                {shadows.map((s) => (
                  <div key={s.id} onClick={() => openShadow(s.id)} style={{ cursor: "pointer", padding: "0.75rem", borderRadius: "8px", border: selected?.id === s.id ? "1px solid #2563eb" : "1px solid #e5e7eb", background: selected?.id === s.id ? "#eff6ff" : "#fff", boxShadow: selected?.id === s.id ? "0 0 0 1px rgba(37, 99, 235, 0.1)" : "none" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                      <div style={{ fontWeight: 600 }}>{s.id.slice(0, 8)}</div>
                      <div style={{ color: "#6b7280" }}>{new Date(s.created_at).toLocaleString()}</div>
                    </div>
                    <div style={{ fontSize: "0.9rem", color: "#374151" }}>Confidence: {Number(s.confidence).toFixed(3)}</div>
                    <div style={{ marginTop: "0.5rem", color: "#6b7280", fontSize: "0.85rem" }}>{(s.input_blob || "").slice(0, 120)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            {selected ? (
              <ReviewPanel shadow={selected} onReviewed={handleReviewed} />
            ) : (
              <div style={{ padding: "1rem", borderRadius: "8px", border: "1px solid #e5e7eb", background: "#fff" }}>
                <p style={{ margin: 0 }}>Select a shadow run to inspect and review.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
