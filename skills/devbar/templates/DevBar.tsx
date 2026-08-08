'use client';

// DevBar — dev-only floating swatch picker, bottom-right.
//
// The ONLY project-specific parts are SWATCHES and apply(). Everything else —
// pill geometry, hover expand/collapse, checkmark contrast, persistence — is
// boilerplate; leave it alone.
//
// Mount once, dev-only:
//   {process.env.NODE_ENV === 'development' && <DevBar />}
//
// Delete this file and that line once a value wins.

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';

type Swatch = {
  /** Flat tone the dot renders. Also drives checkmark contrast. */
  color: string;
  /** Whatever apply() consumes. Coincides with `color` only when the change IS the color. */
  value: string;
  /** Optional: any CSS background, overrides what the dot paints (gradients). */
  fill?: string;
  /** Tooltip. */
  label?: string;
};

// ===== THE ONLY PROJECT-SPECIFIC PART =====

// SWATCHES[0] MUST be the app's current compiled-in value, so clearing storage
// or a fresh browser lands on the stock look instead of a modified one.
const SWATCHES: Swatch[] = [
  { label: 'Paper', color: '#f5f0e8', value: '#f5f0e8' },
  { label: 'Bone', color: '#faf8f4', value: '#faf8f4' },
  { label: 'Mist', color: '#f0f2f2', value: '#f0f2f2' },
  { label: 'Sand', color: '#ebe3d4', value: '#ebe3d4' },
];

// Write through a CSS variable the app already reads — no prop plumbing, and
// every consumer updates at once.
function apply(sw: Swatch) {
  document.documentElement.style.setProperty('--bg', sw.value);
}

// ==========================================

const STORAGE_KEY = 'devbar:sel';

// Geometry. Pill is right-anchored, so growing its width expands it LEFTWARD.
const DOT = 19;
const GAP = 5;
const PAD = 4;
const CHEV = 11;
const W_IDLE = PAD * 2 + CHEV + GAP + DOT;
const W_OPEN = PAD * 2 + SWATCHES.length * DOT + (SWATCHES.length - 1) * GAP;
const EASE = 'cubic-bezier(.32,.72,0,1)';

/** A dark swatch needs a light checkmark, or it vanishes into the dot. */
function isDark(color: string) {
  const probe = document.createElement('span');
  probe.style.color = color;
  document.body.appendChild(probe);
  const rgb = getComputedStyle(probe).color.match(/[\d.]+/g);
  probe.remove();
  if (!rgb) return false;
  return (0.299 * +rgb[0] + 0.587 * +rgb[1] + 0.114 * +rgb[2]) / 255 < 0.55;
}

const fillOf = (sw: Swatch) => sw.fill ?? sw.color;

const dotStyle = (background: string): CSSProperties => ({
  position: 'relative',
  flex: '0 0 auto',
  width: DOT,
  height: DOT,
  borderRadius: '50%',
  background,
  boxSizing: 'border-box',
  border: '1px solid rgba(0,0,0,.12)',
});

function Check({ color, on }: { color: string; on: boolean }) {
  const [stroke, setStroke] = useState('#111');
  useEffect(() => setStroke(isDark(color) ? '#fff' : '#111'), [color]);
  return (
    <span
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: on ? 1 : 0,
        transition: 'opacity 120ms linear',
      }}
    >
      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke={stroke} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6L9 17l-5-5" />
      </svg>
    </span>
  );
}

export default function DevBar() {
  // Mount guard: selection comes from localStorage, which the server can't know.
  // Rendering nothing on the first pass keeps hydration from mismatching.
  const [mounted, setMounted] = useState(false);
  const [sel, setSel] = useState(0);
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const saved = Number(localStorage.getItem(STORAGE_KEY));
    const i = Number.isInteger(saved) && SWATCHES[saved] ? saved : 0;
    setSel(i);
    setMounted(true);
  }, []);

  // Reapply on every change AND on mount — a full reload has to restore the
  // picked value, not just repaint the dot.
  useEffect(() => {
    if (mounted) apply(SWATCHES[sel]);
  }, [mounted, sel]);

  const pick = useCallback((i: number) => {
    setSel(i);
    localStorage.setItem(STORAGE_KEY, String(i));
  }, []);

  if (!mounted) return null;

  return (
    <div
      onMouseEnter={() => {
        clearTimeout(closeTimer.current);
        setOpen(true);
      }}
      onMouseLeave={() => {
        // 80ms grace period, kills flicker when the pointer crosses a gap.
        closeTimer.current = setTimeout(() => setOpen(false), 80);
      }}
      style={{
        position: 'fixed',
        right: 26,
        bottom: 24,
        zIndex: 2147483647,
        display: 'flex',
        alignItems: 'center',
        whiteSpace: 'nowrap',
        boxSizing: 'border-box',
        padding: `0 ${PAD}px`,
        height: DOT + PAD * 2,
        width: open ? W_OPEN : W_IDLE,
        borderRadius: 999,
        background: '#f2f0ec',
        border: '1px solid rgba(0,0,0,.06)',
        boxShadow: 'rgba(0,0,0,.04) 0px 2px 5px',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: `width 260ms ${EASE}`,
      }}
    >
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          overflow: 'hidden',
          flex: '0 0 auto',
          width: open ? 0 : CHEV,
          opacity: open ? 0 : 1,
          transition: `width 260ms ${EASE}, opacity 140ms linear`,
        }}
      >
        <svg viewBox="0 0 24 24" width={CHEV} height={CHEV} fill="none" stroke="#3c3c3c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </span>

      <span
        style={{
          ...dotStyle(fillOf(SWATCHES[sel])),
          width: open ? 0 : DOT,
          marginLeft: open ? 0 : GAP,
          opacity: open ? 0 : 1,
          borderWidth: open ? 0 : 1,
          transition: `width 260ms ${EASE}, margin-left 260ms ${EASE}, opacity 140ms linear`,
        }}
      />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          overflow: 'hidden',
          flex: '0 0 auto',
          width: open ? SWATCHES.length * DOT + (SWATCHES.length - 1) * GAP : 0,
          opacity: open ? 1 : 0,
          transition: `width 260ms ${EASE}, opacity 140ms linear`,
        }}
      >
        {SWATCHES.map((sw, i) => (
          <button
            key={i}
            title={sw.label}
            onClick={(e) => {
              e.stopPropagation();
              pick(i);
            }}
            style={{
              ...dotStyle(fillOf(sw)),
              marginLeft: i ? GAP : 0,
              padding: 0,
              cursor: 'pointer',
            }}
          >
            <Check color={sw.color} on={i === sel} />
          </button>
        ))}
      </div>
    </div>
  );
}
