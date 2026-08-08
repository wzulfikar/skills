// DevBar — dev-only floating swatch picker, bottom-right. No framework, no deps.
//
// For an app you own but that isn't React: load this from a <script> in dev only,
// or import it behind an `if (import.meta.env.DEV)` guard.
//
// The ONLY project-specific parts are SWATCHES and apply(). Everything else —
// pill geometry, hover expand/collapse, checkmark contrast, persistence, the
// reassert tick — is boilerplate; leave it alone.

(function () {
  // One instance per document: HMR, a double <script>, or a re-import each run
  // this same source, and two instances fight every tick.
  if (window.__devbarInstalled) return;
  window.__devbarInstalled = true;

  var ROOT_ID = 'devbar';
  var STORAGE_KEY = 'devbar:sel';

  // ===== THE ONLY PROJECT-SPECIFIC PART =====
  // SWATCHES[0] MUST be the app's current compiled-in value, so clearing storage
  // lands on the stock look instead of a modified one.
  // `color` is what the dot renders; `value` is whatever apply() needs.
  var SWATCHES = [
    { label: 'Paper', color: '#f5f0e8', value: '#f5f0e8' },
    { label: 'Bone', color: '#faf8f4', value: '#faf8f4' },
    { label: 'Mist', color: '#f0f2f2', value: '#f0f2f2' },
    { label: 'Sand', color: '#ebe3d4', value: '#ebe3d4' }
  ];

  function apply(sw) {
    document.documentElement.style.setProperty('--bg', sw.value);
  }
  // ==========================================

  var saved = parseInt(localStorage.getItem(STORAGE_KEY), 10);
  var sel = SWATCHES[saved] ? saved : 0;

  // Geometry. Pill is right-anchored, so growing its width expands it LEFTWARD.
  var DOT = 19, GAP = 5, PAD = 4, CHEV = 11;
  var W_IDLE = PAD * 2 + CHEV + GAP + DOT;
  var W_OPEN = PAD * 2 + SWATCHES.length * DOT + (SWATCHES.length - 1) * GAP;
  var EASE = 'cubic-bezier(.32,.72,0,1)';

  var CHEVRON = '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#3c3c3c" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';
  function check(stroke) {
    return '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="' + stroke + '" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
  }

  // A dark swatch needs a light checkmark, or it vanishes into the dot.
  function isDark(color) {
    var probe = document.createElement('span');
    probe.style.color = color;
    document.body.appendChild(probe);
    var rgb = getComputedStyle(probe).color.match(/[\d.]+/g);
    probe.remove();
    if (!rgb) return false;
    return (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255 < 0.55;
  }

  // Optional `fill` takes any CSS background, so the dot can preview a gradient
  // the change actually applies. `color` stays flat and drives check contrast.
  function fillOf(sw) { return sw.fill || sw.color; }

  function dot(background) {
    var d = document.createElement('span');
    var s = d.style;
    s.display = 'inline-block'; s.position = 'relative'; s.verticalAlign = 'middle';
    s.width = DOT + 'px'; s.height = DOT + 'px'; s.borderRadius = '50%';
    s.background = background; s.boxSizing = 'border-box';
    s.border = '1px solid rgba(0,0,0,.12)';
    return d;
  }

  function inject() {
    // Reassert, don't just bail: a re-render can strip the override between ticks.
    if (document.getElementById(ROOT_ID)) { apply(SWATCHES[sel]); return; }
    if (!document.body) return;

    var pill = document.createElement('div');
    pill.id = ROOT_ID;
    var p = pill.style;
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

    var preview = dot(fillOf(SWATCHES[sel]));
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
      var d = dot(fillOf(sw));
      d.style.flex = '0 0 auto';
      d.title = sw.label || '';
      if (i) d.style.marginLeft = GAP + 'px';
      var ck = document.createElement('span');
      ck.innerHTML = check(isDark(sw.color) ? '#fff' : '#111');
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
        localStorage.setItem(STORAGE_KEY, String(i));
        checks.forEach(function (c, j) { c.style.opacity = j === sel ? '1' : '0'; });
        preview.style.background = fillOf(sw);
        apply(sw);
      });
      strip.appendChild(d);
    });

    pill.appendChild(chev);
    pill.appendChild(preview);
    pill.appendChild(strip);

    var t;
    pill.addEventListener('mouseenter', function () {
      clearTimeout(t);
      p.width = W_OPEN + 'px';
      cs.width = '0px'; cs.opacity = '0';
      vs.width = '0px'; vs.marginLeft = '0px'; vs.opacity = '0'; vs.borderWidth = '0px';
      ss.width = (SWATCHES.length * DOT + (SWATCHES.length - 1) * GAP) + 'px'; ss.opacity = '1';
    });
    pill.addEventListener('mouseleave', function () {
      t = setTimeout(function () {                  // grace period, kills flicker
        p.width = W_IDLE + 'px';
        cs.width = CHEV + 'px'; cs.opacity = '1';
        vs.width = DOT + 'px'; vs.marginLeft = GAP + 'px'; vs.opacity = '1'; vs.borderWidth = '1px';
        ss.width = '0px'; ss.opacity = '0';
      }, 80);
    });

    document.body.appendChild(pill);
    apply(SWATCHES[sel]);
  }

  // SSR + hydrate apps: body may not exist yet, and hydration can wipe injected
  // nodes. The interval re-injects if the pill is ever removed.
  setInterval(inject, 200);
  document.addEventListener('DOMContentLoaded', inject);
  window.addEventListener('load', inject);
  setTimeout(inject, 150);
})();
