import { useEffect, useState } from "preact/hooks";
import { listen } from "@tauri-apps/api/event";
import { fetchExport, hasSession } from "./lib/api";
import type { Route, UserPreferencesDto } from "./lib/types";
import { ConnectScreen } from "./components/Connect";
import { Shell } from "./components/Shell";
import { HomeScreen } from "./components/screens/Home";
import { HistoryScreen } from "./components/screens/History";
import { AlertsScreen } from "./components/screens/Alerts";
import { DevicesScreen } from "./components/screens/Devices";
import { HouseholdScreen } from "./components/screens/Household";
import { ShareScreen } from "./components/screens/Share";
import { AccountScreen } from "./components/screens/Account";
import { PortfolioScreen } from "./components/screens/Portfolio";

export function App() {
  const [booting, setBooting] = useState(true);
  const [connected, setConnected] = useState(false);
  const [route, setRoute] = useState<Route>("home");
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState("free");
  const [prefs, setPrefs] = useState<UserPreferencesDto>({ useCelsius: false });
  const [canShare, setCanShare] = useState(false);
  const [canClaims, setCanClaims] = useState(false);

  async function refreshSessionMeta() {
    try {
      const exp = await fetchExport();
      setEmail(exp.user?.email ?? "");
      setPlan(exp.entitlements?.tier ?? "free");
      setPrefs(exp.preferences ?? {});
      setCanShare(!!exp.entitlements?.canCreateShareLinks);
      setCanClaims(!!exp.entitlements?.canUseClaimsPack);
    } catch {
      // keep prior meta
    }
  }

  useEffect(() => {
    void (async () => {
      const ok = await hasSession();
      setConnected(ok);
      if (ok) await refreshSessionMeta();
      setBooting(false);
    })();

    let unlistenConnected: (() => void) | undefined;
    let unlistenDisconnected: (() => void) | undefined;
    void listen("auth://connected", () => {
      setConnected(true);
      void refreshSessionMeta();
    }).then((fn) => {
      unlistenConnected = fn;
    });
    void listen("auth://disconnected", () => {
      setConnected(false);
    }).then((fn) => {
      unlistenDisconnected = fn;
    });

    return () => {
      unlistenConnected?.();
      unlistenDisconnected?.();
    };
  }, []);

  if (booting) {
    return <div class="loading">Starting ThermalTrace…</div>;
  }

  if (!connected) {
    return (
      <ConnectScreen
        onConnected={() => {
          setConnected(true);
          void refreshSessionMeta();
        }}
      />
    );
  }

  return (
    <Shell route={route} onRoute={setRoute} email={email} plan={plan}>
      {route === "home" && <HomeScreen useCelsius={!!prefs.useCelsius} />}
      {route === "history" && (
        <HistoryScreen useCelsius={!!prefs.useCelsius} canClaims={canClaims} />
      )}
      {route === "alerts" && <AlertsScreen />}
      {route === "devices" && <DevicesScreen />}
      {route === "household" && <HouseholdScreen />}
      {route === "share" && <ShareScreen canShare={canShare} />}
      {route === "account" && (
        <AccountScreen
          onPrefs={(p) => setPrefs(p)}
          onSignedOut={() => setConnected(false)}
        />
      )}
      {route === "portfolio" && (
        <PortfolioScreen
          useCelsius={!!prefs.useCelsius}
          onSwitched={() => {
            setRoute("home");
            void refreshSessionMeta();
          }}
        />
      )}
    </Shell>
  );
}
