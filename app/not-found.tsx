export default function NotFound() {
  return (
    <main style={{ maxWidth: 720, margin: "12vh auto", padding: 32, fontFamily: "Inter, sans-serif" }}>
      <p style={{ letterSpacing: 2, textTransform: "uppercase" }}>NAKA Hair</p>
      <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 48 }}>Page not found</h1>
      <p>The page you requested does not exist.</p>
      <a href="/" style={{ display: "inline-block", marginTop: 20, color: "#111" }}>
        Return to the store
      </a>
    </main>
  );
}
