import dynamic from "next/dynamic";
import { useMemo } from "react";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

export default function MonacoEditorWrapper({
  value,
  onChange,
  language = "sql",
  readOnly = false,
  height = 300,
  options = {},
  onKeyDown,
}) {
  const editorOptions = useMemo(() => ({
    readOnly,
    minimap: { enabled: false },
    fontSize: 14,
    wordWrap: "on",
    theme: "vs-dark",
    ...options,
  }), [options, readOnly]);

  return (
    <div className="border border-surface-hover rounded-lg overflow-hidden">
      <MonacoEditor
        height={height}
        language={language}
        value={value}
        onChange={onChange}
        theme="vs-dark"
        options={editorOptions}
        onMount={(editor) => {
          if (!onKeyDown) {
            return;
          }

          editor.onKeyDown((event) => {
            onKeyDown(event.browserEvent || event);
          });
        }}
        loading={<textarea
          value={value}
          onChange={(e) => onChange && onChange(e.target.value)}
          onKeyDown={onKeyDown}
          rows={10}
          className="w-full p-4 font-mono bg-background text-accent"
          style={{ height: `${height}px` }}
        />}
      />
    </div>
  );
}
