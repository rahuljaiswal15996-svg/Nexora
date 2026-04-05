import { useState } from "react";

function DiffViewer({ original, converted, language = "sql" }) {
  const [viewMode, setViewMode] = useState("unified"); // unified, split

  // Simple diff computation
  const computeDiff = (oldText, newText) => {
    const oldLines = oldText.split("\n");
    const newLines = newText.split("\n");
    const maxLines = Math.max(oldLines.length, newLines.length);

    const diff = [];
    for (let i = 0; i < maxLines; i++) {
      const oldLine = oldLines[i] || "";
      const newLine = newLines[i] || "";
      const changed = oldLine !== newLine;

      diff.push({
        lineNumber: i + 1,
        oldLine,
        newLine,
        changed,
        type: changed ? (oldLine ? "modified" : "added") : "unchanged"
      });
    }

    return diff;
  };

  const diff = computeDiff(original, converted);

  const renderUnifiedDiff = () => (
    <div className="font-mono text-sm bg-background rounded-lg p-4 border border-surface-hover max-h-96 overflow-y-auto">
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-lg font-semibold text-accent">Unified Diff</h4>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode("unified")}
            className={`px-3 py-1 rounded text-xs font-medium ${
              viewMode === "unified"
                ? "border border-primary bg-primary/10 text-primary"
                : "border border-surface-hover bg-surface text-accent/70 hover:bg-surface-hover"
            }`}
          >
            Unified
          </button>
          <button
            onClick={() => setViewMode("split")}
            className={`px-3 py-1 rounded text-xs font-medium ${
              viewMode === "split"
                ? "border border-primary bg-primary/10 text-primary"
                : "border border-surface-hover bg-surface text-accent/70 hover:bg-surface-hover"
            }`}
          >
            Split
          </button>
        </div>
      </div>
      {diff.length === 0 ? (
        <div className="text-center text-accent/70 py-8">
          <div className="text-4xl mb-2">📄</div>
          No differences found.
        </div>
      ) : (
        diff.map((line, index) => (
          <div key={index} className={`flex border-b border-surface-hover py-1 items-start ${index === diff.length - 1 ? 'border-b-0' : ''}`}>
            <div className="w-12 text-right pr-4 text-accent/50 text-xs flex-shrink-0">
              {line.lineNumber}
            </div>
            <div className="flex-1 leading-relaxed">
              {line.oldLine && (
                <div className={`px-2 py-1 rounded ${line.changed ? 'bg-danger/10 text-danger' : 'text-accent/70'}`}>
                  {line.changed ? `- ${line.oldLine}` : `  ${line.oldLine}`}
                </div>
              )}
              {line.newLine && (
                <div className={`px-2 py-1 rounded ${line.changed ? 'bg-success/10 text-success' : 'text-accent/70'}`}>
                  {line.changed ? `+ ${line.newLine}` : `  ${line.newLine}`}
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );

  const renderSplitDiff = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-sm">
      <div className="bg-background rounded-lg p-4 border border-surface-hover max-h-96 overflow-y-auto">
        <h4 className="text-lg font-semibold text-danger mb-4">Original (Legacy)</h4>
        {diff.length === 0 ? (
          <div className="text-center text-accent/70 py-8">No content</div>
        ) : (
          diff.map((line, index) => (
            <div key={index} className={`flex border-b border-surface-hover py-1 items-start ${index === diff.length - 1 ? 'border-b-0' : ''}`}>
              <div className="w-10 text-right pr-2 text-accent/50 text-xs flex-shrink-0">
                {line.lineNumber}
              </div>
              <div className={`flex-1 px-2 py-1 rounded leading-relaxed ${line.changed ? 'bg-danger/10 text-danger' : 'text-accent'}`}>
                {line.oldLine || " "}
              </div>
            </div>
          ))
        )}
      </div>
      <div className="bg-background rounded-lg p-4 border border-surface-hover max-h-96 overflow-y-auto">
        <h4 className="text-lg font-semibold text-success mb-4">Converted (AI)</h4>
        {diff.length === 0 ? (
          <div className="text-center text-accent/70 py-8">No content</div>
        ) : (
          diff.map((line, index) => (
            <div key={index} className={`flex border-b border-surface-hover py-1 items-start ${index === diff.length - 1 ? 'border-b-0' : ''}`}>
              <div className="w-10 text-right pr-2 text-accent/50 text-xs flex-shrink-0">
                {line.lineNumber}
              </div>
              <div className={`flex-1 px-2 py-1 rounded leading-relaxed ${line.changed ? 'bg-success/10 text-success' : 'text-accent'}`}>
                {line.newLine || " "}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  return viewMode === "unified" ? renderUnifiedDiff() : renderSplitDiff();
}

export default DiffViewer;