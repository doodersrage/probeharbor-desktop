export type Route =
  | "home"
  | "history"
  | "alerts"
  | "devices"
  | "household"
  | "share"
  | "account"
  | "portfolio";

export interface TempSample {
  f: number;
  c: number;
  h?: number;
}

export interface LiveSensor {
  deviceId: string;
  deviceName: string;
  space?: string | null;
  key: string;
  label: string;
  kind: string;
  unit?: string | null;
  value_num?: number | null;
  value_bool?: boolean | null;
  value_text?: string | null;
  recorded_at?: string | null;
  temp?: TempSample | null;
}

export interface HomeReadingsResponse {
  updatedAt?: string | null;
  sensors?: LiveSensor[];
  spaces?: string[];
  error?: string | null;
}

export interface TimeToFreezeDto {
  hours?: number | null;
  hits_at?: string | null;
  hits_at_label?: string | null;
  confidence?: string | null;
  source?: string | null;
  message?: string | null;
  rate_f_per_hour?: number | null;
  freeze_threshold_f?: number | null;
  current_temp_f?: number | null;
}

export interface HouseInsightDto {
  source?: string;
  ambient_temp_f?: number;
  heat_setpoint_f?: number | null;
  hvac_mode?: string | null;
  detail?: string | null;
  reference_label?: string | null;
}

export interface HomeInsightsResponse {
  freeze_threshold_f?: number;
  outdoor_temp_f?: number | null;
  house?: HouseInsightDto | null;
  time_to_freeze?: TimeToFreezeDto | null;
  nights_at_risk?: Array<{
    date_label: string;
    min_temp_f: number;
    at_risk: boolean;
  }>;
  nws_alerts?: Array<{
    event: string;
    headline: string;
    severity: string;
    expires?: string | null;
  }>;
}

export interface ChartPointDto {
  timestamp: string;
  tempf: number;
  humidity?: number;
  probeLabel?: string;
}

export interface HistoryHouseOverlayDto {
  source?: string | null;
  points?: ChartPointDto[];
}

export interface HistoryResponse {
  days?: number;
  chart?: { points?: ChartPointDto[]; error?: string | null } | null;
  house_overlay?: HistoryHouseOverlayDto | null;
  readings?: {
    readings?: Array<{
      tempc?: number;
      tempf?: number;
      humidity?: number;
      timestamp?: string;
      feed_name?: string | null;
      probe_label?: string | null;
      probe_key?: string | null;
    }>;
    page?: number;
    pageSize?: number;
    totalCount?: number;
    totalPages?: number;
  } | null;
  filters?: {
    probes?: Array<{ key: string; label?: string }>;
  } | null;
  error?: string | null;
}

export interface UserPreferencesDto {
  showGarageTemps?: boolean;
  showWeather?: boolean;
  weatherCityId?: string | null;
  useCelsius?: boolean;
  theme?: string;
}

export interface AlertSettingsDto {
  enabled?: boolean;
  digestEnabled?: boolean;
  freezeThresholdF?: number;
  humidityThreshold?: number;
  rateChangeF?: number;
  outageHours?: number;
  email?: string | null;
  channelEmail?: boolean;
  channelSms?: boolean;
  channelDiscord?: boolean;
  channelPush?: boolean;
  channelWebhook?: boolean;
  channelTelegram?: boolean;
  channelSlack?: boolean;
  channelTeams?: boolean;
  channelNtfy?: boolean;
  channelPushover?: boolean;
  channelWhatsapp?: boolean;
  discordWebhookUrl?: string | null;
  slackWebhookUrl?: string | null;
  telegramBotToken?: string | null;
  telegramChatId?: string | null;
  forecastFreezeEnabled?: boolean;
  nwsFreezeAlertsEnabled?: boolean;
  forecastHoursAhead?: number;
  quietHoursEnabled?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  quietHoursTimezone?: string;
  quietHoursBypassFreeze?: boolean;
  quietHoursSmsCritical?: boolean;
  monthlyReportEnabled?: boolean;
  quarterlyReportEnabled?: boolean;
  dripEmailsEnabled?: boolean;
  batteryAlertsEnabled?: boolean;
  batteryTrendAlertsEnabled?: boolean;
  batteryThresholdPct?: number;
  rssiAlertsEnabled?: boolean;
  rssiThreshold?: number;
  escalationEnabled?: boolean;
  escalationMinutes?: number;
  feedUptimeAlertsEnabled?: boolean;
  portfolioAlertsEnabled?: boolean;
  snoozeUntil?: string | null;
  vacationUntil?: string | null;
  ntfyTopic?: string | null;
  ntfyServer?: string;
  smsPhone?: string | null;
  whatsappPhone?: string | null;
  outboundWebhookUrl?: string | null;
  readingWebhookUrl?: string | null;
}

export interface EntitlementsDto {
  tier?: string;
  canDownloadCsv?: boolean;
  canUseClaimsPack?: boolean;
  canCreateShareLinks?: boolean;
  canUsePush?: boolean;
  canUseSms?: boolean;
  historyDays?: number;
}

export interface UserExportResponse {
  exported_at?: string | null;
  user?: { id?: string | null; email?: string | null } | null;
  preferences?: UserPreferencesDto | null;
  alert_settings?: AlertSettingsDto | null;
  entitlements?: EntitlementsDto | null;
}

export interface AlertEventDto {
  id: number;
  kind?: string;
  title?: string;
  body?: string;
  channels_sent?: string[];
  created_at?: string | null;
  acknowledged_at?: string | null;
}

export interface AlertEventsResponse {
  events?: AlertEventDto[];
  unacked_count?: number;
  error?: string | null;
}

export interface HouseholdResponse {
  householdId?: string | null;
  members?: Array<{
    id?: string | null;
    household_id?: string | null;
    user_id?: string | null;
    role?: string;
    email?: string | null;
  }>;
  households?: Array<{
    household_id: string;
    role?: string;
    name?: string;
  }>;
  invites?: Array<{
    id: string;
    email?: string;
    role?: string;
    expires_at?: string | null;
  }>;
  error?: string | null;
}

export interface ShareLinkDto {
  id: string;
  token: string;
  scope?: string;
  label?: string | null;
  expires_at?: string | null;
  created_at?: string | null;
}

export interface ShareLinksResponse {
  links?: ShareLinkDto[];
  error?: string | null;
}

export interface PortfolioProperty {
  household_id: string;
  name: string;
  role: string;
  min_temp_f?: number | null;
  freeze_threshold_f?: number;
  at_risk?: boolean;
  last_reading_at?: string | null;
  device_count?: number;
}

export interface PortfolioResponse {
  properties?: PortfolioProperty[];
  error?: string | null;
}

export interface DeviceSummary {
  id: string;
  name: string;
  space: string | null;
  sensorCount: number;
  kinds: string[];
}

export interface HeatingInsight {
  label: string;
  detail: string;
  severity: "info" | "warning";
}
