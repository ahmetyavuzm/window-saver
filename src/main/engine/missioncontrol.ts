import { runJXA } from './applescript.js';

/**
 * Create a new macOS desktop (Space) by UI-scripting Mission Control's "+"
 * (add-desktop) button — the only way to add a desktop WITHOUT yabai's
 * scripting-addition / partial-SIP-off. Verified on macOS 15 Sequoia:
 * `System Events → process "Dock" → group "Mission Control" → group 2 →
 * group 2 → button 1` is the add-desktop button, and AX `.click()` on it
 * actually creates a desktop (synthetic CGEvent mouse clicks are ignored by
 * the Dock, so AX action is the only thing that works).
 *
 * Caveats the caller/UI must own:
 *  - Requires Accessibility permission (the app already needs it).
 *  - The new desktop lands on whichever display Mission Control currently
 *    exposes (the "active" one) — it can't be targeted per-display without a
 *    manual drag, so the user places/drags windows themselves afterward.
 *  - The button description is localized ("add desktop" / "masaüstü ekle"), so
 *    we select it by role (`button 1`), never by name.
 */
export async function createDesktopViaMissionControl(): Promise<{ created: boolean; error?: string }> {
  const script = `
    const se = Application('System Events');
    se.keyCode(126, { using: 'control down' }); // Ctrl+Up opens Mission Control
    delay(0.9);
    let result;
    try {
      const dock = se.processes['Dock'];
      const g = dock.groups.byName('Mission Control');
      // Spaces bar container: group 2 > group 2 holds { list, addButton }.
      const bar = g.groups()[1].groups()[1];
      const btn = bar.buttons()[0];
      btn.click(); // AX action; synthetic mouse events don't register here
      result = 'created';
      delay(0.5);
    } catch (e) {
      result = 'error:' + e;
    }
    se.keyCode(53); // Esc closes Mission Control
    result;
  `;
  const out = (await runJXA(script)).trim();
  if (out === 'created') return { created: true };
  return { created: false, error: out || 'Mission Control add-desktop button not found' };
}
