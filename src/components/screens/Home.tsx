import { useEffect, useState } from "preact/hooks";
import {
  aggregateDevices,
  fetchHomeInsights,
  fetchHomeReadings,
  fetchHistory,
} from "../../lib/api";
import { buildHeatingInsights, formatTemp } from "../../lib/insights";
import type {
  ChartPointDto,
  HeatingInsight,
  HomeInsightsResponse,
  HomeReadingsResponse,
  LiveSensor,
} from "../../lib/types";
import { HistoryChart } from "../HistoryChart";

interface Props {
  useCelsius: boolean;
}

function sensorValue(s: LiveSensor, useCelsius: boolean): string {
  if (s.kind === "temperature" && (s.temp?.f != null || s.value_num != null)) {
    const f = s.temp?.f ?? s.value_num!;
    return formatTemp(f, useCelsius);
  }
  if (s.value_bool != null) return s.value_bool ? "open/wet" : "closed/dry";
  if (s.value_text) return s.value_text;
  if (s.value_num != null) return `${s.value_num}${s.unit ? ` ${s.unit}` : ""}`;
  return "—";
}

function houseLegend(source?: string | null): string {
  if (!source) return "House";
  const s = source.toLowerCase();
  if (s.includes("nest")) return "Nest";
  if (s.includes("ecobee")) return "Ecobee";
  if (s.includes("reference") || s.includes("indoor")) return "Indoor reference";
  return source;
}

export function HomeScreen({ useCelsius }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [readings, setReadings] = useState<HomeReadingsResponse | null>(null);
  const [insights, setInsights] = useState<HomeInsightsResponse | null>(null);
  const [heating, setHeating] = useState<HeatingInsight[]>([]);
  const [chartPoints, setChartPoints] = useState<ChartPointDto[]>([]);
  const [housePoints, setHousePoints] = useState<ChartPointDto[]>([]);
  const [houseSource, setHouseSource] = useState<string | null>(null);
  const [space, setSpace] = useState<string | null>(null);

  async function refresh(selected = space) {
    setError(null);
    try {
      const [r, i, hist] = await Promise.all([
        fetchHomeReadings(selected),
        fetchHomeInsights(),
        fetchHistory(7).catch(() => null),
      ]);
      setReadings(r);
      setInsights(i);
      const points = hist?.chart?.points ?? [];
      setChartPoints(points);
      setHousePoints(hist?.house_overlay?.points ?? []);
      setHouseSource(hist?.house_overlay?.source ?? null);
      setHeating(
        buildHeatingInsights(
          points,
          i.outdoor_temp_f,
          i.freeze_threshold_f ?? 34,
          null,
          i.house ?? null,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 30_000);
    return () => clearInterval(id);
  }, [space]);

  if (loading && !readings) {
    return <div class="loading">Loading live readings…</div>;
  }

  const sensors = readings?.sensors ?? [];
  const spaces = readings?.spaces ?? [];
  const ttf = insights?.time_to_freeze;
  const devices = aggregateDevices(sensors);

  return (
    <div class="stack">
      {error && <div class="error-banner">{error}</div>}
      <div class="row">
        <button
          class={`chip ${space == null ? "active" : ""}`}
          onClick={() => setSpace(null)}
        >
          All spaces
        </button>
        {spaces.map((s) => (
          <button
            key={s}
            class={`chip ${space === s ? "active" : ""}`}
            onClick={() => setSpace(s)}
          >
            {s}
          </button>
        ))}
        <button class="btn btn-ghost" onClick={() => void refresh()}>
          Refresh
        </button>
      </div>

      <div class="grid">
        <div class="card">
          <div class="card-title">Time to freeze</div>
          <div class="metric">
            {ttf?.hours != null ? `${ttf.hours.toFixed(1)} h` : "—"}
          </div>
          <p class="card-sub" style={{ marginBottom: 0 }}>
            {ttf?.hits_at_label || ttf?.message || "From probeharbor.dev model"}
          </p>
        </div>
        <div class="card">
          <div class="card-title">Freeze threshold</div>
          <div class="metric">
            {formatTemp(insights?.freeze_threshold_f ?? 34, useCelsius)}
          </div>
          <p class="card-sub" style={{ marginBottom: 0 }}>
            Outdoor{" "}
            {insights?.outdoor_temp_f != null
              ? formatTemp(insights.outdoor_temp_f, useCelsius)
              : "—"}
          </p>
        </div>
        <div class="card">
          <div class="card-title">Devices</div>
          <div class="metric">{devices.length}</div>
          <p class="card-sub" style={{ marginBottom: 0 }}>
            Updated {readings?.updatedAt ?? "—"}
          </p>
        </div>
      </div>

      <div class="card">
        <HistoryChart
          points={chartPoints}
          housePoints={housePoints}
          houseLegend={houseLegend(houseSource)}
          title="Probe curves (7 days)"
          freezeThresholdF={insights?.freeze_threshold_f ?? 34}
          showHumidity
          compact
        />
      </div>

      {heating.length > 0 && (
        <div class="stack">
          {heating.map((h) => (
            <div
              key={h.label}
              class={`card ${h.severity === "warning" ? "insight-warn" : "insight-info"}`}
            >
              <div class="card-title">{h.label}</div>
              <p class="card-sub" style={{ marginBottom: 0 }}>
                {h.detail}
              </p>
            </div>
          ))}
        </div>
      )}

      {(insights?.nws_alerts?.length ?? 0) > 0 && (
        <div class="card">
          <div class="card-title">NWS alerts</div>
          <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
            {insights!.nws_alerts!.map((a) => (
              <li key={a.headline}>
                <strong>{a.event}</strong> — {a.headline}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div class="card">
        <div class="card-title">Live sensors</div>
        <p class="card-sub">Phone and desktop are companions — probes post to probeharbor.dev.</p>
        {sensors.length === 0 ? (
          <div class="empty">No sensors yet. Connect a probe or demo feed on the web.</div>
        ) : (
          <table class="table">
            <thead>
              <tr>
                <th>Label</th>
                <th>Device</th>
                <th>Space</th>
                <th>Kind</th>
                <th>Value</th>
                <th>Recorded</th>
              </tr>
            </thead>
            <tbody>
              {sensors.map((s) => (
                <tr key={`${s.deviceId}-${s.key}`}>
                  <td>{s.label}</td>
                  <td>{s.deviceName}</td>
                  <td>{s.space ?? "—"}</td>
                  <td>{s.kind}</td>
                  <td>{sensorValue(s, useCelsius)}</td>
                  <td class="muted">{s.recorded_at ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
