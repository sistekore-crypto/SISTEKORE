import React from "react";

/**
 * ErrorBoundary — atrapa errores de React para que toda la app no se caiga
 * Si un módulo crashea, muestra una pantalla amigable con opción de recargar
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Log en consola para debug en producción
    console.error("[SisteKore] Error capturado:", error);
    console.error("Stack del componente:", info?.componentStack);
    this.setState({ info });
  }

  render() {
    if (this.state.hasError) {
      const styles = {
        wrap: { position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "#F8FAFC", fontFamily: "system-ui,-apple-system,sans-serif", overflow: "auto" },
        card: { maxWidth: 540, width: "100%", background: "#FFF", borderRadius: 14, padding: 28, boxShadow: "0 8px 24px rgba(0,0,0,.08)", border: "1px solid #E2E8F0" },
        header: { display: "flex", alignItems: "center", gap: 12, marginBottom: 16 },
        icon: { width: 48, height: 48, borderRadius: 10, background: "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 },
        title: { fontSize: 18, fontWeight: 700, color: "#1A2E4A", margin: 0 },
        sub: { fontSize: 12, color: "#64748B", marginTop: 3 },
        msg: { fontSize: 13, color: "#475569", lineHeight: 1.6, marginBottom: 14 },
        details: { background: "#F1F5F9", borderRadius: 8, padding: 11, fontSize: 11, fontFamily: "ui-monospace,monospace", color: "#475569", maxHeight: 140, overflow: "auto", marginBottom: 16, border: "1px solid #E2E8F0" },
        btnRow: { display: "flex", gap: 8, flexWrap: "wrap" },
        btn: { padding: "9px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" },
        btnPrimary: { background: "#C0392B", color: "#FFF" },
        btnSecondary: { background: "#FFF", color: "#475569", border: "1px solid #CBD5E1" }
      };
      return (
        <div style={styles.wrap}>
          <div style={styles.card}>
            <div style={styles.header}>
              <div style={styles.icon}>⚠️</div>
              <div>
                <h1 style={styles.title}>Algo salió mal</h1>
                <div style={styles.sub}>SisteKore encontró un error inesperado</div>
              </div>
            </div>
            <p style={styles.msg}>
              No te preocupes, tus datos están seguros. Esto es un error temporal del sistema.
              Por favor recarga la página para continuar.
            </p>
            {this.state.error && (
              <div style={styles.details}>
                <strong>Detalle técnico:</strong><br />
                {this.state.error.toString()}
              </div>
            )}
            <div style={styles.btnRow}>
              <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={() => window.location.reload()}>
                🔄 Recargar aplicación
              </button>
              <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={() => this.setState({ hasError: false, error: null, info: null })}>
                ↩ Intentar de nuevo
              </button>
            </div>
            <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 16, textAlign: "center" }}>
              Si el problema persiste, contacta a soporte: <strong>sistekore@gmail.com</strong>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
