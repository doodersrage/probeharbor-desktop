# ProbeHarbor Desktop

Native Windows, macOS, and Linux companion for [probeharbor.dev](https://probeharbor.dev).

The desktop **does not** collect sensor data — it signs in with your ProbeHarbor account and loads live readings from the existing HTTPS API (same contract as the [Android app](https://github.com/doodersrage/probeharbor-android)).

**Not Bay Buddy.** [Bay Buddy](https://github.com/doodersrage/probeharbor-bay-buddy) is a glanceable freeze/flood mood companion for one space. This app is the full dashboard client: Home, History, Alerts, Devices, Household, Share, Account, and Portfolio.

On the web, live probe cards live at [`/dashboard/live`](https://probeharbor.dev/dashboard/live); Overview Status/Insights stay at [`/dashboard`](https://probeharbor.dev/dashboard). Desktop **Home** maps to Live-style readings (same HTTPS APIs as Android); it does not reimplement web Overview Insights.

## Stack

- [Tauri 2](https://tauri.app/) + Vite + Preact + TypeScript
- Companion OAuth via `/api/auth/companion/start?client=desktop` + loopback handoff
- Bearer + `X-SB-Refresh-Token` for dashboard APIs

## Platforms

| OS | Artifacts |
| --- | --- |
| Linux | `.AppImage`, `.deb`, `.rpm` |
| Windows | `.msi`, NSIS installer |
| macOS | `.dmg`, `.app` |

## Develop

Requirements: Node 22+, Rust stable, and platform WebView deps ([Tauri prerequisites](https://tauri.app/start/prerequisites/)).

```bash
npm install
npm run tauri:dev
```

## Build locally

```bash
npm run tauri:build
```

Outputs land under `src-tauri/target/release/bundle/`.

On some Linux hosts AppImage packing needs `APPIMAGE_EXTRACT_AND_RUN=1` / `NO_STRIP=true` (already set in `npm run tauri:build`).

### Linux / NVIDIA note

On NVIDIA + Wayland, WebKit can abort with `Could not create GBM EGL display`. The app sets `WEBKIT_DISABLE_DMABUF_RENDERER=1` at startup so the AppImage should just work.

## Connect flow

1. Click **Connect with Google / GitHub / email**
2. Sign in on probeharbor.dev in your browser (including MFA if enabled)
3. The browser returns to a localhost handoff the app is listening on
4. Dashboard screens load against your account

## Out of scope (for now)

- Admin / ops screens
- In-app billing (opens probeharbor.dev)
- Claim-puck USB (stays in Bay Buddy)
- Background daemon when the app is fully quit (notifications poll while open)

## Notifications (Pro)

While the app is open, Desktop polls alert events and raises native OS notifications for new freeze/flood (and other) alerts. Toggle under Account. Enable Push under Alerts on the web for phone/browser channels too.

## Kiosk mode

Use **Kiosk mode** in the top bar for a fullscreen shop display: hides the sidebar, keeps the window on top, and focuses live Home readings.

## Release

Push a version tag (`v0.1.0`). GitHub Actions builds Linux, Windows, and macOS and attaches installers to the release.

```bash
git tag v0.1.0
git push origin v0.1.0
```

## License

MIT — companion to the ProbeHarbor project.
