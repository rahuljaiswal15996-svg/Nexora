import dynamic from "next/dynamic";
import { useMemo } from "react";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false, loading: () => null });

export default function MonacoEditorWrapper({ value, onChange, language = "sql", readOnly = false, height = 300 }) {
  const options = useMemo(() => ({
    readOnly,
    minimap: { enabled: false },
    fontSize: 14,
    wordWrap: "on",
  }), [readOnly]);

  if (typeof window === "undefined") {
    return (
      <textarea value={value} onChange={(e) => onChange && onChange(e.target.value)} rows={10} style={{ width: "100%" }} />
    );
  }

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
      <MonacoEditor height={height} defaultLanguage={language} value={value} onChange={onChange} options={options} />
    </div>
  );
}
