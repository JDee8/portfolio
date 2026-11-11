// Canvas art can't use CSS variables directly, so read the colour tokens once
// and hand them out as "r,g,b" strings. Theme edits made in the Website OS
// (src/content/theme.json) reach the canvases this way.
const FALLBACK = { accent: '#3aa8ff', alert: '#ff2e55', fg: '#eaf4ff', dim: '#7b94b4', line: '#1c3b60' };

function toRgb(hex: string, fallback: string) {
  let h = (hex || fallback).trim().replace('#', '');
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  const n = parseInt(h, 16);
  if (Number.isNaN(n) || h.length !== 6) return toRgb(fallback, '#ffffff');
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

const css = typeof document !== 'undefined' ? getComputedStyle(document.documentElement) : null;
const read = (name: keyof typeof FALLBACK) =>
  toRgb(css?.getPropertyValue(`--${name === 'line' ? 'line-2' : name}`) ?? '', FALLBACK[name]);

/** "r,g,b" strings, for rgba(...) */
export const A = read('accent');
export const R = read('alert');
export const F = read('fg');
export const D = read('dim');
export const L = read('line');
