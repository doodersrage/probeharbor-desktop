import { useEffect, useState } from "preact/hooks";
import { emailClaimsPack, fetchExport, fetchHistory, openExternal } from "../../lib/api";
import { formatTemp } from "../../lib/insights";
import type { HistoryResponse } from "../../lib/types";
import { HistoryChart } from "../HistoryChart";

interface Props {
  useCelsius: boolean;
  canClaims: boolean;
}

function houseLegend(source?: string | null): string {
  if (!source) return "House";
  const s = source.toLowerCase();
  if (s.includes("nest")) return "Nest";
  if (s.includes("ecobee")) return "Ecobee";
  if (s.includes("reference") || s.includes("indoor")) return "Indoor reference";
  return source;
}

export function HistoryScreen({ useCelsius, canClaims }: Props) {
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [days, setDays] = useState(7);
  const [probe, setProbe] = useState<string | null>(null);
  const [freezeThresholdF, setFreezeThresholdF] = useState<number | null>(34);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [claimsEmail, setClaimsEmail] = useState("");
  const [claimsMsg, setClaimsMsg] = useState<string | null>(null);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const [hist, exp] = await Promise.all([
        fetchHistory(days, probe),
        fetchExport().catch(() => null),
      ]);
      setData(hist);
      const thr = exp?.alert_settings?.freezeThresholdF;
      if (thr != null) setFreezeThresholdF(thr);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [days, probe]);

  const points = data?.chart?.points ?? [];
  const housePoints = data?.house_overlay?.points ?? [];
  const readings = data?.readings?.readings ?? [];
  const probes = data?.filters?.probes ?? [];

  return (
    <div class="stack">
      {error && <div class="error-banner">{error}</div>}
      {claimsMsg && <div class="success-banner">{claimsMsg}</div>}
      <div class="row">
        {[2, 7, 14, 30].map((d) => (
          <button
            key={d}
            class={`chip ${days === d ? "active" : ""}`}
            onClick={() => setDays(d)}
          >
            {d}d
          </button>
        ))}
        <button
          class={`chip ${probe == null ? "active" : ""}`}
          onClick={() => setProbe(null)}
        >
          All probes
        </button>
        {probes.map((p) => (
          <button
            key={p.key}
            class={`chip ${probe === p.key ? "active" : ""}`}
            onClick={() => setProbe(p.key)}
          >
            {p.label || p.key}
          </button>
        ))}
      </div>

      <div class="card">
        {loading ? (
          <div class="loading">Loading history…</div>
        ) : (
          <HistoryChart
            points={points}
            housePoints={housePoints}
            houseLegend={houseLegend(data?.house_overlay?.source)}
            title={`Temperature trend (last ${days} days)`}
            freezeThresholdF={freezeThresholdF}
            showHumidity
          />
        )}
      </div>

      <div class="card">
        <div class="card-title">Recent readings</div>
        {readings.length === 0 ? (
          <div class="empty">No readings in this window.</div>
        ) : (
          <table class="table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Probe</th>
                <th>Temp</th>
                <th>Humidity</th>
              </tr>
            </thead>
            <tbody>
              {readings.map((r, i) => (
                <tr key={`${r.timestamp}-${i}`}>
                  <td>{r.timestamp}</td>
                  <td>{r.probe_label ?? r.probe_key ?? "—"}</td>
                  <td>
                    {r.tempf != null ? formatTemp(r.tempf, useCelsius) : "—"}
                  </td>
                  <td>{r.humidity != null ? `${r.humidity.toFixed(0)}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {canClaims && (
        <div class="card">
          <div class="card-title">Claims pack (Pro)</div>
          <p class="card-sub">
            Email a PDF summary to an adjuster. Downloads stay on the web dashboard.
          </p>
          <div class="row">
            <div class="field">
              <label>Adjuster email</label>
              <input
                value={claimsEmail}
                onInput={(e) => setClaimsEmail((e.target as HTMLInputElement).value)}
                placeholder="adjuster@example.com"
              />
            </div>
            <button
              class="btn btn-primary"
              onClick={async () => {
                setClaimsMsg(null);
                try {
                  const res = await emailClaimsPack(claimsEmail);
                  setClaimsMsg(
                    res.verify_url
                      ? `Queued — verify at ${res.verify_url}`
                      : "Claims email queued",
                  );
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                }
              }}
            >
              Email claims pack
            </button>
            <button
              class="btn btn-ghost"
              onClick={() => void openExternal("https://probeharbor.dev/dashboard/history")}
            >
              Open web history
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
