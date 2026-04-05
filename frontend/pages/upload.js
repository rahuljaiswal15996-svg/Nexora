import { useState } from "react";
import CodeEditor from "../components/CodeEditor";
import MonacoEditorWrapper from "../components/MonacoEditorWrapper";
import DiffViewer from "../components/DiffViewer";
import { parseFile, parseText, convertFile, convertText } from "../services/api";

const SOURCE_LANGUAGE_OPTIONS = [
  { value: "auto", label: "Auto-detect" },
  { value: "sas", label: "SAS / PROC SQL" },
  { value: "sql", label: "SQL" },
  { value: "python", label: "Python" },
  { value: "r", label: "R" },
  { value: "spark_sql", label: "Spark SQL" },
  { value: "scala", label: "Scala" },
  { value: "shell", label: "Shell" },
];

const TARGET_LANGUAGE_OPTIONS = [
  { value: "python", label: "Python" },
  { value: "sql", label: "SQL" },
  { value: "pyspark", label: "PySpark" },
  { value: "dbt", label: "dbt Model SQL" },
];

function getEditorLanguage(sourceLanguage) {
  if (["python", "pyspark"].includes(sourceLanguage)) {
    return "python";
  }
  if (["sql", "sas", "spark_sql"].includes(sourceLanguage)) {
    return "sql";
  }
  if (sourceLanguage === "r") {
    return "r";
  }
  return "plaintext";
}

export default function UploadPage() {
  const [file, setFile] = useState(null);
  const [code, setCode] = useState("PROC SQL\nSELECT * FROM users;");
  const [sourceLanguage, setSourceLanguage] = useState("sas");
  const [targetLanguage, setTargetLanguage] = useState("python");
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
      const data = file
        ? await parseFile(file, { sourceLanguage })
        : await parseText(code, { sourceLanguage });
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
      const data = file
        ? await convertFile(file, { sourceLanguage, targetLanguage })
        : await convertText(code, { sourceLanguage, targetLanguage });
      setResult(data);
    } catch (err) {
      setError(err.message || "Convert failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-secondary min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">Upload & Convert</h1>
          <p className="text-accent">Upload a code file or paste code to parse and convert it.</p>
        </div>

        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-accent mb-2">Source language</label>
              <select
                value={sourceLanguage}
                onChange={(event) => setSourceLanguage(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                {SOURCE_LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-accent mb-2">Target language</label>
              <select
                value={targetLanguage}
                onChange={(event) => setTargetLanguage(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                {TARGET_LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-accent mb-2">Upload file:</label>
            <input
              type="file"
              accept=".sql,.sas,.py,.r,.scala,.sh,.txt"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-blue-700"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-accent mb-2">Paste code</label>
            <MonacoEditorWrapper
              value={code}
              onChange={(v) => setCode(v)}
              language={getEditorLanguage(sourceLanguage)}
              height={180}
            />
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
            <div className="mb-3 text-sm text-accent">
              Parsed source language: <span className="font-semibold text-primary">{uir.source_language || sourceLanguage}</span>
            </div>
            <MonacoEditorWrapper value={JSON.stringify(uir.uir || uir, null, 2)} readOnly language={"json"} height={240} />
          </section>
        )}

        {result && (
          <section className="bg-white shadow-md rounded-lg p-6">
            <h3 className="text-xl font-semibold text-primary mb-4">Conversion Result</h3>
            <div className="mb-4 flex flex-wrap gap-2 text-sm">
              <span className="rounded-full bg-primary/10 px-3 py-2 text-primary">
                Source: {result.source_language || sourceLanguage}
              </span>
              <span className="rounded-full bg-green-100 px-3 py-2 text-green-700">
                Target: {result.target_language || targetLanguage}
              </span>
              <span className="rounded-full bg-surface px-3 py-2 text-accent border border-surface-hover">
                Engine: {result.meta?.engine_version || 'n/a'}
              </span>
            </div>
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
