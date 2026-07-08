import { runJXA } from './applescript.js';

/**
 * Create a new macOS desktop (Space) by UI-scripting Mission Control's "+"
 * (add-desktop) button — the only way to add a desktop WITHOUT yabai's
 * scripting-addition / partial-SIP-off. Verified on macOS 15 Sequoia: each
 * display gets its own `group "Mission Control" > group N` whose AX position
 * equals that display's screen frame; inside it, the subgroup holding a
 * thumbnail *list* is the spaces bar, and its `button 1` is the add-desktop
 * button. AX `.click()` on it actually creates a desktop (synthetic CGEvent
 * mouse clicks are ignored by the Dock, so AX action is the only thing that
 * works).
 *
 * `targetOrigin` is the top-left of the display the new desktop must land on
 * (the display the profile's windows target). We match it to the right MC
 * group by position — hardcoding a group index put the desktop on the wrong
 * display, leaving an empty orphan while windows opened elsewhere.
 *
 * Caveats the caller/UI must own:
 *  - Requires Accessibility permission (the app already needs it).
 *  - The add/thumbnail buttons are localized, so we select by role/geometry,
 *    never by name.
 */
export async function createDesktopViaMissionControl(targetOrigin: {
  x: number;
  y: number;
}): Promise<{ created: boolean; error?: string }> {
  const script = `
    const se = Application('System Events');
    const tx = ${Math.round(targetOrigin.x)}, ty = ${Math.round(targetOrigin.y)};
    se.keyCode(126, { using: 'control down' }); // Ctrl+Up opens Mission Control
    delay(0.9);
    let result;
    try {
      const dock = se.processes['Dock'];
      const mc = dock.groups.byName('Mission Control');
      // Each display has its own MC group; pick the one whose frame matches the
      // target display (nearest origin wins, tolerating rounding).
      const groups = mc.groups();
      let g = groups[0], best = Infinity;
      for (let i = 0; i < groups.length; i++) {
        let p; try { p = groups[i].position(); } catch (e) { continue; }
        const d = (p[0] - tx) * (p[0] - tx) + (p[1] - ty) * (p[1] - ty);
        if (d < best) { best = d; g = groups[i]; }
      }
      // Spaces bar = the subgroup that actually holds a thumbnail list.
      const subs = g.groups();
      let bar = null;
      for (let j = 0; j < subs.length; j++) {
        let n = 0; try { n = subs[j].lists().length; } catch (e) {}
        if (n > 0) { bar = subs[j]; break; }
      }
      if (!bar) throw 'no spaces bar for target display';
      bar.buttons()[0].click(); // add-desktop; AX action, synthetic clicks ignored
      result = 'created';
      delay(0.6);
      // Switch to the desktop we just created (last thumbnail of THIS display's
      // bar). Without this the run continues on the OLD desktop and the new one
      // is left an empty orphan. Clicking a thumbnail also closes Mission Control.
      try {
        const thumbs = bar.lists()[0].buttons();
        thumbs[thumbs.length - 1].click();
        delay(0.8); // space-switch animation
        result = 'created+switched';
      } catch (e) {
        se.keyCode(53); // couldn't switch — at least close Mission Control
      }
    } catch (e) {
      result = 'error:' + e;
      se.keyCode(53); // Esc closes Mission Control
    }
    result;
  `;
  const out = (await runJXA(script)).trim();
  if (out.startsWith('created')) return { created: true };
  return { created: false, error: out || 'Mission Control add-desktop button not found' };
}
