import { useState } from "react";
import CodeEditor from "../components/CodeEditor";
import MonacoEditorWrapper from "../components/MonacoEditorWrapper";
import DiffViewer from "../components/DiffViewer";
import { parseFile, parseText, convertFile, convertText } from "../services/api";

export default function UploadPage() {
  const [file, setFile] = useState(null);
  const [code, setCode] = useState("PROC SQL\nSELECT * FROM users;");
  const [uir, setUir] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleParse = async () => {
    setError("");
    setUir(null);
    setResult(null);
    setLoading(true);
    try {
      const data = file ? await parseFile(file) : await parseText(code);
      setUir(data);
    } catch (err) {
      setError(err.message || "Parse failed");
    } finally {
      setLoading(false);
    }
  };

  const handleConvert = async () => {
    setError("");
    setResult(null);
    setLoading(true);
    try {
      const data = file ? await convertFile(file) : await convertText(code);
      setResult(data);
    } catch (err) {
      setError(err.message || "Convert failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">Upload & Parse</h1>
          <p className="text-gray-600">Upload legacy code files or paste code to parse into the platform UIR.</p>
        </header>

        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Upload file:</label>
            <input
              type="file"
              accept=".sql,.sas,.py,.txt"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-blue-700"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Paste code</label>
            <MonacoEditorWrapper value={code} onChange={(v) => setCode(v)} language={"sql"} height={180} />
          </div>

          <div className="flex gap-4 mb-4">
            <button
              onClick={handleParse}
              disabled={loading}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Parsing…" : "Parse to UIR"}
            </button>
            <button
              onClick={handleConvert}
              disabled={loading}
              className="px-4 py-2 bg-secondary text-accent rounded-lg hover:bg-gray-200 disabled:opacity-50"
            >
              {loading ? "Converting…" : "Convert Now"}
            </button>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}
        </div>

        {uir && (
          <section className="bg-white shadow-md rounded-lg p-6 mb-6">
            <h3 className="text-xl font-semibold text-primary mb-4">UIR (Universal Intermediate Representation)</h3>
            <MonacoEditorWrapper value={JSON.stringify(uir, null, 2)} readOnly language={"json"} height={240} />
          </section>
        )}

        {result && (
          <section className="bg-white shadow-md rounded-lg p-6">
            <h3 className="text-xl font-semibold text-primary mb-4">Conversion Result</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div>
                <h4 className="text-lg font-medium text-gray-800 mb-2">Original</h4>
                <CodeEditor value={result.original} readOnly label="" />
              </div>
              <div>
                <h4 className="text-lg font-medium text-gray-800 mb-2">Converted</h4>
                <CodeEditor value={result.converted} readOnly label="" />
              </div>
            </div>
            <div>
              <h4 className="text-lg font-medium text-gray-800 mb-2">Diff</h4>
              <DiffViewer original={result.original} converted={result.converted} />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
