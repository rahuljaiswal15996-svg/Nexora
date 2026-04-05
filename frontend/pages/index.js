import Link from "next/link";

export default function Home() {
  return (
    <main style={{ padding: "2rem", fontFamily: "Arial, sans-serif" }}>
      <h1>Nexora MVP</h1>
      <p>FastAPI backend + Next.js frontend for code upload, conversion, comparison, and history.</p>
      <div style={{ display: "flex", gap: "1rem", marginTop: "2rem" }}>
        <Link href="/compare" legacyBehavior>
          <a style={{ padding: "1rem 1.5rem", background: "#2563eb", color: "white", borderRadius: "8px", textDecoration: "none" }}>
            Go to Compare
          </a>
        </Link>
        <Link href="/history" legacyBehavior>
          <a style={{ padding: "1rem 1.5rem", background: "#10b981", color: "white", borderRadius: "8px", textDecoration: "none" }}>
            View History
          </a>
        </Link>
        <Link href="/upload" legacyBehavior>
          <a style={{ padding: "1rem 1.5rem", background: "#f59e0b", color: "white", borderRadius: "8px", textDecoration: "none" }}>
            Upload / Parse
          </a>
        </Link>
        <Link href="/pipelines" legacyBehavior>
          <a style={{ padding: "1rem 1.5rem", background: "#7c3aed", color: "white", borderRadius: "8px", textDecoration: "none" }}>
            Pipelines
          </a>
        </Link>
        <Link href="/review" legacyBehavior>
          <a style={{ padding: "1rem 1.5rem", background: "#ef4444", color: "white", borderRadius: "8px", textDecoration: "none" }}>
            Review HITL
          </a>
        </Link>
      </div>
    </main>
  );
}
