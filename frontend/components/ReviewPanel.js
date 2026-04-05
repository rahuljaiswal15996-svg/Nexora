import { useState } from "react";
import DiffViewer from "./DiffViewer";
import { reviewShadow } from "../services/api";

export default function ReviewPanel({ shadow, onReviewed }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [comment, setComment] = useState("");

  if (!shadow) return null;

  const comparison = shadow.comparison_json || {};

  const doAction = async (action) => {
    setLoading(true);
    setError("");
    try {
      const res = await reviewShadow(shadow.id, "web-ui", action, comment);
      if (onReviewed) onReviewed(res);
    } catch (err) {
      setError(err.message || "Review failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "400px 1fr", gap: "2rem", alignItems: "start" }}>
      <div style={{ padding: "1.5rem", borderRadius: "12px", border: "1px solid #e5e7eb", backgroundColor: "white", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", minHeight: 300 }}>
        <h3 style={{ marginTop: 0, marginBottom: "1rem", fontSize: "1.25rem", fontWeight: 600, color: "#1f2937" }}>Shadow Run Details</h3>
        <div style={{ fontSize: "0.9rem", color: "#374151", marginBottom: "1rem" }}>
          <div style={{ marginBottom: "0.5rem" }}><strong style={{ color: "#1f2937" }}>ID:</strong> {shadow.id.slice(0, 12)}</div>
          <div style={{ marginBottom: "0.5rem" }}><strong style={{ color: "#1f2937" }}>Status:</strong> <span style={{ padding: "2px 8px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: 500, backgroundColor: shadow.status === "manual_review" ? "#fef3c7" : "#dcfce7", color: shadow.status === "manual_review" ? "#92400e" : "#166534" }}>{shadow.status.replace("_", " ")}</span></div>
          <div style={{ marginBottom: "0.5rem" }}><strong style={{ color: "#1f2937" }}>Created:</strong> {new Date(shadow.created_at).toLocaleString()}</div>
          <div style={{ marginBottom: "0.5rem" }}><strong style={{ color: "#1f2937" }}>Confidence:</strong> <span style={{ fontWeight: 600, color: Number(shadow.confidence) > 0.8 ? "#16a34a" : Number(shadow.confidence) > 0.6 ? "#ca8a04" : "#dc2626" }}>{Number(shadow.confidence).toFixed(3)}</span></div>
          <div style={{ marginBottom: "0.5rem" }}><strong style={{ color: "#1f2937" }}>Similarity:</strong> {comparison.similarity_ratio ? Number(comparison.similarity_ratio).toFixed(3) : "-"}</div>
        </div>

        <div style={{ marginTop: "1.5rem" }}>
          <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 500, color: "#374151", marginBottom: "0.5rem" }}>Reviewer Comment (Optional)</label>
          <textarea
            placeholder="Add notes about your review decision..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            style={{ width: "100%", minHeight: "100px", padding: "12px", borderRadius: "8px", border: "1px solid #d1d5db", backgroundColor: "white", fontSize: "0.9rem", lineHeight: 1.4, resize: "vertical", outline: "none", transition: "border-color 0.2s" }}
            disabled={loading}
          />
        </div>

        {error && (
          <div style={{ padding: "0.75rem", backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: "6px", color: "#dc2626", marginTop: "1rem", fontSize: "0.85rem" }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
          <button onClick={() => doAction("approve")} disabled={loading} style={{ flex: 1, padding: "12px 16px", backgroundColor: "#10b981", color: "white", borderRadius: "8px", border: "none", fontWeight: 600, fontSize: "0.95rem", cursor: "pointer", transition: "all 0.2s", opacity: loading ? 0.6 : 1, boxShadow: "0 1px 2px rgba(0,0,0,0.1)" }}>
            ✅ Approve
          </button>
          <button onClick={() => doAction("reject")} disabled={loading} style={{ flex: 1, padding: "12px 16px", backgroundColor: "#ef4444", color: "white", borderRadius: "8px", border: "none", fontWeight: 600, fontSize: "0.95rem", cursor: "pointer", transition: "all 0.2s", opacity: loading ? 0.6 : 1, boxShadow: "0 1px 2px rgba(0,0,0,0.1)" }}>
            ❌ Reject
          </button>
          <button onClick={() => doAction("needs-fix")} disabled={loading} style={{ flex: 1, padding: "12px 16px", backgroundColor: "#f59e0b", color: "white", borderRadius: "8px", border: "none", fontWeight: 600, fontSize: "0.95rem", cursor: "pointer", transition: "all 0.2s", opacity: loading ? 0.6 : 1, boxShadow: "0 1px 2px rgba(0,0,0,0.1)" }}>
            🔧 Needs Fix
          </button>
        </div>
      </div>

      <div style={{ padding: "1.5rem", borderRadius: "12px", border: "1px solid #e5e7eb", backgroundColor: "white", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
        <h3 style={{ marginTop: 0, marginBottom: "1rem", fontSize: "1.25rem", fontWeight: 600, color: "#1f2937" }}>Code Changes</h3>
        <div style={{ marginBottom: "1rem", color: "#374151", fontSize: "0.9rem" }}>
          <strong style={{ color: "#1f2937" }}>Input Preview:</strong>
        </div>
        <div style={{ fontFamily: "Monaco, 'Courier New', monospace", whiteSpace: "pre-wrap", backgroundColor: "#f8fafc", padding: "12px", borderRadius: "8px", marginBottom: "1.5rem", fontSize: "0.85rem", lineHeight: 1.4, border: "1px solid #e5e7eb", maxHeight: "150px", overflowY: "auto" }}>
          {(shadow.input_blob || "").slice(0, 300)}
        </div>

        <DiffViewer original={shadow.legacy_output || ""} converted={shadow.converted_output || ""} />
      </div>
    </div>
  );
}
