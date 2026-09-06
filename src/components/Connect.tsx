import { useState } from "preact/hooks";
import { startLogin } from "../lib/api";

interface Props {
  onConnected: () => void;
}

export function ConnectScreen({ onConnected }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function connect(provider?: string) {
    setError(null);
    setBusy(provider ?? "email");
    try {
      await startLogin(provider);
      onConnected();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div class="connect-screen">
      <div class="connect-card">
        <div class="brand" style={{ padding: 0 }}>
          <span class="brand-thermal">Thermal</span>
          <span class="brand-trace">Trace</span>
        </div>
        <h1>Desktop companion</h1>
        <p>
          Sign in with your ThermalTrace account. The desktop is not a sensor —
          probes keep posting to thermaltrace.dev.
        </p>
        {error && <div class="error-banner" style={{ marginBottom: "1rem", textAlign: "left" }}>{error}</div>}
        <div class="connect-actions">
          <button
            class="btn btn-primary"
            disabled={!!busy}
            onClick={() => connect("google")}
          >
            {busy === "google" ? "Waiting for browser…" : "Connect with Google"}
          </button>
          <button
            class="btn"
            disabled={!!busy}
            onClick={() => connect("github")}
          >
            {busy === "github" ? "Waiting for browser…" : "Connect with GitHub"}
          </button>
          <button
            class="btn btn-ghost"
            disabled={!!busy}
            onClick={() => connect()}
          >
            {busy === "email" ? "Waiting for browser…" : "Connect with email"}
          </button>
        </div>
        <p class="muted" style={{ marginTop: "1.25rem", fontSize: "0.8rem" }}>
          Completes MFA in the browser if your account requires it.
        </p>
      </div>
    </div>
  );
}
