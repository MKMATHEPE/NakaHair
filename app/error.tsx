"use client";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <main style={{ maxWidth: 720, margin: "12vh auto", padding: 32, fontFamily: "Inter, sans-serif" }}>
      <p style={{ letterSpacing: 2, textTransform: "uppercase" }}>NAKA Hair</p>
      <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 48 }}>Something went wrong</h1>
      <p>We could not load this page. Please try again.</p>
      <button
        type="button"
        onClick={reset}
        style={{ marginTop: 20, padding: "14px 24px", background: "#111", color: "#fff", border: 0 }}
      >
        Try again
      </button>
    </main>
  );
}
