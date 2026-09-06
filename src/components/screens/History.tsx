import { useEffect, useMemo, useState } from "preact/hooks";
import { emailClaimsPack, fetchHistory, openExternal } from "../../lib/api";
import { formatTemp } from "../../lib/insights";
import type { ChartPointDto, HistoryResponse } from "../../lib/types";

interface Props {
  useCelsius: boolean;
  canClaims: boolean;
}

function Chart({ points, useCelsius }: { points: ChartPointDto[]; useCelsius: boolean }) {
  const path = useMemo(() => {
    if (points.length < 2) return "";
    const temps = points.map((p) => p.tempf);
    const min = Math.min(...temps);
    const max = Math.max(...temps);
    const span = Math.max(max - min, 1);
    const w = 640;
    const h = 200;
    const pad = 12;
    return points
      .map((p, i) => {
        const x = pad + (i / (points.length - 1)) * (w - pad * 2);
        const y = pad + (1 - (p.tempf - min) / span) * (h - pad * 2);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  }, [points]);

  if (points.length < 2) {
    return <div class="empty">Not enough chart points yet.</div>;
  }

  const last = points[points.length - 1];
  return (
    <div>
      <svg class="chart" viewBox="0 0 640 220" role="img" aria-label="Temperature history">
        <path d={path} fill="none" stroke="#e85500" stroke-width="2.5" />
      </svg>
      <p class="muted" style={{ margin: 0 }}>
        Latest {formatTemp(last.tempf, useCelsius)} · {points.length} points
      </p>
    </div>
  );
}

export function HistoryScreen({ useCelsius, canClaims }: Props) {
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [days, setDays] = useState(7);
  const [probe, setProbe] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [claimsEmail, setClaimsEmail] = useState("");
  const [claimsMsg, setClaimsMsg] = useState<string | null>(null);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      setData(await fetchHistory(days, probe));
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
        <div class="card-title">Week chart</div>
        {loading ? (
          <div class="loading">Loading history…</div>
        ) : (
          <Chart points={points} useCelsius={useCelsius} />
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
              onClick={() => void openExternal("https://thermaltrace.dev/dashboard/history")}
            >
              Open web history
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
