import type { ComponentChildren } from "preact";
import type { Route } from "../lib/types";

const NAV: { section: string; items: { id: Route; label: string }[] }[] = [
  {
    section: "Monitor",
    items: [
      { id: "home", label: "Home" },
      { id: "portfolio", label: "Portfolio" },
      { id: "devices", label: "Devices" },
      { id: "alerts", label: "Alerts" },
      { id: "history", label: "History" },
    ],
  },
  {
    section: "Account",
    items: [
      { id: "household", label: "Household" },
      { id: "share", label: "Share" },
      { id: "account", label: "Account" },
    ],
  },
];

const TITLES: Record<Route, string> = {
  home: "Home",
  history: "History",
  alerts: "Alerts",
  devices: "Devices",
  household: "Household",
  share: "Share",
  account: "Account",
  portfolio: "Portfolio",
};

interface Props {
  route: Route;
  onRoute: (r: Route) => void;
  email?: string;
  plan?: string;
  kiosk?: boolean;
  onToggleKiosk?: () => void;
  children: ComponentChildren;
}

export function Shell({
  route,
  onRoute,
  email,
  plan,
  kiosk = false,
  onToggleKiosk,
  children,
}: Props) {
  return (
    <div class={`shell ${kiosk ? "shell-kiosk" : ""}`}>
      {!kiosk && (
        <aside class="sidebar">
          <div class="brand">
            <span class="brand-thermal">Thermal</span>
            <span class="brand-trace">Trace</span>
          </div>
          {NAV.map((group) => (
            <div key={group.section}>
              <div class="nav-section">{group.section}</div>
              {group.items.map((item) => (
                <button
                  key={item.id}
                  class={`nav-btn ${route === item.id ? "active" : ""}`}
                  onClick={() => onRoute(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ))}
          <div class="sidebar-foot">Desktop companion · not a sensor</div>
        </aside>
      )}
      <div class="main">
        <header class="topbar">
          <div>
            <h1>{kiosk ? "ThermalTrace · Kiosk" : TITLES[route]}</h1>
            {email && <p class="topbar-meta">{email}</p>}
          </div>
          <div class="row">
            {plan && <span class="badge">{plan}</span>}
            {onToggleKiosk && (
              <button
                class="btn btn-ghost"
                onClick={onToggleKiosk}
                title={
                  kiosk
                    ? "Exit kiosk / shop mode"
                    : "Kiosk / shop mode — fullscreen live readings"
                }
              >
                {kiosk ? "Exit kiosk" : "Kiosk mode"}
              </button>
            )}
          </div>
        </header>
        <div class="content">{children}</div>
      </div>
    </div>
  );
}
