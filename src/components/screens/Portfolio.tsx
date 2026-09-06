import { useEffect, useState } from "preact/hooks";
import { fetchPortfolio, switchHousehold } from "../../lib/api";
import { formatTemp } from "../../lib/insights";
import type { PortfolioProperty } from "../../lib/types";

interface Props {
  useCelsius: boolean;
  onSwitched: () => void;
}

export function PortfolioScreen({ useCelsius, onSwitched }: Props) {
  const [properties, setProperties] = useState<PortfolioProperty[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetchPortfolio();
      setProperties(res.properties ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (loading) return <div class="loading">Loading portfolio…</div>;

  return (
    <div class="stack">
      {error && <div class="error-banner">{error}</div>}
      <div class="card">
        <div class="card-title">Properties</div>
        <p class="card-sub">Cross-household overview. Switch to manage a property.</p>
        {properties.length === 0 ? (
          <div class="empty">No portfolio properties yet.</div>
        ) : (
          <div class="grid">
            {properties.map((p) => (
              <div class="card" key={p.household_id} style={{ background: "var(--color-bg)" }}>
                <div class="card-title">
                  {p.name}{" "}
                  {p.at_risk ? <span class="badge danger">at risk</span> : <span class="badge ok">ok</span>}
                </div>
                <div class="metric">
                  {p.min_temp_f != null ? formatTemp(p.min_temp_f, useCelsius) : "—"}
                </div>
                <p class="card-sub">
                  Threshold {formatTemp(p.freeze_threshold_f ?? 34, useCelsius)} ·{" "}
                  {p.device_count ?? 0} devices · {p.role}
                </p>
                <button
                  class="btn btn-ghost"
                  onClick={async () => {
                    try {
                      await switchHousehold(p.household_id);
                      onSwitched();
                    } catch (e) {
                      setError(e instanceof Error ? e.message : String(e));
                    }
                  }}
                >
                  Switch here
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
