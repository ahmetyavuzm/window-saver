# Window Saver

A macOS menu-bar app that saves a full workspace setup — which apps are open,
where their windows are positioned, which URLs are open in a browser, which
Terminal sessions are running — as a named **Profile**, and replays the whole
thing with one click or a global hotkey.

## Prerequisites

- macOS.
- [Rectangle](https://rectangleapp.com/) installed and running. Window Saver
  does not reposition windows itself — it drives Rectangle's URL scheme
  (`rectangle://execute-action?name=<action>`) after activating the target
  app, so any window-positioning step depends on Rectangle being installed.
- Terminal.app (the only terminal app supported in V1; iTerm2 is not
  supported yet).

## Permissions

On first launch, Window Saver shows a setup window and needs two macOS
permissions to actually drive other apps:

- **Accessibility** — required to detect when a launched app's window
  actually exists (`waitForWindow` steps poll this via System Events).
- **Automation** — required for every AppleScript-driven step: activating
  apps, opening Terminal sessions, and telling Rectangle to run an action.

The setup window links directly to the relevant System Settings pane for
each, and has a "Re-check" button. If a step fails at runtime with an
automation error, it usually means one of these permissions was revoked —
re-open "Manage Profiles…" from the tray, then check Setup again (the tray
menu will re-show onboarding if needed, or re-run the app).

## Using it

- Click the Window Saver icon in the menu bar.
- **Manage Profiles…** opens the editor: create a profile, add steps
  (Launch App, Position Window, Open URL, Open Terminal, Wait), reorder them
  by drag, and click **Run** to test it immediately.
- Give a profile a hotkey (e.g. `Cmd+Alt+1`) in the profile header — it's
  registered globally, so it works even when Window Saver isn't focused.
  Saving a hotkey that's already in use (by another profile or another app)
  is rejected with a warning.
- Back in the tray menu, every saved profile appears as a one-click entry.

### Step types (V1)

| Step | What it does |
| --- | --- |
| Launch App | `open -a <app>` (or by bundle id) |
| Wait for Window | polls System Events until the app's window exists (auto-added after Launch App) |
| Position Window | activates the app, then fires a Rectangle action (left-half, maximize, etc.) |
| Open URL | opens a URL in the default browser, Chrome, Safari, or Arc |
| Open Terminal | opens Terminal.app cd'd into a working directory, optionally running a command (e.g. `claude`) |
| Wait | a plain delay in milliseconds |

A run aborts early only if a Launch App or Wait for Window step fails
(no point continuing if the app never came up); other step failures are
logged in the Run log but don't block the rest of the profile.

## Development

```bash
npm install
npm run dev      # builds everything and launches via `electron .`
```

- `npm run build` — compiles main (TypeScript → `dist/main`), preload
  (TypeScript → CommonJS `dist/preload/index.cjs` — Electron's sandboxed
  preload requires CJS even though the rest of the app is ESM), and renderer
  (Vite → `dist/renderer`).
- `npm run dist` — packages a local, unsigned `.app` via `electron-builder`
  into `release/mac(-arm64)/Window Saver.app`. Code signing/notarization are
  intentionally not configured — this is for personal use / manual sharing,
  not App Store or Gatekeeper-clean distribution.

Profiles persist to
`~/Library/Application Support/window-saver/config.json`.
