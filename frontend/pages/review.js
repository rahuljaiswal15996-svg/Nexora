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
    <div className="min-h-screen bg-gray-50 font-sans">
      <div className="max-w-7xl mx-auto p-8">
        <div className="flex justify-between items-center mb-8 bg-white shadow-md rounded-lg p-6">
          <div>
            <h1 className="text-3xl font-bold text-primary mb-2">Human-in-the-Loop Review</h1>
            <p className="text-gray-600 text-lg">Review AI-generated code conversions requiring manual approval.</p>
          </div>
          <button
            onClick={seedDemo}
            disabled={loading}
            className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold"
          >
            {loading ? "Loading..." : "Seed Demo Run"}
          </button>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">⏳</div>
            <p className="text-xl text-gray-500">Loading shadow runs...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="bg-white shadow-md rounded-lg overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-800">Pending Reviews ({shadows.length})</h2>
              </div>
              <div className="max-h-96 overflow-y-auto p-4">
                {shadows.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-6xl mb-4">📋</div>
                    No pending shadow runs.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {shadows.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => openShadow(s.id)}
                        className={`cursor-pointer p-4 rounded-lg border transition-all ${
                          selected?.id === s.id
                            ? 'border-primary bg-blue-50 shadow-md'
                            : 'border-gray-200 bg-white hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="font-semibold text-sm text-gray-800">{s.id.slice(0, 8).toUpperCase()}</div>
                          <div className="text-xs text-gray-500">{new Date(s.created_at).toLocaleString()}</div>
                        </div>
                        <div className="mb-2">
                          <span
                            className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                              Number(s.confidence) > 0.8
                                ? 'bg-green-100 text-green-800'
                                : Number(s.confidence) > 0.6
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {Number(s.confidence).toFixed(3)}
                          </span>
                        </div>
                        <div className="text-sm text-gray-700 line-clamp-2">
                          {(s.input_blob || "").slice(0, 100)}...
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-3">
              {selected ? (
                <ReviewPanel shadow={selected} onReviewed={handleReviewed} />
              ) : (
                <div className="bg-white shadow-md rounded-lg p-8 text-center border-2 border-dashed border-gray-300">
                  <div className="text-6xl mb-4">👈</div>
                  <p className="text-lg text-gray-500">Select a shadow run from the list to inspect and review.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
