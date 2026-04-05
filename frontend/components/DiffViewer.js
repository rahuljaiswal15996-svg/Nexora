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
    <div style={{ fontFamily: "'JetBrains Mono', 'Fira Code', Monaco, 'Courier New', monospace", fontSize: "0.85rem", backgroundColor: "#f8fafc", borderRadius: "8px", padding: "1rem", border: "1px solid #e5e7eb", maxHeight: "400px", overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h4 style={{ margin: 0, fontSize: "1rem", fontWeight: 600, color: "#1f2937" }}>Unified Diff</h4>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button onClick={() => setViewMode("unified")} style={{ padding: "4px 8px", borderRadius: "4px", border: viewMode === "unified" ? "1px solid #3b82f6" : "1px solid #d1d5db", backgroundColor: viewMode === "unified" ? "#eff6ff" : "white", color: viewMode === "unified" ? "#3b82f6" : "#6b7280", fontSize: "0.75rem", cursor: "pointer" }}>Unified</button>
          <button onClick={() => setViewMode("split")} style={{ padding: "4px 8px", borderRadius: "4px", border: viewMode === "split" ? "1px solid #3b82f6" : "1px solid #d1d5db", backgroundColor: viewMode === "split" ? "#eff6ff" : "white", color: viewMode === "split" ? "#3b82f6" : "#6b7280", fontSize: "0.75rem", cursor: "pointer" }}>Split</button>
        </div>
      </div>
      {diff.length === 0 ? (
        <div style={{ textAlign: "center", color: "#6b7280", padding: "2rem" }}>
          <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📄</div>
          No differences found.
        </div>
      ) : (
        diff.map((line, index) => (
          <div key={index} style={{ display: "flex", borderBottom: index < diff.length - 1 ? "1px solid #e5e7eb" : "none", padding: "4px 0", alignItems: "flex-start" }}>
            <div style={{ width: "50px", textAlign: "right", paddingRight: "1rem", color: "#9ca3af", fontSize: "0.8rem", flexShrink: 0 }}>
              {line.lineNumber}
            </div>
            <div style={{ flex: 1, lineHeight: 1.4 }}>
              {line.oldLine && (
                <div style={{ color: line.changed ? "#dc2626" : "#6b7280", backgroundColor: line.changed ? "#fef2f2" : "transparent", padding: "2px 6px", marginBottom: line.changed ? "2px" : "0", borderRadius: "3px" }}>
                  {line.changed ? `- ${line.oldLine}` : `  ${line.oldLine}`}
                </div>
              )}
              {line.newLine && (
                <div style={{ color: line.changed ? "#16a34a" : "#6b7280", backgroundColor: line.changed ? "#f0fdf4" : "transparent", padding: "2px 6px", borderRadius: "3px" }}>
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
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", fontFamily: "'JetBrains Mono', 'Fira Code', Monaco, 'Courier New', monospace", fontSize: "0.85rem" }}>
      <div style={{ backgroundColor: "#f8fafc", borderRadius: "8px", padding: "1rem", border: "1px solid #e5e7eb", maxHeight: "400px", overflowY: "auto" }}>
        <h4 style={{ marginTop: 0, marginBottom: "1rem", fontSize: "1rem", fontWeight: 600, color: "#dc2626" }}>Original (Legacy)</h4>
        {diff.length === 0 ? (
          <div style={{ textAlign: "center", color: "#6b7280", padding: "2rem" }}>No content</div>
        ) : (
          diff.map((line, index) => (
            <div key={index} style={{ display: "flex", borderBottom: index < diff.length - 1 ? "1px solid #e5e7eb" : "none", padding: "4px 0", alignItems: "flex-start" }}>
              <div style={{ width: "40px", textAlign: "right", paddingRight: "0.5rem", color: "#9ca3af", fontSize: "0.8rem", flexShrink: 0 }}>
                {line.lineNumber}
              </div>
              <div style={{ flex: 1, backgroundColor: line.changed ? "#fef2f2" : "transparent", color: line.changed ? "#dc2626" : "#374151", padding: "2px 6px", borderRadius: "3px", lineHeight: 1.4 }}>
                {line.oldLine || " "}
              </div>
            </div>
          ))
        )}
      </div>
      <div style={{ backgroundColor: "#f8fafc", borderRadius: "8px", padding: "1rem", border: "1px solid #e5e7eb", maxHeight: "400px", overflowY: "auto" }}>
        <h4 style={{ marginTop: 0, marginBottom: "1rem", fontSize: "1rem", fontWeight: 600, color: "#16a34a" }}>Converted (AI)</h4>
        {diff.length === 0 ? (
          <div style={{ textAlign: "center", color: "#6b7280", padding: "2rem" }}>No content</div>
        ) : (
          diff.map((line, index) => (
            <div key={index} style={{ display: "flex", borderBottom: index < diff.length - 1 ? "1px solid #e5e7eb" : "none", padding: "4px 0", alignItems: "flex-start" }}>
              <div style={{ width: "40px", textAlign: "right", paddingRight: "0.5rem", color: "#9ca3af", fontSize: "0.8rem", flexShrink: 0 }}>
                {line.lineNumber}
              </div>
              <div style={{ flex: 1, backgroundColor: line.changed ? "#f0fdf4" : "transparent", color: line.changed ? "#16a34a" : "#374151", padding: "2px 6px", borderRadius: "3px", lineHeight: 1.4 }}>
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