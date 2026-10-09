import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { fetchAlertEvents } from "./api";
import type { AlertEventDto } from "./types";

const SEEN_KEY = "tt-desktop-seen-alert-ids";
const ENABLED_KEY = "tt-desktop-push-enabled";

function loadSeen(): Set<number> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as number[];
    return new Set(parsed.filter((n) => Number.isFinite(n)));
  } catch {
    return new Set();
  }
}

function saveSeen(ids: Set<number>) {
  const trimmed = [...ids].sort((a, b) => b - a).slice(0, 200);
  localStorage.setItem(SEEN_KEY, JSON.stringify(trimmed));
}

export function isDesktopPushEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setDesktopPushEnabled(enabled: boolean) {
  localStorage.setItem(ENABLED_KEY, enabled ? "1" : "0");
}

async function ensurePermission(): Promise<boolean> {
  let granted = await isPermissionGranted();
  if (!granted) {
    const permission = await requestPermission();
    granted = permission === "granted";
  }
  return granted;
}

function notifyEvent(ev: AlertEventDto) {
  const title = ev.title?.trim() || "ProbeHarbor alert";
  const body = ev.body?.trim() || ev.kind || "New alert from your probes";
  sendNotification({ title, body });
}

/**
 * Poll alert events and raise OS notifications for newly seen rows.
 * First successful poll only seeds the seen set (no notification flood).
 */
export function startAlertNotificationPoller(
  enabled: () => boolean,
): () => void {
  let seen = loadSeen();
  let seeded = seen.size > 0;
  let stopped = false;
  let timer: number | undefined;

  async function tick() {
    if (stopped || !enabled() || !isDesktopPushEnabled()) return;
    try {
      const granted = await ensurePermission();
      if (!granted) return;

      const res = await fetchAlertEvents(20);
      const events = [...(res.events ?? [])].sort((a, b) => a.id - b.id);
      if (!seeded) {
        for (const ev of events) seen.add(ev.id);
        saveSeen(seen);
        seeded = true;
        return;
      }

      let changed = false;
      for (const ev of events) {
        if (seen.has(ev.id)) continue;
        seen.add(ev.id);
        changed = true;
        if (!ev.acknowledged_at) notifyEvent(ev);
      }
      if (changed) saveSeen(seen);
    } catch {
      // Ignore transient auth/network errors while polling.
    }
  }

  void tick();
  timer = window.setInterval(() => void tick(), 45_000);
  return () => {
    stopped = true;
    if (timer) window.clearInterval(timer);
  };
}
