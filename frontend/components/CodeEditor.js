export default function CodeEditor({ value, onChange, label, readOnly = false }) {
  return (
    <label style={{ display: "block", marginBottom: "1rem" }}>
      <div style={{ marginBottom: "0.5rem", fontWeight: "600" }}>{label}</div>
      <textarea
        value={value}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        readOnly={readOnly}
        rows={12}
        style={{
          width: "100%",
          padding: "1rem",
          borderRadius: "8px",
          border: "1px solid #d1d5db",
          background: readOnly ? "#f8fafc" : "white",
          fontFamily: "monospace",
        }}
      />
    </label>
  );
}
