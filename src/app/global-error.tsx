"use client";

import { AlertTriangle } from "lucide-react";

/**
 * Root error boundary. Must be a Client Component (Next.js requirement).
 * Renders its own <html>/<body> because it replaces the root layout, and it
 * intentionally ships plain classes rather than app components, so a broken
 * theme provider can never stop the error page from rendering.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="id">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
          background: "#f7f8fb",
          color: "#141a24",
        }}
      >
        <div style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <div
            style={{
              width: 56,
              height: 56,
              margin: "0 auto 16px",
              borderRadius: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(239,68,68,0.12)",
              color: "#dc2626",
            }}
          >
            <AlertTriangle size={24} />
          </div>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px" }}>Terjadi kesalahan</h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "#5b667a", margin: 0 }}>
            {error.digest
              ? `Kode error: ${error.digest}. Coba muat ulang halaman ini.`
              : "Ada yang tidak beres saat memuat aplikasi. Coba muat ulang halaman ini."}
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 20,
              padding: "10px 20px",
              borderRadius: 12,
              border: "none",
              background: "#5b4bf5",
              color: "white",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Coba lagi
          </button>
        </div>
      </body>
    </html>
  );
}
