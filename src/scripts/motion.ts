// Single switch for all animation. Follows the OS "reduce motion" setting
// unless the visitor overrides it from the command bar.
const KEY = 'jd-motion';
const query = matchMedia('(prefers-reduced-motion: reduce)');
let forced: 'on' | 'off' | null = null;
try {
  const saved = localStorage.getItem(KEY);
  if (saved === 'on' || saved === 'off') forced = saved;
} catch {}

export const motionOff = () => (forced ? forced === 'off' : query.matches);

function apply() {
  document.documentElement.dataset.motion = motionOff() ? 'off' : 'on';
  dispatchEvent(new CustomEvent('jd:motion'));
}

export function setMotion(on: boolean) {
  forced = on ? 'on' : 'off';
  try { localStorage.setItem(KEY, forced); } catch {}
  apply();
}

query.addEventListener('change', apply);
