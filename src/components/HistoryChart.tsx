import { useEffect, useMemo, useRef, useState } from "preact/hooks";

export type ChartPoint = {
  timestamp: string;
  tempf: number;
  humidity?: number;
  probeLabel?: string;
};

interface Props {
  points: ChartPoint[];
  housePoints?: ChartPoint[];
  houseLegend?: string | null;
  title?: string;
  freezeThresholdF?: number | null;
  showHumidity?: boolean;
  compact?: boolean;
}

const PROBE_COLORS = ["#60a5fa", "#34d399", "#f472b6", "#fbbf24", "#a78bfa", "#fb7185"];
const HOUSE_COLOR = "#f59e0b";
const COLOR_BELOW = "#38bdf8";
const COLOR_ABOVE = "#fb923c";
const HUMIDITY_COLOR = "#a78bfa";
const DEW_COLOR = "#2dd4bf";
const STORAGE_HIGH = "tt-desktop-chart-high-f";
const STORAGE_TARGET = "tt-desktop-chart-target-f";

function dewPointF(tempF: number, rhPct: number): number | null {
  if (!Number.isFinite(tempF) || !Number.isFinite(rhPct) || rhPct <= 0 || rhPct > 100) {
    return null;
  }
  const tC = (tempF - 32) * (5 / 9);
  const a = 17.62;
  const b = 243.12;
  const gamma = Math.log(rhPct / 100) + (a * tC) / (b + tC);
  const tdC = (b * gamma) / (a - gamma);
  if (!Number.isFinite(tdC)) return null;
  return tdC * (9 / 5) + 32;
}

function readStoredNumber(key: string): number | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null || raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeStoredNumber(key: string, value: number | null) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, String(value));
  } catch {
    /* ignore */
  }
}

function segmentColor(
  tempf: number,
  freeze: number | null,
  high: number | null,
  base: string,
): string {
  if (freeze != null && tempf <= freeze) return COLOR_BELOW;
  if (high != null && tempf >= high) return COLOR_ABOVE;
  return base;
}

export function HistoryChart({
  points,
  housePoints = [],
  houseLegend = "House",
  title = "Temperature trend",
  freezeThresholdF = null,
  showHumidity = true,
  compact = false,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const probeLabels = useMemo(
    () => [...new Set(points.map((p) => p.probeLabel || "Probe"))],
    [points],
  );

  const [highTempF, setHighTempF] = useState<number | null>(null);
  const [targetAmbientF, setTargetAmbientF] = useState<number | null>(null);
  const [humidityOn, setHumidityOn] = useState(showHumidity);
  const [hydrated, setHydrated] = useState(false);

  const humidityPoints = useMemo(() => {
    if (!showHumidity) return [] as ChartPoint[];
    const labeled = probeLabels.find((label) =>
      points.some(
        (p) =>
          (p.probeLabel || "Probe") === label &&
          Number.isFinite(p.humidity) &&
          (p.humidity ?? 0) > 0,
      ),
    );
    const source = labeled
      ? points.filter((p) => (p.probeLabel || "Probe") === labeled)
      : points;
    return source.filter((p) => Number.isFinite(p.humidity) && (p.humidity ?? 0) > 0);
  }, [points, probeLabels, showHumidity]);

  useEffect(() => {
    setHighTempF(readStoredNumber(STORAGE_HIGH));
    setTargetAmbientF(readStoredNumber(STORAGE_TARGET));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeStoredNumber(STORAGE_HIGH, highTempF);
  }, [highTempF, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    writeStoredNumber(STORAGE_TARGET, targetAmbientF);
  }, [targetAmbientF, hydrated]);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl || points.length < 2) return;

    const ctx = canvasEl.getContext("2d");
    if (!ctx) return;
    const g = ctx;
    const canvas = canvasEl;

    function draw() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, canvas.clientWidth);
      const height = Math.max(1, canvas.clientHeight);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);

      const plotHumidity = humidityOn && humidityPoints.length >= 2;
      const dewTemps = plotHumidity
        ? humidityPoints
            .map((p) => dewPointF(p.tempf, p.humidity ?? 0))
            .filter((v): v is number => v != null)
        : [];

      const pad = {
        top: 16,
        right: plotHumidity ? 40 : 16,
        bottom: 28,
        left: 44,
      };
      const innerW = width - pad.left - pad.right;
      const innerH = height - pad.top - pad.bottom;

      const sortedPoints = [...points].sort(
        (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp),
      );
      const minTs = Date.parse(sortedPoints[0]!.timestamp);
      const maxTs = Date.parse(sortedPoints[sortedPoints.length - 1]!.timestamp);
      const tsRange = maxTs - minTs || 1;

      const guideTemps = [freezeThresholdF, highTempF, targetAmbientF].filter(
        (v): v is number => v != null && Number.isFinite(v),
      );

      const allTemps = [
        ...points.map((p) => p.tempf),
        ...housePoints.map((p) => p.tempf),
        ...dewTemps,
        ...guideTemps,
      ];
      const min = Math.min(...allTemps) - 2;
      const max = Math.max(...allTemps) + 2;
      const range = max - min || 1;

      const yFor = (tempf: number) =>
        pad.top + innerH - ((tempf - min) / range) * innerH;
      const yForRh = (rh: number) =>
        pad.top + innerH - (Math.min(100, Math.max(0, rh)) / 100) * innerH;
      const xFor = (ts: number) =>
        pad.left + ((ts - minTs) / tsRange) * innerW;

      g.clearRect(0, 0, width, height);
      g.fillStyle = "#151b24";
      g.fillRect(0, 0, width, height);

      g.strokeStyle = "rgba(255,255,255,0.06)";
      g.lineWidth = 1;
      for (let i = 0; i <= 4; i++) {
        const y = pad.top + (innerH / 4) * i;
        g.beginPath();
        g.moveTo(pad.left, y);
        g.lineTo(width - pad.right, y);
        g.stroke();
        const val = max - (range / 4) * i;
        g.fillStyle = "#94a3b8";
        g.font = "10px system-ui, sans-serif";
        g.textAlign = "right";
        g.fillText(`${val.toFixed(0)}°F`, pad.left - 6, y + 3);
        if (plotHumidity) {
          const rh = 100 - (100 / 4) * i;
          g.textAlign = "left";
          g.fillStyle = HUMIDITY_COLOR;
          g.fillText(`${rh.toFixed(0)}%`, width - pad.right + 6, y + 3);
        }
      }

      function drawGuide(
        tempf: number | null,
        color: string,
        label: string,
        dash: number[],
      ) {
        if (tempf == null || !Number.isFinite(tempf)) return;
        const y = yFor(tempf);
        g.save();
        g.strokeStyle = color;
        g.lineWidth = 1.5;
        g.setLineDash(dash);
        g.beginPath();
        g.moveTo(pad.left, y);
        g.lineTo(width - pad.right, y);
        g.stroke();
        g.setLineDash([]);
        g.fillStyle = color;
        g.font = "10px system-ui, sans-serif";
        g.textAlign = "left";
        g.fillText(`${label} ${tempf.toFixed(0)}°F`, pad.left + 4, y - 4);
        g.restore();
      }

      drawGuide(freezeThresholdF, "rgba(56, 189, 248, 0.9)", "Freeze", [6, 4]);
      drawGuide(targetAmbientF, "rgba(167, 139, 250, 0.85)", "Target", [2, 4]);
      drawGuide(highTempF, "rgba(251, 146, 60, 0.9)", "High", [6, 4]);

      function drawSeriesColored(series: ChartPoint[], baseColor: string) {
        if (series.length < 2) return;
        const ordered = [...series].sort(
          (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp),
        );
        for (let i = 1; i < ordered.length; i++) {
          const a = ordered[i - 1]!;
          const b = ordered[i]!;
          const mid = (a.tempf + b.tempf) / 2;
          g.strokeStyle = segmentColor(mid, freezeThresholdF, highTempF, baseColor);
          g.lineWidth = 2;
          g.beginPath();
          g.moveTo(xFor(Date.parse(a.timestamp)), yFor(a.tempf));
          g.lineTo(xFor(Date.parse(b.timestamp)), yFor(b.tempf));
          g.stroke();
        }
      }

      function drawSeriesDashed(series: ChartPoint[], color: string) {
        if (series.length < 2) return;
        const ordered = [...series].sort(
          (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp),
        );
        g.save();
        g.strokeStyle = color;
        g.lineWidth = 2;
        g.setLineDash([6, 4]);
        g.beginPath();
        ordered.forEach((point, i) => {
          const x = xFor(Date.parse(point.timestamp));
          const y = yFor(point.tempf);
          if (i === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        });
        g.stroke();
        g.restore();
      }

      const byProbe = new Map<string, ChartPoint[]>();
      for (const point of points) {
        const label = point.probeLabel || "Probe";
        const list = byProbe.get(label) ?? [];
        list.push(point);
        byProbe.set(label, list);
      }

      [...byProbe.entries()].forEach(([, series], index) => {
        drawSeriesColored(series, PROBE_COLORS[index % PROBE_COLORS.length]!);
      });

      if (housePoints.length >= 2) {
        drawSeriesDashed(housePoints, HOUSE_COLOR);
      }

      if (plotHumidity) {
        const orderedHum = [...humidityPoints].sort(
          (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp),
        );
        g.save();
        g.strokeStyle = HUMIDITY_COLOR;
        g.lineWidth = 1.5;
        g.globalAlpha = 0.9;
        g.beginPath();
        orderedHum.forEach((point, i) => {
          const x = xFor(Date.parse(point.timestamp));
          const y = yForRh(point.humidity ?? 0);
          if (i === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        });
        g.stroke();

        g.strokeStyle = DEW_COLOR;
        g.setLineDash([4, 3]);
        g.beginPath();
        let dewStarted = false;
        for (const point of orderedHum) {
          const dew = dewPointF(point.tempf, point.humidity ?? 0);
          if (dew == null) continue;
          const x = xFor(Date.parse(point.timestamp));
          const y = yFor(dew);
          if (!dewStarted) {
            g.moveTo(x, y);
            dewStarted = true;
          } else {
            g.lineTo(x, y);
          }
        }
        g.stroke();
        g.restore();
      }

      g.fillStyle = "#94a3b8";
      g.font = "10px system-ui, sans-serif";
      g.textAlign = "left";
      g.fillText(new Date(minTs).toLocaleDateString(), pad.left, height - 8);
      g.textAlign = "right";
      g.fillText(new Date(maxTs).toLocaleDateString(), width - pad.right, height - 8);
    }

    draw();
    const ro = new ResizeObserver(() => draw());
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [
    points,
    housePoints,
    freezeThresholdF,
    highTempF,
    targetAmbientF,
    humidityOn,
    humidityPoints,
  ]);

  if (points.length < 2) {
    return (
      <div class="history-chart-wrap">
        <p class="history-chart-title">{title}</p>
        <div class="empty">Not enough readings yet for a chart.</div>
      </div>
    );
  }

  return (
    <div class="history-chart-wrap">
      <p class="history-chart-title">{title}</p>
      {probeLabels.length > 1 && (
        <p class="history-chart-legend">
          {probeLabels.map((label, i) => (
            <span key={label}>
              {i > 0 ? " · " : ""}
              <span style={{ color: PROBE_COLORS[i % PROBE_COLORS.length] }}>{label}</span>
            </span>
          ))}
        </p>
      )}
      {housePoints.length >= 2 && (
        <p class="history-chart-legend">
          <span style={{ color: HOUSE_COLOR }}>{houseLegend ?? "House"}</span>
          {" "}= dashed indoor / thermostat reference
        </p>
      )}
      {humidityOn && humidityPoints.length >= 2 && (
        <p class="history-chart-legend">
          <span style={{ color: HUMIDITY_COLOR }}>Humidity %</span>
          {" · "}
          <span style={{ color: DEW_COLOR }}>dew point °F</span> (dashed)
        </p>
      )}
      <p class="history-chart-legend">
        Trace turns <span style={{ color: COLOR_BELOW }}>cool</span> at/below freeze and{" "}
        <span style={{ color: COLOR_ABOVE }}>warm</span> at/above the high line.
      </p>
      <canvas
        ref={canvasRef}
        class={compact ? "history-chart-canvas compact" : "history-chart-canvas"}
        role="img"
        aria-label={title}
      />
      {!compact && (
        <form class="chart-threshold-controls" onSubmit={(e) => e.preventDefault()}>
          <label class="chart-threshold-field">
            <span>Target ambient (°F)</span>
            <input
              type="number"
              step="0.5"
              value={targetAmbientF ?? ""}
              placeholder="Optional"
              onInput={(e) => {
                const v = (e.target as HTMLInputElement).value;
                setTargetAmbientF(v === "" ? null : Number(v));
              }}
            />
          </label>
          <label class="chart-threshold-field">
            <span>High warning (°F)</span>
            <input
              type="number"
              step="0.5"
              value={highTempF ?? ""}
              placeholder="Optional"
              onInput={(e) => {
                const v = (e.target as HTMLInputElement).value;
                setHighTempF(v === "" ? null : Number(v));
              }}
            />
          </label>
          {showHumidity && humidityPoints.length >= 2 && (
            <label class="chart-threshold-field chart-threshold-check">
              <span>Humidity + dew</span>
              <input
                type="checkbox"
                checked={humidityOn}
                onChange={(e) =>
                  setHumidityOn((e.target as HTMLInputElement).checked)
                }
              />
            </label>
          )}
          {freezeThresholdF != null && (
            <p class="chart-threshold-note">
              Freeze line from alerts: {freezeThresholdF}°F
            </p>
          )}
        </form>
      )}
    </div>
  );
}
