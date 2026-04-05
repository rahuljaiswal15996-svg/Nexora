import { useEffect, useState } from "react";
import { listShadowRuns, getShadowRun, createShadowRun } from "../services/api";
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
    <div style={{ minHeight: "100vh", backgroundColor: "#f8fafc", fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem", padding: "1.5rem", backgroundColor: "white", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "2rem", fontWeight: 700, color: "#1f2937" }}>Human-in-the-Loop Review</h1>
            <p style={{ margin: "0.5rem 0 0 0", color: "#6b7280", fontSize: "1.1rem" }}>Review AI-generated code conversions requiring manual approval.</p>
          </div>
          <button onClick={seedDemo} disabled={loading} style={{ padding: "12px 24px", borderRadius: "8px", backgroundColor: "#3b82f6", color: "white", border: "none", fontWeight: 600, fontSize: "1rem", cursor: "pointer", boxShadow: "0 1px 2px rgba(0,0,0,0.1)", transition: "all 0.2s", opacity: loading ? 0.6 : 1 }}>
            {loading ? "Loading..." : "Seed Demo Run"}
          </button>
        </div>

        {error && (
          <div style={{ padding: "1rem", backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", color: "#dc2626", marginBottom: "2rem" }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: "4rem" }}>
            <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>⏳</div>
            <p style={{ fontSize: "1.2rem", color: "#6b7280" }}>Loading shadow runs...</p>
          </div>
        ) : (
        <div style={{ display: "grid", gridTemplateColumns: "400px 1fr", gap: "2rem" }}>
          <div style={{ backgroundColor: "white", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", overflow: "hidden" }}>
            <div style={{ padding: "1.5rem", borderBottom: "1px solid #e5e7eb" }}>
              <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 600, color: "#1f2937" }}>Pending Reviews ({shadows.length})</h2>
            </div>
            <div style={{ maxHeight: "600px", overflowY: "auto" }}>
              {shadows.length === 0 ? (
                <div style={{ padding: "2rem", textAlign: "center", color: "#6b7280" }}>
                  <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📋</div>
                  No pending shadow runs.
                </div>
              ) : (
                <div style={{ padding: "1rem" }}>
                  {shadows.map((s) => (
                    <div key={s.id} onClick={() => openShadow(s.id)} style={{ cursor: "pointer", padding: "1rem", borderRadius: "8px", border: selected?.id === s.id ? "2px solid #3b82f6" : "1px solid #e5e7eb", backgroundColor: selected?.id === s.id ? "#eff6ff" : "white", marginBottom: "0.75rem", transition: "all 0.2s", boxShadow: selected?.id === s.id ? "0 0 0 3px rgba(59, 130, 246, 0.1)" : "none" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                        <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "#1f2937" }}>{s.id.slice(0, 8).toUpperCase()}</div>
                        <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>{new Date(s.created_at).toLocaleString()}</div>
                      </div>
                      <div style={{ marginBottom: "0.5rem" }}>
                        <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: 500, backgroundColor: Number(s.confidence) > 0.8 ? "#dcfce7" : Number(s.confidence) > 0.6 ? "#fef3c7" : "#fee2e2", color: Number(s.confidence) > 0.8 ? "#166534" : Number(s.confidence) > 0.6 ? "#92400e" : "#dc2626" }}>
                          {Number(s.confidence).toFixed(3)}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.85rem", color: "#374151", lineHeight: 1.4 }}>
                        {(s.input_blob || "").slice(0, 100)}...
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            {selected ? (
              <ReviewPanel shadow={selected} onReviewed={handleReviewed} />
            ) : (
              <div style={{ padding: "2rem", borderRadius: "12px", border: "2px dashed #e5e7eb", backgroundColor: "white", textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
                <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>👈</div>
                <p style={{ margin: 0, fontSize: "1.1rem", color: "#6b7280" }}>Select a shadow run from the list to inspect and review.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
