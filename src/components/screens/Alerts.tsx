import { useEffect, useState } from "preact/hooks";
import {
  ackAlert,
  clearSnooze,
  fetchAlertEvents,
  fetchExport,
  saveAlertSettings,
  snoozeAlerts,
  testAlert,
} from "../../lib/api";
import type {
  AlertEventDto,
  AlertSettingsDto,
  UserExportResponse,
} from "../../lib/types";

function defaults(s?: AlertSettingsDto | null): AlertSettingsDto {
  return {
    enabled: s?.enabled ?? false,
    digestEnabled: s?.digestEnabled ?? false,
    freezeThresholdF: s?.freezeThresholdF ?? 34,
    humidityThreshold: s?.humidityThreshold ?? 75,
    rateChangeF: s?.rateChangeF ?? 15,
    outageHours: s?.outageHours ?? 2,
    email: s?.email ?? "",
    channelEmail: s?.channelEmail ?? true,
    channelSms: s?.channelSms ?? false,
    channelDiscord: s?.channelDiscord ?? false,
    channelPush: s?.channelPush ?? false,
    channelWebhook: s?.channelWebhook ?? false,
    channelTelegram: s?.channelTelegram ?? false,
    channelSlack: s?.channelSlack ?? false,
    channelTeams: s?.channelTeams ?? false,
    channelNtfy: s?.channelNtfy ?? false,
    channelPushover: s?.channelPushover ?? false,
    channelWhatsapp: s?.channelWhatsapp ?? false,
    discordWebhookUrl: s?.discordWebhookUrl ?? "",
    forecastFreezeEnabled: s?.forecastFreezeEnabled ?? false,
    nwsFreezeAlertsEnabled: s?.nwsFreezeAlertsEnabled ?? false,
    forecastHoursAhead: s?.forecastHoursAhead ?? 12,
    quietHoursEnabled: s?.quietHoursEnabled ?? false,
    quietHoursStart: s?.quietHoursStart ?? "22:00",
    quietHoursEnd: s?.quietHoursEnd ?? "07:00",
    quietHoursTimezone: s?.quietHoursTimezone ?? "America/New_York",
    quietHoursBypassFreeze: s?.quietHoursBypassFreeze ?? true,
    snoozeUntil: s?.snoozeUntil ?? null,
  };
}

export function AlertsScreen() {
  const [settings, setSettings] = useState<AlertSettingsDto>(defaults());
  const [events, setEvents] = useState<AlertEventDto[]>([]);
  const [unacked, setUnacked] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const [exp, ev]: [UserExportResponse, Awaited<ReturnType<typeof fetchAlertEvents>>] =
        await Promise.all([fetchExport(), fetchAlertEvents()]);
      setSettings(defaults(exp.alert_settings));
      setEvents(ev.events ?? []);
      setUnacked(ev.unacked_count ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (loading) return <div class="loading">Loading alert settings…</div>;

  return (
    <div class="stack">
      {error && <div class="error-banner">{error}</div>}
      {msg && <div class="success-banner">{msg}</div>}

      <div class="card stack">
        <div class="card-title">Thresholds & channels</div>
        <p class="card-sub">
          Saves to the same form endpoints as the web dashboard and Android app.
          {settings.snoozeUntil ? ` Snoozed until ${settings.snoozeUntil}.` : ""}
        </p>
        <label class="check">
          <input
            type="checkbox"
            checked={!!settings.enabled}
            onChange={(e) =>
              setSettings({ ...settings, enabled: (e.target as HTMLInputElement).checked })
            }
          />
          Alerts enabled
        </label>
        <div class="row">
          <div class="field">
            <label>Freeze threshold °F</label>
            <input
              type="number"
              value={settings.freezeThresholdF ?? 34}
              onInput={(e) =>
                setSettings({
                  ...settings,
                  freezeThresholdF: Number((e.target as HTMLInputElement).value),
                })
              }
            />
          </div>
          <div class="field">
            <label>Humidity threshold %</label>
            <input
              type="number"
              value={settings.humidityThreshold ?? 75}
              onInput={(e) =>
                setSettings({
                  ...settings,
                  humidityThreshold: Number((e.target as HTMLInputElement).value),
                })
              }
            />
          </div>
          <div class="field">
            <label>Alert email</label>
            <input
              value={settings.email ?? ""}
              onInput={(e) =>
                setSettings({ ...settings, email: (e.target as HTMLInputElement).value })
              }
            />
          </div>
        </div>
        <div class="row">
          {(
            [
              ["channelEmail", "Email"],
              ["channelSms", "SMS"],
              ["channelDiscord", "Discord"],
              ["channelPush", "Push"],
              ["channelTelegram", "Telegram"],
              ["channelSlack", "Slack"],
              ["channelWebhook", "Webhook"],
            ] as const
          ).map(([key, label]) => (
            <label class="check" key={key}>
              <input
                type="checkbox"
                checked={!!settings[key]}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    [key]: (e.target as HTMLInputElement).checked,
                  })
                }
              />
              {label}
            </label>
          ))}
        </div>
        <div class="row">
          <button
            class="btn btn-primary"
            onClick={async () => {
              setMsg(null);
              setError(null);
              try {
                await saveAlertSettings(settings);
                setMsg("Alert settings saved");
                await load();
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              }
            }}
          >
            Save settings
          </button>
          <button
            class="btn"
            onClick={async () => {
              try {
                await snoozeAlerts(8);
                setMsg("Snoozed 8 hours");
                await load();
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              }
            }}
          >
            Snooze 8h
          </button>
          <button
            class="btn btn-ghost"
            onClick={async () => {
              try {
                await clearSnooze();
                setMsg("Snooze cleared");
                await load();
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              }
            }}
          >
            Clear snooze
          </button>
          <button
            class="btn btn-ghost"
            onClick={async () => {
              try {
                await testAlert();
                setMsg("Test alert sent");
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              }
            }}
          >
            Test alert
          </button>
        </div>
      </div>

      <div class="card">
        <div class="card-title">
          Recent events {unacked > 0 && <span class="badge warn">{unacked} unacked</span>}
        </div>
        {events.length === 0 ? (
          <div class="empty">No alert events yet.</div>
        ) : (
          <table class="table">
            <thead>
              <tr>
                <th>When</th>
                <th>Title</th>
                <th>Kind</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.id}>
                  <td class="muted">{ev.created_at ?? "—"}</td>
                  <td>
                    <div>{ev.title}</div>
                    <div class="muted">{ev.body}</div>
                  </td>
                  <td>{ev.kind}</td>
                  <td>
                    {!ev.acknowledged_at && (
                      <button
                        class="btn btn-ghost"
                        onClick={async () => {
                          try {
                            await ackAlert(ev.id);
                            await load();
                          } catch (e) {
                            setError(e instanceof Error ? e.message : String(e));
                          }
                        }}
                      >
                        Ack
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
