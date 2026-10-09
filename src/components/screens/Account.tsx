import { useEffect, useState } from "preact/hooks";
import {
  disconnect,
  fetchExport,
  openExternal,
  savePreferences,
} from "../../lib/api";
import {
  isDesktopPushEnabled,
  setDesktopPushEnabled,
} from "../../lib/notifications";
import type { UserPreferencesDto } from "../../lib/types";

interface Props {
  onPrefs: (prefs: UserPreferencesDto) => void;
  onSignedOut: () => void;
  canPush?: boolean;
}

export function AccountScreen({ onPrefs, onSignedOut, canPush = false }: Props) {
  const [email, setEmail] = useState<string>("");
  const [tier, setTier] = useState("free");
  const [prefs, setPrefs] = useState<UserPreferencesDto>({
    theme: "dark",
    useCelsius: false,
    showGarageTemps: true,
    showWeather: true,
    weatherCityId: "",
  });
  const [desktopPush, setDesktopPush] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const exp = await fetchExport();
      setEmail(exp.user?.email ?? "");
      setTier(exp.entitlements?.tier ?? "free");
      const p = exp.preferences ?? {};
      setPrefs({
        theme: p.theme ?? "dark",
        useCelsius: !!p.useCelsius,
        showGarageTemps: p.showGarageTemps ?? true,
        showWeather: p.showWeather ?? true,
        weatherCityId: p.weatherCityId ?? "",
      });
      setDesktopPush(isDesktopPushEnabled());
      onPrefs(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (loading) return <div class="loading">Loading account…</div>;

  return (
    <div class="stack">
      {error && <div class="error-banner">{error}</div>}
      {msg && <div class="success-banner">{msg}</div>}

      <div class="card">
        <div class="card-title">Signed in</div>
        <p class="card-sub" style={{ marginBottom: "0.5rem" }}>
          {email || "Connected session"} · plan{" "}
          <span class="badge">{tier}</span>
        </p>
        <div class="row">
          <button
            class="btn btn-ghost"
            onClick={() => void openExternal("https://probeharbor.dev/dashboard/plans")}
          >
            Manage billing on web
          </button>
          <button
            class="btn"
            onClick={async () => {
              await disconnect();
              onSignedOut();
            }}
          >
            Sign out
          </button>
        </div>
      </div>

      <div class="card stack">
        <div class="card-title">Desktop notifications</div>
        {canPush ? (
          <>
            <p class="card-sub">
              Pro: show OS notifications when new freeze/flood alert events arrive
              (polls while the app is open). Also enable the Push channel under Alerts
              on the web if you want phone/browser push too.
            </p>
            <label class="check">
              <input
                type="checkbox"
                checked={desktopPush}
                onChange={(e) => {
                  const on = (e.target as HTMLInputElement).checked;
                  setDesktopPush(on);
                  setDesktopPushEnabled(on);
                  setMsg(on ? "Desktop notifications enabled" : "Desktop notifications off");
                }}
              />
              Notify on new alert events
            </label>
          </>
        ) : (
          <>
            <p class="card-sub">
              OS push-style notifications are a Pro feature. Upgrade to get freeze and
              flood alerts on this desktop while the app is running.
            </p>
            <button
              class="btn btn-primary"
              onClick={() => void openExternal("https://probeharbor.dev/dashboard/plans")}
            >
              View plans
            </button>
          </>
        )}
      </div>

      <div class="card stack">
        <div class="card-title">Display preferences</div>
        <label class="check">
          <input
            type="checkbox"
            checked={!!prefs.useCelsius}
            onChange={(e) =>
              setPrefs({ ...prefs, useCelsius: (e.target as HTMLInputElement).checked })
            }
          />
          Use Celsius
        </label>
        <label class="check">
          <input
            type="checkbox"
            checked={!!prefs.showGarageTemps}
            onChange={(e) =>
              setPrefs({
                ...prefs,
                showGarageTemps: (e.target as HTMLInputElement).checked,
              })
            }
          />
          Show garage temps
        </label>
        <label class="check">
          <input
            type="checkbox"
            checked={!!prefs.showWeather}
            onChange={(e) =>
              setPrefs({ ...prefs, showWeather: (e.target as HTMLInputElement).checked })
            }
          />
          Show weather
        </label>
        <div class="field">
          <label>Theme</label>
          <select
            value={prefs.theme ?? "dark"}
            onChange={(e) =>
              setPrefs({ ...prefs, theme: (e.target as HTMLSelectElement).value })
            }
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
            <option value="system">System</option>
          </select>
        </div>
        <div class="field">
          <label>Weather city id</label>
          <input
            value={prefs.weatherCityId ?? ""}
            onInput={(e) =>
              setPrefs({
                ...prefs,
                weatherCityId: (e.target as HTMLInputElement).value,
              })
            }
          />
        </div>
        <button
          class="btn btn-primary"
          onClick={async () => {
            setMsg(null);
            try {
              await savePreferences(prefs);
              onPrefs(prefs);
              setMsg("Preferences saved");
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            }
          }}
        >
          Save preferences
        </button>
      </div>
    </div>
  );
}
