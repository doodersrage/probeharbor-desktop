import type { ChartPointDto, HeatingInsight, HouseInsightDto } from "./types";

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

function parseMillis(ts: string): number {
  const t = Date.parse(ts);
  return Number.isFinite(t) ? t : 0;
}

function estimateHeatingLossRate(
  indoorPoints: ChartPointDto[],
  outdoorTempF: number | null | undefined,
): number | null {
  const temps = indoorPoints.filter((p) => Number.isFinite(p.tempf)).slice(-12);
  if (temps.length < 2) return null;
  const first = temps[0];
  const last = temps[temps.length - 1];
  const hours =
    (parseMillis(last.timestamp) - parseMillis(first.timestamp)) /
    (60 * 60 * 1000);
  if (hours <= 0) return null;
  const rate = (last.tempf - first.tempf) / hours;
  if (!Number.isFinite(rate)) return null;
  if (outdoorTempF != null && outdoorTempF < 32 && rate < 0) return rate;
  return rate;
}

export function buildHeatingInsights(
  indoorPoints: ChartPointDto[],
  outdoorTempF: number | null | undefined,
  freezeThresholdF: number,
  doorOpenMinutes: number | null = null,
  house: HouseInsightDto | null = null,
): HeatingInsight[] {
  const insights: HeatingInsight[] = [];
  const latest = [...indoorPoints].reverse().find((p) => Number.isFinite(p.tempf));
  if (!latest) return insights;

  const rate = estimateHeatingLossRate(indoorPoints, outdoorTempF);
  if (rate != null && rate <= -2) {
    insights.push({
      label: "Rapid temperature drop",
      detail: `Space is falling about ${Math.abs(rate).toFixed(1)}°F/h. Check doors, heaters, and insulation.`,
      severity: "warning",
    });
  }

  if (
    doorOpenMinutes != null &&
    doorOpenMinutes >= 10 &&
    rate != null &&
    rate < 0
  ) {
    insights.push({
      label: "Door may be driving heat loss",
      detail: `Door open ~${Math.round(doorOpenMinutes)} min while temperature is falling.`,
      severity: "warning",
    });
  }

  if (latest.tempf <= freezeThresholdF + 5) {
    insights.push({
      label: "Near freeze threshold",
      detail: `Current ${latest.tempf.toFixed(1)}°F — threshold is ${freezeThresholdF.toFixed(0)}°F.`,
      severity: latest.tempf <= freezeThresholdF ? "warning" : "info",
    });
  }

  if (outdoorTempF != null && outdoorTempF <= 20 && latest.tempf > freezeThresholdF) {
    const margin = latest.tempf - freezeThresholdF;
    insights.push({
      label: "Holding above freeze outdoors",
      detail: `Outdoor ${outdoorTempF.toFixed(0)}°F; indoor margin ${margin.toFixed(1)}°F.`,
      severity: "info",
    });
  }

  const humid = indoorPoints
    .filter((p) => (p.humidity ?? 0) > 0)
    .slice(-1)[0];
  if (humid?.humidity) {
    const dew = dewPointF(humid.tempf, humid.humidity);
    if (dew != null && humid.tempf - dew < 5) {
      insights.push({
        label: "Condensation risk",
        detail: `Dew point ~${dew.toFixed(0)}°F is close to air temp ${humid.tempf.toFixed(0)}°F.`,
        severity: "warning",
      });
    }
  }

  if (house?.ambient_temp_f != null && house.ambient_temp_f > 0) {
    const delta = latest.tempf - house.ambient_temp_f;
    if (Math.abs(delta) >= 8) {
      insights.push({
        label: delta < 0 ? "Colder than house reference" : "Warmer than house reference",
        detail: `Probe ${latest.tempf.toFixed(1)}°F vs house ${house.ambient_temp_f.toFixed(1)}°F${
          house.reference_label ? ` (${house.reference_label})` : ""
        }.`,
        severity: delta < 0 ? "warning" : "info",
      });
    }
  }

  return insights.slice(0, 6);
}

export function formatTemp(f: number, useCelsius: boolean): string {
  if (useCelsius) {
    const c = ((f - 32) * 5) / 9;
    return `${c.toFixed(1)}°C`;
  }
  return `${f.toFixed(1)}°F`;
}
