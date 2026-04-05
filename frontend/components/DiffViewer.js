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
    <div style={{ fontFamily: "monospace", fontSize: "0.9rem", background: "#f8f9fa", borderRadius: "8px", padding: "1rem" }}>
      {diff.map((line, index) => {
        return (
          <div key={index} style={{ display: "flex", borderBottom: "1px solid #e9ecef", padding: "2px 0" }}>
            <div style={{ width: "60px", textAlign: "right", paddingRight: "1rem", color: "#6c757d", fontSize: "0.8rem" }}>
              {line.lineNumber}
            </div>
            <div style={{ flex: 1 }}>
              {line.oldLine && (
                <div style={{ color: line.changed ? "#dc3545" : "#6c757d", background: line.changed ? "#f8d7da" : "transparent", padding: "2px 4px", marginBottom: line.changed ? "2px" : "0" }}>
                  {line.changed ? `- ${line.oldLine}` : `  ${line.oldLine}`}
                </div>
              )}
              {line.newLine && (
                <div style={{ color: line.changed ? "#28a745" : "#6c757d", background: line.changed ? "#d4edda" : "transparent", padding: "2px 4px" }}>
                  {line.changed ? `+ ${line.newLine}` : `  ${line.newLine}`}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderSplitDiff = () => (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", fontFamily: "monospace", fontSize: "0.9rem" }}>
      <div style={{ background: "#f8f9fa", borderRadius: "8px", padding: "1rem" }}>
        <h5 style={{ marginTop: 0, color: "#dc3545" }}>Original</h5>
        {diff.map((line, index) => (
          <div key={index} style={{ display: "flex", borderBottom: "1px solid #e9ecef" }}>
            <div style={{ width: "40px", textAlign: "right", paddingRight: "0.5rem", color: "#6c757d", fontSize: "0.8rem" }}>
              {line.lineNumber}
            </div>
            <div style={{
              flex: 1,
              background: line.changed ? "#f8d7da" : "transparent",
              color: line.changed ? "#721c24" : "#212529",
              padding: "2px 4px"
            }}>
              {line.oldLine || " "}
            </div>
          </div>
        ))}
      </div>
      <div style={{ background: "#f8f9fa", borderRadius: "8px", padding: "1rem" }}>
        <h5 style={{ marginTop: 0, color: "#28a745" }}>Converted</h5>
        {diff.map((line, index) => (
          <div key={index} style={{ display: "flex", borderBottom: "1px solid #e9ecef" }}>
            <div style={{ width: "40px", textAlign: "right", paddingRight: "0.5rem", color: "#6c757d", fontSize: "0.8rem" }}>
              {line.lineNumber}
            </div>
            <div style={{
              flex: 1,
              background: line.changed ? "#d4edda" : "transparent",
              color: line.changed ? "#155724" : "#212529",
              padding: "2px 4px"
            }}>
              {line.newLine || " "}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: "1rem" }}>
        <label style={{ marginRight: "1rem" }}>
          <input
            type="radio"
            value="unified"
            checked={viewMode === "unified"}
            onChange={(e) => setViewMode(e.target.value)}
          />
          Unified Diff
        </label>
        <label>
          <input
            type="radio"
            value="split"
            checked={viewMode === "split"}
            onChange={(e) => setViewMode(e.target.value)}
          />
          Split View
        </label>
      </div>

      {viewMode === "unified" ? renderUnifiedDiff() : renderSplitDiff()}
    </div>
  );
}

export default DiffViewer;