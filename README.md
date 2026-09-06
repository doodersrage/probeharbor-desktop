# ThermalTrace Desktop

Native Windows, macOS, and Linux companion for [thermaltrace.dev](https://thermaltrace.dev).

The desktop **does not** collect sensor data — it signs in with your ThermalTrace account and loads live readings from the existing HTTPS API (same contract as the [Android app](https://github.com/doodersrage/thermaltrace-android)).

**Not Bay Buddy.** [Bay Buddy](https://github.com/doodersrage/thermaltrace-bay-buddy) is a glanceable freeze/flood mood companion for one space. This app is the full dashboard client: Home, History, Alerts, Devices, Household, Share, Account, and Portfolio.

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
2. Sign in on thermaltrace.dev in your browser (including MFA if enabled)
3. The browser returns to a localhost handoff the app is listening on
4. Dashboard screens load against your account

## Out of scope (v1)

- OS push notifications (Android uses FCM)
- Admin / ops screens
- In-app billing (opens thermaltrace.dev)
- Kiosk mode
- Claim-puck USB (stays in Bay Buddy)

## Release

Push a version tag (`v0.1.0`). GitHub Actions builds Linux, Windows, and macOS and attaches installers to the release.

```bash
git tag v0.1.0
git push origin v0.1.0
```

## License

MIT — companion to the ThermalTrace project.
