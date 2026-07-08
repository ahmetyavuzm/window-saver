# Window Saver

A macOS menu-bar app that saves a full workspace setup — which apps are open,
where their windows are positioned, which URLs are open in a browser, which
Terminal sessions are running — as a named **Profile**, and replays the whole
thing with one click or a global hotkey.

## Prerequisites

- macOS (Apple Silicon).
- **[yabai](https://github.com/koekeishiya/yabai)** — optional but recommended.
  Window Saver positions windows itself; with yabai it can place any app's
  window precisely by id and place windows on specific **desktops (Spaces)**.
  Without yabai it falls back to System Events, which handles single-desktop
  positioning but cannot move windows across Spaces. When a profile targets
  multiple desktops and yabai isn't installed, the editor shows a banner with a
  one-click **Install yabai** button.
- Terminal.app (the only terminal app supported so far; iTerm2 is not yet
  supported).

## Permissions

On first launch, Window Saver shows a setup window and needs two macOS
permissions to actually drive other apps:

- **Accessibility** — required to position windows (System Events) and to
  detect when a launched app's window actually exists (`waitForWindow`).
- **Automation** — required for every AppleScript-driven step: activating
  apps, opening Terminal sessions, and driving browsers.

The setup window links directly to the relevant System Settings pane for
each, and has a "Re-check" button. If a step fails at runtime with an
automation error, it usually means one of these permissions was revoked —
re-open "Manage Profiles…" from the tray and check Setup again.

## Using it

- Click the Window Saver icon in the menu bar.
- **Manage Profiles…** opens the editor. A profile is a set of **boxes** laid
  out on a per-display canvas:
  - Add a box for **Launch App**, **Open URL**, or **Open Terminal**.
  - **Drag / resize** each box on the display frame to set where its window
    goes; drag it to cover the whole frame to mark it fullscreen (**native**
    fullscreen gives the window its own Space, **maximize** fills the screen
    but keeps a normal, draggable window).
  - Assign a box to a **desktop (Space)** within its display (needs yabai),
    switch which display it targets, and attach ordered **post-launch actions**
    (open a file/URL in the app, run an app-specific command, or wait).
  - Click **Run** to test the profile immediately; the Run log reports each
    step.
- **Capture open windows** builds a profile from the windows currently on
  screen (via yabai) instead of laying boxes out by hand.
- Give a profile a hotkey (e.g. `Cmd+Alt+1`) in the header — it's registered
  globally, so it works even when Window Saver isn't focused. A hotkey already
  in use (by another profile or app) is rejected with a warning.
- Back in the tray menu, every saved profile appears as a one-click entry.

### Box types

| Box | What it does |
| --- | --- |
| Launch App | `open -a <app>` (or by bundle id). "Launch new window if already open" forces a fresh window even when the app is running. |
| Open URL | Opens a URL in the default browser, Chrome, Safari, or Arc — as a new tab in the workspace's window, or in a dedicated new window. |
| Open Terminal | Opens Terminal.app cd'd into a working directory, optionally running a command (e.g. `claude`). |

Each box also carries its **placement** (where the window lands), an optional
**desktop** and **fullscreen** mode, and its **post-launch actions**.

### Desktops (Spaces)

In Settings, **Desktop mode** controls what a run does about Spaces:

- **Reuse** (default) — work on the desktops already on screen; each window
  lands on its current/target desktop.
- **Create new** — add a fresh desktop via Mission Control at the start of each
  run so the workspace gets a clean slate. Programmatic per-display Space
  placement still needs yabai's scripting-addition (partial SIP off); without
  it you drag the windows onto the new desktop yourself.

A run aborts a single box early only if its Launch App or Wait-for-Window step
fails (no point positioning a window that never came up); every other box in
the profile still runs, and failures are recorded in the Run log.

## Development

```bash
npm install
npm run dev      # builds everything and launches Electron
```

- `npm run build` — compiles main (TypeScript → `dist/main`), preload
  (TypeScript → CommonJS `dist/preload/index.cjs` — Electron's sandboxed
  preload requires CJS even though the rest of the app is ESM), and renderer
  (Vite → `dist/renderer`).
- `npm run dist` — packages a local, unsigned `.app` / `.dmg` via
  `electron-builder` into `release/`. Code signing / notarization are
  intentionally not configured — this is for personal use / manual sharing,
  not App Store or Gatekeeper-clean distribution.

Profiles persist to
`~/Library/Application Support/window-saver/config.json`.
