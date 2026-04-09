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
      <div className="lg:col-span-2 rounded-[28px] border border-stone-200/80 bg-white/82 p-6 shadow-[0_18px_44px_rgba(148,163,184,0.12)] min-h-80">
        <h3 className="text-xl font-semibold tracking-tight text-slate-900 mb-4">Shadow Run Details</h3>
        <div className="text-sm text-slate-600 mb-4 space-y-2">
          <div><strong>ID:</strong> {shadow.id.slice(0, 12)}</div>
          <div>
            <strong>Status:</strong>{" "}
            <span
              className={`inline-block px-2 py-1 rounded-full text-xs font-medium uppercase tracking-[0.18em] ${
                shadow.status === "manual_review"
                  ? "border border-amber-200 bg-amber-50 text-amber-700"
                  : "border border-emerald-200 bg-emerald-50 text-emerald-700"
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
                  ? "text-emerald-700"
                  : Number(shadow.confidence) > 0.6
                  ? "text-amber-700"
                  : "text-rose-700"
              }`}
            >
              {Number(shadow.confidence).toFixed(3)}
            </span>
          </div>
          <div><strong>Similarity:</strong> {comparison.similarity_ratio ? Number(comparison.similarity_ratio).toFixed(3) : "-"}</div>
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">Reviewer Comment</label>
          <textarea
            placeholder="Add notes about your review decision..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full min-h-24 rounded-[22px] border border-stone-200 bg-white px-4 py-3 text-slate-700 outline-none focus:border-sky-300 resize-vertical"
            disabled={loading}
          />
        </div>

        {error && (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">
            {error}
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <button
            onClick={() => doAction("approve")}
            disabled={loading}
            className="flex-1 rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 font-semibold transition-colors"
          >
            Approve
          </button>
          <button
            onClick={() => doAction("reject")}
            disabled={loading}
            className="flex-1 rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700 hover:bg-rose-100 disabled:opacity-50 font-semibold transition-colors"
          >
            Reject
          </button>
          <button
            onClick={() => doAction("needs-fix")}
            disabled={loading}
            className="flex-1 rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-amber-700 hover:bg-amber-100 disabled:opacity-50 font-semibold transition-colors"
          >
            Needs Fix
          </button>
        </div>
      </div>

      <div className="lg:col-span-3 rounded-[28px] border border-stone-200/80 bg-white/82 p-6 shadow-[0_18px_44px_rgba(148,163,184,0.12)]">
        <h3 className="text-xl font-semibold tracking-tight text-slate-900 mb-4">Code Changes</h3>
        <div className="mb-4 text-sm text-slate-600">
          <strong>Input Preview:</strong>
        </div>
        <div className="rounded-[22px] border border-stone-200 bg-stone-50 p-4 font-mono text-sm leading-relaxed text-slate-700 max-h-36 overflow-y-auto mb-6">
          {(shadow.input_blob || "").slice(0, 300)}
        </div>

        <DiffViewer original={shadow.legacy_output || ""} converted={shadow.converted_output || ""} />
      </div>
    </div>
  );
}
