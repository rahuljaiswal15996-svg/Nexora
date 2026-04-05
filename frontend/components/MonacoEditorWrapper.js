import dynamic from "next/dynamic";
import { useMemo } from "react";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

export default function MonacoEditorWrapper({ value, onChange, language = "sql", readOnly = false, height = 300 }) {
  const options = useMemo(() => ({
    readOnly,
    minimap: { enabled: false },
    fontSize: 14,
    wordWrap: "on",
    theme: "vs-dark",
  }), [readOnly]);

  return (
    <div className="border border-surface-hover rounded-lg overflow-hidden">
      <MonacoEditor
        height={height}
        language={language}
        value={value}
        onChange={onChange}
        theme="vs-dark"
        options={options}
        loading={<textarea
          value={value}
          onChange={(e) => onChange && onChange(e.target.value)}
          rows={10}
          className="w-full p-4 font-mono bg-background text-accent"
          style={{ height: `${height}px` }}
        />}
      />
    </div>
  );
}
