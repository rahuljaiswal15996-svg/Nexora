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
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
      <div className="lg:col-span-2 bg-white shadow-md rounded-lg p-6 min-h-80">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">Shadow Run Details</h3>
        <div className="text-sm text-gray-700 mb-4 space-y-2">
          <div><strong>ID:</strong> {shadow.id.slice(0, 12)}</div>
          <div>
            <strong>Status:</strong>{" "}
            <span
              className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                shadow.status === "manual_review"
                  ? "bg-yellow-100 text-yellow-800"
                  : "bg-green-100 text-green-800"
              }`}
            >
              {shadow.status.replace("_", " ")}
            </span>
          </div>
          <div><strong>Created:</strong> {new Date(shadow.created_at).toLocaleString()}</div>
          <div>
            <strong>Confidence:</strong>{" "}
            <span
              className={`font-semibold ${
                Number(shadow.confidence) > 0.8
                  ? "text-green-600"
                  : Number(shadow.confidence) > 0.6
                  ? "text-yellow-600"
                  : "text-red-600"
              }`}
            >
              {Number(shadow.confidence).toFixed(3)}
            </span>
          </div>
          <div><strong>Similarity:</strong> {comparison.similarity_ratio ? Number(comparison.similarity_ratio).toFixed(3) : "-"}</div>
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Reviewer Comment (Optional)</label>
          <textarea
            placeholder="Add notes about your review decision..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full min-h-24 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-vertical"
            disabled={loading}
          />
        </div>

        {error && (
          <div className="mt-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <button
            onClick={() => doAction("approve")}
            disabled={loading}
            className="flex-1 px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 font-semibold transition-colors"
          >
            ✅ Approve
          </button>
          <button
            onClick={() => doAction("reject")}
            disabled={loading}
            className="flex-1 px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 font-semibold transition-colors"
          >
            ❌ Reject
          </button>
          <button
            onClick={() => doAction("needs-fix")}
            disabled={loading}
            className="flex-1 px-4 py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50 font-semibold transition-colors"
          >
            🔧 Needs Fix
          </button>
        </div>
      </div>

      <div className="lg:col-span-3 bg-white shadow-md rounded-lg p-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">Code Changes</h3>
        <div className="mb-4 text-sm text-gray-700">
          <strong>Input Preview:</strong>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg border font-mono text-sm leading-relaxed max-h-36 overflow-y-auto mb-6">
          {(shadow.input_blob || "").slice(0, 300)}
        </div>

        <DiffViewer original={shadow.legacy_output || ""} converted={shadow.converted_output || ""} />
      </div>
    </div>
  );
}
