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
      <textarea
        value={value}
        onChange={(e) => onChange && onChange(e.target.value)}
        rows={10}
        className="w-full p-4 border border-gray-300 rounded-lg font-mono focus:ring-2 focus:ring-primary focus:border-transparent"
      />
    );
  }

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden">
      <MonacoEditor height={height} defaultLanguage={language} value={value} onChange={onChange} options={options} />
    </div>
  );
}
