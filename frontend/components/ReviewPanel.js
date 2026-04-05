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
    <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: "1rem", alignItems: "start" }}>
      <div style={{ padding: "1rem", borderRadius: "8px", border: "1px solid #e5e7eb", background: "#fff", minHeight: 220 }}>
        <h3 style={{ marginTop: 0 }}>Shadow Run</h3>
        <div style={{ fontSize: "0.9rem", color: "#374151", marginBottom: "0.5rem" }}>
          <div><strong>ID:</strong> {shadow.id}</div>
          <div><strong>Status:</strong> {shadow.status}</div>
          <div><strong>Created:</strong> {new Date(shadow.created_at).toLocaleString()}</div>
          <div><strong>Confidence:</strong> {Number(shadow.confidence).toFixed(3)}</div>
          <div><strong>Similarity:</strong> {comparison.similarity_ratio || "-"}</div>
        </div>

        <div style={{ marginTop: "0.5rem" }}>
          <textarea
            placeholder="Reviewer comment (optional)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            style={{ width: "100%", minHeight: "84px", padding: "8px", borderRadius: "6px", border: "1px solid #e5e7eb" }}
            disabled={loading}
          />
        </div>
        {error && <div style={{ color: "#b91c1c", marginTop: "0.5rem" }}>{error}</div>}

        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
          <button onClick={() => doAction("approve")} disabled={loading} style={{ flex: 1, padding: "0.6rem", background: "#10b981", color: "white", borderRadius: "8px", border: "none" }}>Approve</button>
          <button onClick={() => doAction("reject")} disabled={loading} style={{ flex: 1, padding: "0.6rem", background: "#ef4444", color: "white", borderRadius: "8px", border: "none" }}>Reject</button>
          <button onClick={() => doAction("needs-fix")} disabled={loading} style={{ flex: 1, padding: "0.6rem", background: "#f59e0b", color: "white", borderRadius: "8px", border: "none" }}>Needs Fix</button>
        </div>
      </div>

      <div style={{ padding: "1rem", borderRadius: "8px", border: "1px solid #e5e7eb", background: "#fff" }}>
        <h3 style={{ marginTop: 0 }}>Diff</h3>
        <div style={{ marginBottom: "0.5rem", color: "#374151" }}><strong>Input preview:</strong></div>
        <div style={{ fontFamily: "monospace", whiteSpace: "pre-wrap", background: "#f8fafc", padding: "8px", borderRadius: "6px", marginBottom: "0.75rem" }}>{(shadow.input_blob || "").slice(0, 200)}</div>

        <DiffViewer original={shadow.legacy_output || ""} converted={shadow.converted_output || ""} />
      </div>
    </div>
  );
}
