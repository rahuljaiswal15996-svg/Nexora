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
    <main style={{ padding: "2rem", fontFamily: "Arial, sans-serif" }}>
      <h1>Upload & Parse</h1>
      <p>Upload legacy code files or paste code to parse into the platform UIR.</p>

      <div style={{ display: "grid", gap: "1rem", maxWidth: "1000px" }}>
        <label>
          Upload file:
          <input type="file" accept=".sql,.sas,.py,.txt" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </label>

        <div>
          <div style={{ marginBottom: "0.5rem", fontWeight: 600 }}>Paste code</div>
          <MonacoEditorWrapper value={code} onChange={(v) => setCode(v)} language={"sql"} height={180} />
        </div>

        <div style={{ display: "flex", gap: "1rem" }}>
          <button onClick={handleParse} disabled={loading} style={{ padding: "0.6rem 1rem", borderRadius: "8px" }}>
            {loading ? "Parsing…" : "Parse to UIR"}
          </button>
          <button onClick={handleConvert} disabled={loading} style={{ padding: "0.6rem 1rem", borderRadius: "8px" }}>
            {loading ? "Converting…" : "Convert Now"}
          </button>
        </div>

        {error && <div style={{ color: "#b91c1c", fontWeight: 600 }}>{error}</div>}

        {uir && (
          <section style={{ marginTop: "1rem" }}>
            <h3>UIR (Universal Intermediate Representation)</h3>
            <MonacoEditorWrapper value={JSON.stringify(uir, null, 2)} readOnly language={"json"} height={240} />
          </section>
        )}

        {result && (
          <section style={{ marginTop: "1rem" }}>
            <h3>Conversion Result</h3>
            <div style={{ display: "grid", gap: "1rem" }}>
              <div>
                <h4>Original</h4>
                <CodeEditor value={result.original} readOnly label="Original" />
              </div>
              <div>
                <h4>Converted</h4>
                <CodeEditor value={result.converted} readOnly label="Converted" />
              </div>
              <div>
                <h4>Diff</h4>
                <DiffViewer original={result.original} converted={result.converted} />
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
