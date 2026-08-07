// chrome-live-toggle — toggle injector template (boolean on/off).
//
// Register this string as navigate_page's `initScript` (Puppeteer
// evaluateOnNewDocument) so it re-runs on every document load and survives the
// user's manual reloads for that tab's lifetime.
//
// The ONLY project-specific part is applyOn/applyOff. Everything else — button
// shape, placement, boolean state, retry loop, double-inject guard — is
// boilerplate; leave it alone.

(function () {
  // Idempotency guard: initScript + a run-now + any CDP re-attach can each run
  // this SAME source in one document. Without this each run gets its own state
  // + setInterval, and an OFF instance fights an ON one every tick — the change
  // flickers or appears not to apply. Exactly one instance per document.
  if (window.__chromeLiveToggleInstalled) return;
  window.__chromeLiveToggleInstalled = true;

  // OFF = red knob LEFT; ON = green knob RIGHT (OpenMoji, inlined; map by how
  // it RENDERS, not by the E-code number). height:40px compact variants.
  var OFF = '<svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg" style="height:40px;width:auto;display:block"><g><path fill="#d0cfce" d="M51.0984,45.9794H21.0578c-5.5116,0-9.9797-4.4681-9.9797-9.9797s4.4681-9.9797,9.9797-9.9797h30.0406c5.5116,0,9.9797,4.4681,9.9797,9.9797S56.6101,45.9794,51.0984,45.9794z"/><circle cx="20.9228" cy="36" r="10.0009" fill="#ea5a47"/></g><g fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M51.0984,45.9794H21.0578c-5.5116,0-9.9797-4.4681-9.9797-9.9797s4.4681-9.9797,9.9797-9.9797h30.0406c5.5116,0,9.9797,4.4681,9.9797,9.9797S56.6101,45.9794,51.0984,45.9794z"/><circle cx="20.9228" cy="36" r="10.0009"/></g></svg>';
  var ON = '<svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg" style="height:40px;width:auto;display:block"><g><path fill="#d0cfce" d="M20.9453,45.9794h30.0406c5.5116,0,9.9797-4.4681,9.9797-9.9797s-4.4681-9.9797-9.9797-9.9797H20.9453c-5.5116,0-9.9797,4.4681-9.9797,9.9797S15.4336,45.9794,20.9453,45.9794z"/><circle cx="50.9647" cy="36" r="10.0009" fill="#b1cc33"/></g><g fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M20.9453,45.9794h30.0406c5.5116,0,9.9797-4.4681,9.9797-9.9797s-4.4681-9.9797-9.9797-9.9797H20.9453c-5.5116,0-9.9797,4.4681-9.9797,9.9797S15.4336,45.9794,20.9453,45.9794z"/><circle cx="50.9647" cy="36" r="10.0009"/></g></svg>';
  var TOGGLE_ID = 'chrome-live-toggle';
  var on = false;

  // ===== THE ONLY PROJECT-SPECIFIC PART =====
  // Fill these. applyOff MUST be the exact inverse of applyOn.
  // Capture any original state ONCE, before the first mutation (store it in a
  // var out here, or stash it on the node via a data-orig attribute at inject
  // time). Never assume the "before" value — read and keep it up front.
  function applyOn()  { /* e.g. document.body.style.background = 'blue'; */ }
  function applyOff() { /* e.g. document.body.style.background = ''; */ }
  // ==========================================

  function inject() {
    // double-inject guard; reassert current state — SSR/hydrate re-renders can
    // strip an inline override between ticks, so always re-apply, don't just return.
    if (document.getElementById(TOGGLE_ID)) { (on ? applyOn : applyOff)(); return; }
    if (!document.body) return;                     // body not parsed yet
    var btn = document.createElement('button');
    btn.id = TOGGLE_ID;
    var s = btn.style;
    // Placement: bottom-right. Default right:26px. If the page has a bottom-right
    // chat/support launcher (~56px), bump to right:96px to sit left of it.
    s.position = 'fixed'; s.right = '26px'; s.bottom = '24px'; s.zIndex = '2147483647';
    s.background = 'none'; s.border = 'none'; s.padding = '0'; s.margin = '0';
    s.cursor = 'pointer'; s.lineHeight = '0'; s.filter = 'drop-shadow(0 4px 10px rgba(0,0,0,.5))';
    btn.innerHTML = OFF;
    btn.onclick = function () {
      on = !on;
      btn.innerHTML = on ? ON : OFF;
      (on ? applyOn : applyOff)();
    };
    document.body.appendChild(btn);
  }

  // SSR + hydrate pages: the element may not exist when this first runs, and
  // hydration can wipe injected nodes. Retry aggressively; the interval
  // re-injects if the button ever gets removed.
  setInterval(inject, 200);
  document.addEventListener('DOMContentLoaded', inject);
  window.addEventListener('load', inject);
  setTimeout(inject, 150);
})();
