// chrome-live-toggle — swatch injector template (N-way color picker).
//
// Same contract as injector-template.js: register this string as
// navigate_page's `initScript` (Puppeteer evaluateOnNewDocument) so it re-runs
// on every document load and survives the user's manual reloads.
//
// The ONLY project-specific parts are SWATCHES and applySwatch(). Everything
// else — pill geometry, hover expand/collapse, checkmark, retry loop,
// double-inject guard — is boilerplate; leave it alone.

(function () {
  var ROOT_ID = 'chrome-live-swatch';

  // ===== THE ONLY PROJECT-SPECIFIC PART =====
  // Make SWATCHES[0] the page's ORIGINAL value: state is per-document, so a
  // manual reload resets to index 0 and the page comes back untouched.
  // `color` is what the dot renders; `value` is whatever applySwatch needs.
  var SWATCHES = [
    { color: '#ffffff', value: '' },
    { color: '#dbeafe', value: '#dbeafe' },
    { color: '#fecaca', value: '#fecaca' }
  ];

  function applySwatch(sw) {
    document.body.style.background = sw.value;
  }
  // ==========================================

  var sel = 0;

  // Geometry. Pill is right-anchored, so growing its width expands it LEFTWARD.
  var DOT = 19, GAP = 5, PAD = 4, CHEV = 11;
  var W_IDLE = PAD * 2 + CHEV + GAP + DOT;
  var W_OPEN = PAD * 2 + SWATCHES.length * DOT + (SWATCHES.length - 1) * GAP;
  var EASE = 'cubic-bezier(.32,.72,0,1)';

  var CHEVRON = '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#3c3c3c" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';
  var CHECK = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#111" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';

  function dot(color) {
    var d = document.createElement('span');
    var s = d.style;
    s.display = 'inline-block'; s.position = 'relative'; s.verticalAlign = 'middle';
    s.width = DOT + 'px'; s.height = DOT + 'px'; s.borderRadius = '50%';
    s.background = color; s.boxSizing = 'border-box';
    s.border = '1px solid rgba(0,0,0,.12)';
    return d;
  }

  function inject() {
    // Double-inject guard; reassert current state — SSR/hydrate re-renders can
    // strip an inline override between ticks, so always re-apply, don't just return.
    if (document.getElementById(ROOT_ID)) { applySwatch(SWATCHES[sel]); return; }
    if (!document.body) return;                     // body not parsed yet

    var pill = document.createElement('div');
    pill.id = ROOT_ID;
    var p = pill.style;
    // Placement: bottom-right. Default right:26px. If the page has a bottom-right
    // chat/support launcher (~56px), bump to right:96px to sit left of it.
    p.position = 'fixed'; p.right = '26px'; p.bottom = '24px'; p.zIndex = '2147483647';
    p.display = 'flex'; p.alignItems = 'center'; p.whiteSpace = 'nowrap';
    p.boxSizing = 'border-box'; p.padding = '0 ' + PAD + 'px';
    p.height = (DOT + PAD * 2) + 'px'; p.width = W_IDLE + 'px';
    p.borderRadius = '999px'; p.background = '#f2f0ec';
    p.border = '1px solid rgba(0,0,0,.06)';
    p.boxShadow = 'rgba(0,0,0,.04) 0px 2px 5px';
    p.overflow = 'hidden'; p.cursor = 'pointer';
    p.transition = 'width 260ms ' + EASE;

    var chev = document.createElement('span');
    chev.innerHTML = CHEVRON;
    var cs = chev.style;
    cs.display = 'flex'; cs.alignItems = 'center'; cs.overflow = 'hidden';
    cs.width = CHEV + 'px'; cs.opacity = '1'; cs.flex = '0 0 auto';
    cs.transition = 'width 260ms ' + EASE + ', opacity 140ms linear';

    var preview = dot(SWATCHES[sel].color);
    var vs = preview.style;
    vs.flex = '0 0 auto'; vs.marginLeft = GAP + 'px'; vs.opacity = '1';
    vs.transition = 'width 260ms ' + EASE + ', margin-left 260ms ' + EASE + ', opacity 140ms linear';

    var strip = document.createElement('div');
    var ss = strip.style;
    ss.display = 'flex'; ss.alignItems = 'center'; ss.overflow = 'hidden';
    ss.width = '0px'; ss.opacity = '0'; ss.flex = '0 0 auto';
    ss.transition = 'width 260ms ' + EASE + ', opacity 140ms linear';

    var checks = [];
    SWATCHES.forEach(function (sw, i) {
      var d = dot(sw.color);
      d.style.flex = '0 0 auto';
      if (i) d.style.marginLeft = GAP + 'px';
      var ck = document.createElement('span');
      ck.innerHTML = CHECK;
      var ks = ck.style;
      ks.position = 'absolute'; ks.inset = '0'; ks.display = 'flex';
      ks.alignItems = 'center'; ks.justifyContent = 'center';
      ks.opacity = i === sel ? '1' : '0';
      ks.transition = 'opacity 120ms linear';
      d.appendChild(ck);
      checks.push(ck);
      d.addEventListener('click', function (e) {
        e.stopPropagation();
        sel = i;
        checks.forEach(function (c, j) { c.style.opacity = j === sel ? '1' : '0'; });
        preview.style.background = sw.color;
        applySwatch(sw);
      });
      strip.appendChild(d);
    });

    pill.appendChild(chev);
    pill.appendChild(preview);
    pill.appendChild(strip);

    var t;
    function open() {
      clearTimeout(t);
      p.width = W_OPEN + 'px';
      cs.width = '0px'; cs.opacity = '0';
      vs.width = '0px'; vs.marginLeft = '0px'; vs.opacity = '0';
      vs.borderWidth = '0px';
      ss.width = (SWATCHES.length * DOT + (SWATCHES.length - 1) * GAP) + 'px'; ss.opacity = '1';
    }
    function close() {
      t = setTimeout(function () {
        p.width = W_IDLE + 'px';
        cs.width = CHEV + 'px'; cs.opacity = '1';
        vs.width = DOT + 'px'; vs.marginLeft = GAP + 'px'; vs.opacity = '1';
        vs.borderWidth = '1px';
        ss.width = '0px'; ss.opacity = '0';
      }, 80);                                       // grace period, kills flicker
    }
    pill.addEventListener('mouseenter', open);
    pill.addEventListener('mouseleave', close);

    document.body.appendChild(pill);
    applySwatch(SWATCHES[sel]);
  }

  // SSR + hydrate pages: the element may not exist when this first runs, and
  // hydration can wipe injected nodes. Retry aggressively; the interval
  // re-injects if the pill ever gets removed.
  setInterval(inject, 200);
  document.addEventListener('DOMContentLoaded', inject);
  window.addEventListener('load', inject);
  setTimeout(inject, 150);
})();
