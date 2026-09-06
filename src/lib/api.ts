import { invoke } from "@tauri-apps/api/core";
import type {
  AlertEventsResponse,
  AlertSettingsDto,
  DeviceSummary,
  HistoryResponse,
  HomeInsightsResponse,
  HomeReadingsResponse,
  HouseholdResponse,
  LiveSensor,
  PortfolioResponse,
  ShareLinksResponse,
  UserExportResponse,
  UserPreferencesDto,
} from "./types";

export interface ApiResponse {
  status: number;
  body: string;
  location?: string | null;
}

function encodePath(path: string): string {
  if (!path.startsWith("/")) throw new Error("API path must start with /");
  return path;
}

export async function apiJson<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await invoke<ApiResponse>("api_request", {
    method,
    path: encodePath(path),
    body: body ?? null,
  });

  if (res.status === 401) {
    throw new Error(
      res.body.includes("MFA")
        ? "MFA required — finish MFA on thermaltrace.dev, then connect again"
        : "Session expired — connect again",
    );
  }
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`API error HTTP ${res.status}: ${res.body.slice(0, 200)}`);
  }
  if (!res.body) return {} as T;
  return JSON.parse(res.body) as T;
}

function assertFormSuccess(res: ApiResponse, successHints: string[]): string {
  const location = res.location ?? "";
  const okRedirect =
    res.status >= 300 &&
    res.status < 400 &&
    successHints.some((h) => location.includes(h));
  if (okRedirect) return location;

  if (location.includes("/signin")) {
    throw new Error("Session expired — connect again");
  }
  if (location.includes("pro_required") || location.includes("error=pro")) {
    throw new Error("Pro plan required");
  }
  if (location.includes("viewer") || location.includes("manager_required")) {
    throw new Error("Your household role cannot make this change");
  }
  if (location.includes("missing_email")) {
    throw new Error("Email is required");
  }
  throw new Error(
    `Save failed (HTTP ${res.status}${location ? `: ${location}` : ""})`,
  );
}

export async function apiForm(
  path: string,
  fields: Record<string, string>,
  successHints: string[],
): Promise<string> {
  const pairs = Object.entries(fields);
  const res = await invoke<ApiResponse>("api_form_post", {
    path: encodePath(path),
    fields: pairs,
  });
  return assertFormSuccess(res, successHints);
}

export async function startLogin(provider?: string): Promise<void> {
  await invoke("start_companion_login", {
    provider: provider ?? null,
  });
}

export async function disconnect(): Promise<void> {
  await invoke("disconnect_companion");
}

export async function hasSession(): Promise<boolean> {
  return invoke<boolean>("has_companion_session");
}

export async function openExternal(url: string): Promise<void> {
  await invoke("open_external", { url });
}

export async function fetchHomeReadings(
  space?: string | null,
): Promise<HomeReadingsResponse> {
  const q = space ? `&space=${encodeURIComponent(space)}` : "";
  return apiJson("GET", `/api/home/readings?save=0${q}`);
}

export async function fetchHomeInsights(): Promise<HomeInsightsResponse> {
  return apiJson("GET", "/api/user/home-insights");
}

export async function fetchHistory(
  days = 7,
  probe?: string | null,
): Promise<HistoryResponse> {
  const probeQ = probe ? `&probe=${encodeURIComponent(probe)}` : "";
  return apiJson(
    "GET",
    `/api/user/history?days=${days}&include=chart,readings,filters&page=1&page_size=20${probeQ}`,
  );
}

export async function fetchExport(): Promise<UserExportResponse> {
  return apiJson("GET", "/api/user/export");
}

export async function fetchAlertEvents(
  limit = 30,
): Promise<AlertEventsResponse> {
  return apiJson("GET", `/api/user/alert-events?limit=${limit}`);
}

export async function ackAlert(eventId: number): Promise<void> {
  await apiJson("POST", "/api/user/alert-events/ack", { event_id: eventId });
}

export async function testAlert(): Promise<void> {
  await apiJson("POST", "/api/user/alert-test");
}

export async function fetchHousehold(): Promise<HouseholdResponse> {
  return apiJson("GET", "/api/household");
}

export async function fetchShareLinks(): Promise<ShareLinksResponse> {
  return apiJson("GET", "/api/share/manage");
}

export async function fetchPortfolio(): Promise<PortfolioResponse> {
  return apiJson("GET", "/api/user/portfolio");
}

export function aggregateDevices(sensors: LiveSensor[]): DeviceSummary[] {
  const map = new Map<string, DeviceSummary>();
  for (const s of sensors) {
    const existing = map.get(s.deviceId);
    if (!existing) {
      map.set(s.deviceId, {
        id: s.deviceId,
        name: s.deviceName?.trim() || "Device",
        space: s.space ?? null,
        sensorCount: 1,
        kinds: [s.kind],
      });
    } else {
      existing.sensorCount += 1;
      if (!existing.kinds.includes(s.kind)) existing.kinds.push(s.kind);
    }
  }
  return [...map.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
}

function checkbox(fields: Record<string, string>, name: string, on: boolean) {
  if (on) fields[name] = "true";
}

export async function savePreferences(prefs: UserPreferencesDto): Promise<void> {
  const fields: Record<string, string> = {
    redirect: "/dashboard/settings",
    theme: prefs.theme || "dark",
  };
  checkbox(fields, "show_garage_temps", !!prefs.showGarageTemps);
  checkbox(fields, "show_weather", !!prefs.showWeather);
  checkbox(fields, "use_celsius", !!prefs.useCelsius);
  if (prefs.weatherCityId) fields.weather_city_id = prefs.weatherCityId;
  await apiForm("/api/user/preferences", fields, ["prefs_saved=1"]);
}

export async function saveAlertSettings(
  settings: AlertSettingsDto,
): Promise<void> {
  const fields: Record<string, string> = {
    redirect: "/dashboard/alerts",
    freeze_threshold_f: String(settings.freezeThresholdF ?? 34),
    humidity_threshold: String(settings.humidityThreshold ?? 75),
    rate_change_f: String(settings.rateChangeF ?? 15),
    outage_hours: String(settings.outageHours ?? 2),
    forecast_hours_ahead: String(settings.forecastHoursAhead ?? 12),
    quiet_hours_start: settings.quietHoursStart ?? "22:00",
    quiet_hours_end: settings.quietHoursEnd ?? "07:00",
    quiet_hours_timezone: settings.quietHoursTimezone ?? "America/New_York",
    battery_threshold_pct: String(settings.batteryThresholdPct ?? 20),
    rssi_threshold: String(settings.rssiThreshold ?? -90),
    escalation_minutes: String(settings.escalationMinutes ?? 60),
    ntfy_server: settings.ntfyServer ?? "https://ntfy.sh",
  };
  checkbox(fields, "alerts_enabled", !!settings.enabled);
  checkbox(fields, "digest_enabled", !!settings.digestEnabled);
  checkbox(fields, "monthly_report_enabled", !!settings.monthlyReportEnabled);
  checkbox(fields, "quarterly_report_enabled", !!settings.quarterlyReportEnabled);
  checkbox(fields, "drip_emails_enabled", !!settings.dripEmailsEnabled);
  checkbox(fields, "forecast_freeze_enabled", !!settings.forecastFreezeEnabled);
  checkbox(fields, "nws_freeze_alerts_enabled", !!settings.nwsFreezeAlertsEnabled);
  checkbox(fields, "quiet_hours_enabled", !!settings.quietHoursEnabled);
  checkbox(fields, "quiet_hours_bypass_freeze", !!settings.quietHoursBypassFreeze);
  checkbox(fields, "quiet_hours_sms_critical", !!settings.quietHoursSmsCritical);
  checkbox(fields, "battery_alerts_enabled", !!settings.batteryAlertsEnabled);
  checkbox(fields, "battery_trend_alerts_enabled", !!settings.batteryTrendAlertsEnabled);
  checkbox(fields, "rssi_alerts_enabled", !!settings.rssiAlertsEnabled);
  checkbox(fields, "escalation_enabled", !!settings.escalationEnabled);
  checkbox(fields, "feed_uptime_alerts_enabled", !!settings.feedUptimeAlertsEnabled);
  checkbox(fields, "portfolio_alerts_enabled", !!settings.portfolioAlertsEnabled);
  checkbox(fields, "channel_email", !!settings.channelEmail);
  checkbox(fields, "channel_sms", !!settings.channelSms);
  checkbox(fields, "channel_discord", !!settings.channelDiscord);
  checkbox(fields, "channel_push", !!settings.channelPush);
  checkbox(fields, "channel_webhook", !!settings.channelWebhook);
  checkbox(fields, "channel_telegram", !!settings.channelTelegram);
  checkbox(fields, "channel_slack", !!settings.channelSlack);
  checkbox(fields, "channel_teams", !!settings.channelTeams);
  checkbox(fields, "channel_ntfy", !!settings.channelNtfy);
  checkbox(fields, "channel_pushover", !!settings.channelPushover);
  checkbox(fields, "channel_whatsapp", !!settings.channelWhatsapp);
  if (settings.email) fields.alert_email = settings.email;
  if (settings.discordWebhookUrl) fields.discord_webhook_url = settings.discordWebhookUrl;
  if (settings.slackWebhookUrl) fields.slack_webhook_url = settings.slackWebhookUrl;
  if (settings.telegramBotToken) fields.telegram_bot_token = settings.telegramBotToken;
  if (settings.telegramChatId) fields.telegram_chat_id = settings.telegramChatId;
  if (settings.ntfyTopic) fields.ntfy_topic = settings.ntfyTopic;
  if (settings.smsPhone) fields.sms_phone = settings.smsPhone;
  if (settings.whatsappPhone) fields.whatsapp_phone = settings.whatsappPhone;
  if (settings.outboundWebhookUrl) fields.outbound_webhook_url = settings.outboundWebhookUrl;
  if (settings.readingWebhookUrl) fields.reading_webhook_url = settings.readingWebhookUrl;
  await apiForm("/api/user/alert-settings", fields, ["alert_saved=1"]);
}

export async function snoozeAlerts(hours: number): Promise<void> {
  await apiJson("POST", "/api/user/alert-snooze", {
    action: "snooze",
    hours,
  });
}

export async function clearSnooze(): Promise<void> {
  await apiJson("POST", "/api/user/alert-snooze", { action: "clear_snooze" });
}

export async function renameDevice(deviceId: string, name: string): Promise<void> {
  await apiForm(
    "/api/devices",
    {
      redirect: "/dashboard/temperature",
      action: "rename",
      device_id: deviceId,
      name: name.trim(),
    },
    ["device_renamed=1"],
  );
}

export async function setDeviceSpace(
  deviceId: string,
  space: string,
): Promise<void> {
  await apiForm(
    "/api/devices",
    {
      redirect: "/dashboard/temperature",
      action: "set_space",
      device_id: deviceId,
      space: space.trim(),
    },
    ["device_renamed=1"],
  );
}

export async function renameHousehold(name: string): Promise<void> {
  await apiForm(
    "/api/household",
    {
      redirect: "/dashboard/household",
      action: "rename",
      name: name.trim(),
    },
    ["saved=1"],
  );
}

export async function inviteMember(email: string, role: string): Promise<void> {
  await apiForm(
    "/api/household",
    {
      redirect: "/dashboard/household",
      action: "invite",
      email: email.trim(),
      role,
    },
    ["invited=1"],
  );
}

export async function switchHousehold(householdId: string): Promise<void> {
  await apiForm(
    "/api/household",
    {
      redirect: "/dashboard/household",
      action: "switch",
      household_id: householdId,
    },
    ["switched=1"],
  );
}

export async function createShareLink(
  label: string,
  scope: string,
  expiresDays: number,
): Promise<string | null> {
  const location = await apiForm(
    "/api/share/manage",
    {
      redirect: "/dashboard/share",
      action: "create",
      label: label.trim(),
      scope,
      expires_days: String(expiresDays),
    },
    ["created=1"],
  );
  const match = /[?&]new_token=([^&]+)/.exec(location);
  return match ? decodeURIComponent(match[1]) : null;
}

export async function revokeShareLink(id: string): Promise<void> {
  await apiForm(
    "/api/share/manage",
    {
      redirect: "/dashboard/share",
      action: "revoke",
      id,
    },
    ["revoked=1"],
  );
}

export async function emailClaimsPack(
  adjusterEmail: string,
): Promise<{ verify_url?: string; verification_code?: string }> {
  return apiJson("POST", "/api/claims/email", {
    adjuster_email: adjusterEmail,
  });
}
