// Website OS client. Keeps one in-memory copy of cv.json + theme.json, renders
// the editor tabs from it, checks copy as you type, and saves through the dev
// server endpoint in ./integration.mjs.
// @ts-ignore: plain JS module shared with tools/slop-check.mjs
import { check, checkAll } from './slop.mjs';

type Json = any;
type Issue = { level: 'error' | 'warn' | 'info'; rule: string; message: string };
type Kind = 'text' | 'area' | 'lines' | 'list';
interface FieldOpts { kind?: Kind; slop?: 'prose' | 'label' | false; max?: number; hint?: string }

const API = '/__os/content';
const HEADERS = { 'X-Site-OS': '1' };
const $ = <T extends Element = HTMLElement>(s: string, root: ParentNode = document) => root.querySelector<T>(s)!;
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

let state: { cv: Json; theme: Record<string, string> };
let snapshot = '';
let tab = sessionStorage.getItem('os-tab') || 'copy';
let device = Number(sessionStorage.getItem('os-device')) || 1440;

const pane = $('[data-pane]');
const statusEl = $('[data-status]');
const saveBtn = $<HTMLButtonElement>('[data-save]');
const iframe = $<HTMLIFrameElement>('[data-iframe]');

/* ---------- state helpers (paths are relative to cv.json, e.g. "projects.1.title") ---------- */
const get = (path: string) => path.split('.').reduce<Json>((o, k) => o?.[k], state.cv);
function set(path: string, value: unknown) {
  const keys = path.split('.');
  const last = keys.pop()!;
  const parent = keys.reduce<Json>((o, k) => o[k], state.cv);
  parent[Array.isArray(parent) ? Number(last) : last] = value;
}
const dirty = () => JSON.stringify(state) !== snapshot;
function setStatus(text: string, cls = '') {
  statusEl.textContent = text;
  statusEl.className = `status ${cls}`;
}
function refreshDirty() {
  const d = dirty();
  saveBtn.disabled = !d;
  if (d) setStatus('Unsaved changes', 'dirty');
  else if (statusEl.classList.contains('dirty')) setStatus('No changes');
}

/* ---------- fields ---------- */
function toValue(kind: Kind, v: Json) {
  if (kind === 'lines') return (v ?? []).join('\n');
  if (kind === 'list') return (v ?? []).join(', ');
  return v ?? '';
}
function fromValue(kind: Kind, raw: string) {
  if (kind === 'lines') return raw.split('\n').map((s) => s.trim()).filter(Boolean);
  if (kind === 'list') return raw.split(',').map((s) => s.trim()).filter(Boolean);
  return raw;
}
function issuesFor(path: string, opts: FieldOpts): Issue[] {
  if (opts.slop === false) return [];
  const v = get(path);
  const texts: string[] = Array.isArray(v) ? v : [v];
  const kind = opts.slop ?? (opts.kind === 'list' ? 'label' : 'prose');
  return texts.flatMap((t) => check(t, { kind }));
}
function flagsHtml(issues: Issue[]) {
  return issues.map((i) => `<div class="flag ${i.level}">${esc(i.message)}</div>`).join('');
}
function field(path: string, label: string, opts: FieldOpts = {}) {
  const kind = opts.kind ?? 'text';
  const value = toValue(kind, get(path));
  const counter = opts.max ? `<em data-count>${String(value).length}/${opts.max}</em>` : '';
  const attrs = `data-path="${esc(path)}" data-kind="${kind}" data-slop="${opts.slop ?? ''}" ${opts.max ? `data-max="${opts.max}"` : ''}`;
  const control = kind === 'area' || kind === 'lines'
    ? `<textarea ${attrs} rows="${kind === 'lines' ? 4 : 3}">${esc(value)}</textarea>`
    : `<input type="text" ${attrs} value="${esc(value)}" />`;
  return `<label class="f" data-field="${esc(path)}"><span>${esc(label)}${counter}</span>${control}
    ${opts.hint ? `<div class="hint">${esc(opts.hint)}</div>` : ''}<div class="flags">${flagsHtml(issuesFor(path, opts))}</div></label>`;
}
const group = (title: string, body: string, extra = '') => `<div class="group"><h2>${esc(title)}${extra}</h2>${body}</div>`;

/* ---------- tabs ---------- */
const tabs: Record<string, () => string> = {
  copy() {
    const cv = state.cv;
    return group('Hero', [
      field('name', 'Name (drawn as particles)', { slop: 'label' }),
      field('headline', 'Headline (page title fallback)', { slop: 'label' }),
      field('site.heroRole', 'Hero line', { kind: 'area', hint: 'The first sentence shows in amber.' }),
      field('site.focus', 'Focus tags', { kind: 'list', hint: 'Comma separated.' }),
    ].join('')) +
    group('About', cv.site.about.map((_: string, i: number) =>
      field(`site.about.${i}`, i === 0 ? 'Statement (first sentence bright)' : `Paragraph ${i + 1}`, { kind: 'area' }) +
      `<div class="row-btns">${cv.site.about.length > 1 ? `<button type="button" data-remove="site.about.${i}">Remove</button>` : ''}</div>`,
    ).join('') + `<div class="row-btns"><button type="button" data-add="site.about">+ Add paragraph</button></div>`) +
    group('Contact', [
      field('site.contactLine', 'Contact line'),
      field('location', 'Location', { slop: 'label' }),
    ].join(''));
  },
  projects() {
    return state.cv.projects.map((p: Json, i: number) => `
      <details class="group" ${i === 0 ? 'open' : ''}>
        <summary>${esc(p.title)}<span>fig.0${i + 1} · ${esc(p.art)}</span></summary>
        ${field(`projects.${i}.title`, 'Title', { slop: 'label' })}
        ${field(`projects.${i}.context`, 'Context', { slop: 'label' })}
        ${field(`projects.${i}.summary`, 'Summary', { kind: 'area' })}
        ${field(`projects.${i}.points`, 'Points', { kind: 'lines', hint: 'One per line.' })}
        ${field(`projects.${i}.tags`, 'Tags', { kind: 'list' })}
        ${field(`projects.${i}.artCaption`, 'Animation caption', { hint: 'The animation itself is code (src/scripts/art.ts).' })}
      </details>`).join('');
  },
  cv() {
    const cv = state.cv;
    return group('Experience', cv.experience.map((_: Json, i: number) => [
      field(`experience.${i}.role`, 'Role', { slop: 'label' }),
      field(`experience.${i}.org`, 'Organisation', { slop: 'label' }),
      field(`experience.${i}.points`, 'Points', { kind: 'lines', hint: 'One per line.' }),
      field(`experience.${i}.tags`, 'Tags', { kind: 'list' }),
    ].join('')).join('<hr class="sep">')) +
    group('Education', cv.education.map((_: Json, i: number) => [
      field(`education.${i}.title`, 'Title', { slop: 'label' }),
      field(`education.${i}.school`, 'School', { slop: 'label' }),
      field(`education.${i}.note`, 'Note', { slop: 'label' }),
    ].join('')).join('')) +
    group('Skills (skills.txt)', cv.skills.map((_: Json, i: number) =>
      field(`skills.${i}.items`, cv.skills[i].group, { kind: 'list' })).join(''));
  },
  design() {
    const t = state.theme;
    const tokens: [string, string, string][] = [
      ['accent', 'Accent', 'Links, highlights, particles in motion'],
      ['bg', 'Background', 'Page'],
      ['surface', 'Surface', 'Panels, cards'],
      ['line', 'Line', 'Borders'],
      ['line2', 'Line 2', 'Stronger borders'],
      ['fg', 'Text', 'Main text'],
      ['soft', 'Soft text', 'Body copy'],
      ['dim', 'Dim text', 'Labels, meta'],
      ['alert', 'Alert', 'Only inside the animations'],
    ];
    const presets: [string, string][] = [['Amber', '#ffb547'], ['Signal green', '#5fe3a1'], ['Ice', '#7cc4ff'], ['Coral', '#ff7a59']];
    return group('Accent presets', `<div class="presets">${presets.map(([n, c]) =>
      `<button type="button" class="mini" data-preset="${c}"><i style="background:${c}"></i>${n}</button>`).join('')}</div>`) +
      group('Colour tokens', tokens.map(([k, label, use]) => `
        <div class="swatch">
          <input type="color" value="${esc(t[k])}" data-token="${k}" aria-label="${esc(label)} colour" />
          <label>${esc(label)}<small>${esc(use)}</small></label>
          <input type="text" value="${esc(t[k])}" data-token-hex="${k}" aria-label="${esc(label)} hex" spellcheck="false" />
        </div>`).join('') +
        '<p class="note">Colours apply to the preview at once. The canvas animations pick them up after Save.</p>') +
      group('Contrast on background (WCAG AA)', `<table class="contrast" data-contrast>${contrastRows()}</table>`);
  },
  seo() {
    const s = state.cv.seo;
    return group('Search and link preview', [
      field('seo.title', 'Page title', { max: 60, slop: 'label' }),
      field('seo.description', 'Description', { kind: 'area', max: 155 }),
    ].join('')) + group('How it looks in search', `
      <div class="serp" data-serp><div class="u">joaodiasworks.com</div><div class="t">${esc(s.title)}</div><div class="d">${esc(s.description)}</div></div>`);
  },
  check() {
    const results = checkAll(state.cv) as { path: string; text: string; issues: Issue[] }[];
    const n = { error: 0, warn: 0, info: 0 };
    results.forEach((r) => r.issues.forEach((i) => n[i.level]++));
    const head = `<div class="summary"><span class="fail">${n.error} errors</span><span style="color:var(--warn)">${n.warn} warnings</span><span style="color:var(--info)">${n.info} notes</span></div>
      <p class="note">Rules from BRAND.md: banned words, no exclamation marks or emoji, sentences under 20 words, at most 6 sentences per paragraph, lists of three, phrasal verbs, AI vocabulary. Same rules as <code>npm run slop</code>.</p>`;
    if (!results.length) return head + '<p class="empty">All copy passes.</p>';
    return head + results.map((r) => `
      <div class="result" data-goto="${esc(r.path)}" tabindex="0" role="button">
        <code>${esc(r.path)}</code><p>${esc(r.text.length > 140 ? r.text.slice(0, 140) + '…' : r.text)}</p>${flagsHtml(r.issues)}
      </div>`).join('');
  },
};

function render() {
  document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  pane.innerHTML = tabs[tab]();
  updateBadge();
}

function updateBadge() {
  const badge = $('[data-badge]');
  const results = checkAll(state.cv) as { issues: Issue[] }[];
  const errors = results.reduce((n, r) => n + r.issues.filter((i) => i.level === 'error').length, 0);
  const warns = results.reduce((n, r) => n + r.issues.filter((i) => i.level === 'warn').length, 0);
  badge.textContent = errors ? String(errors) : warns ? String(warns) : '✓';
  badge.className = `badge ${errors ? 'err' : warns ? 'warn' : 'clean'}`;
}

/* ---------- colour ---------- */
function lum(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return [16, 8, 0].map((s) => (n >> s) & 255).map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
}
const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
function contrastRows() {
  const t = state.theme;
  const rows: [string, string, string, number][] = [
    ['Text on background', t.fg, t.bg, 4.5],
    ['Soft text on background', t.soft, t.bg, 4.5],
    ['Dim text on background', t.dim, t.bg, 4.5],
    ['Accent on background', t.accent, t.bg, 3],
    ['Button text on accent', t.bg, t.accent, 4.5],
    ['Dim text on surface', t.dim, t.surface, 4.5],
  ];
  return rows.map(([label, a, b, need]) => {
    const r = ratio(a, b);
    return `<tr><td>${label}</td><td>${r.toFixed(2)}:1</td><td class="${r >= need ? 'pass' : 'fail'}">${r >= need ? 'pass' : `needs ${need}`}</td></tr>`;
  }).join('');
}
const HEX = /^#[0-9a-f]{6}$/i;
const CSS_VAR: Record<string, string> = { line2: 'line-2' };
function applyToken(k: string, v: string) {
  if (!HEX.test(v)) return;
  state.theme[k] = v.toLowerCase();
  iframe.contentDocument?.documentElement.style.setProperty(`--${CSS_VAR[k] ?? k}`, v);
  pane.querySelectorAll<HTMLInputElement>(`[data-token="${k}"], [data-token-hex="${k}"]`).forEach((el) => { if (el.value !== v) el.value = v; });
  const table = pane.querySelector('[data-contrast]');
  if (table) table.innerHTML = contrastRows();
  refreshDirty();
}

/* ---------- events ---------- */
pane.addEventListener('input', (e) => {
  const el = e.target as HTMLInputElement | HTMLTextAreaElement;
  if (el.dataset.token) return applyToken(el.dataset.token, el.value);
  if (el.dataset.tokenHex) return applyToken(el.dataset.tokenHex, el.value.trim());
  const path = el.dataset.path;
  if (!path) return;
  const kind = (el.dataset.kind || 'text') as Kind;
  set(path, fromValue(kind, el.value));
  const wrap = el.closest('.f')!;
  const opts: FieldOpts = { kind, slop: (el.dataset.slop || undefined) as FieldOpts['slop'] };
  wrap.querySelector('.flags')!.innerHTML = flagsHtml(issuesFor(path, opts));
  const max = Number(el.dataset.max);
  if (max) {
    const c = wrap.querySelector('[data-count]')!;
    c.textContent = `${el.value.length}/${max}`;
    c.classList.toggle('over', el.value.length > max);
  }
  if (path.startsWith('seo.')) {
    const serp = pane.querySelector('[data-serp]');
    if (serp) { $('.t', serp).textContent = state.cv.seo.title; $('.d', serp).textContent = state.cv.seo.description; }
  }
  updateBadge();
  refreshDirty();
});

pane.addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  const preset = t.closest<HTMLElement>('[data-preset]');
  if (preset) return applyToken('accent', preset.dataset.preset!);
  const add = t.closest<HTMLElement>('[data-add]');
  if (add) { (get(add.dataset.add!) as string[]).push(''); render(); return refreshDirty(); }
  const remove = t.closest<HTMLElement>('[data-remove]');
  if (remove) {
    const path = remove.dataset.remove!.split('.');
    const i = Number(path.pop());
    (get(path.join('.')) as unknown[]).splice(i, 1);
    render();
    return refreshDirty();
  }
  const go = t.closest<HTMLElement>('[data-goto]');
  if (go) goTo(go.dataset.goto!);
});
pane.addEventListener('keydown', (e) => {
  const go = (e.target as HTMLElement).closest<HTMLElement>('[data-goto]');
  if (go && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); goTo(go.dataset.goto!); }
});

// From the Check tab to the field: pick the tab that owns the path, then focus it.
function goTo(path: string) {
  const root = path.split('.')[0];
  const owner = root === 'projects' ? 'projects'
    : ['experience', 'education', 'skills'].includes(root) ? 'cv'
    : root === 'seo' ? 'seo' : 'copy';
  tab = owner;
  sessionStorage.setItem('os-tab', tab);
  render();
  // List fields (tags, points) are one control for the whole array.
  const parts = path.split('.');
  const candidates = [path, parts.slice(0, -1).join('.')];
  const control = candidates.map((p) => pane.querySelector<HTMLElement>(`[data-path="${CSS.escape(p)}"]`)).find(Boolean);
  if (!control) return;
  control.closest('details')?.setAttribute('open', '');
  control.scrollIntoView({ block: 'center' });
  control.focus();
  const f = control.closest('.f');
  f?.classList.add('flash');
  setTimeout(() => f?.classList.remove('flash'), 1400);
}

document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => b.addEventListener('click', () => {
  tab = b.dataset.tab!;
  sessionStorage.setItem('os-tab', tab);
  render();
}));

/* ---------- preview ---------- */
const stage = $('[data-stage]');
const frame = $('[data-frame]');
function layoutPreview() {
  const pad = 32;
  const availW = stage.clientWidth - pad;
  const availH = stage.clientHeight - pad;
  const scale = Math.min(1, availW / device);
  // Fill the available height at this scale (the phone view is capped at a real phone's 812 px).
  const h = Math.max(device === 375 ? Math.min(812, availH / scale) : availH / scale, 400);
  frame.style.width = `${device}px`;
  frame.style.height = `${h}px`;
  frame.style.transform = `scale(${scale})`;
  frame.style.marginBottom = `${-(h * (1 - scale))}px`;
  document.querySelectorAll<HTMLButtonElement>('[data-device]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.device) === device)));
}
document.querySelectorAll<HTMLButtonElement>('[data-device]').forEach((b) => b.addEventListener('click', () => {
  device = Number(b.dataset.device);
  sessionStorage.setItem('os-device', String(device));
  layoutPreview();
}));
new ResizeObserver(layoutPreview).observe(stage);
const reloadPreview = () => iframe.contentWindow?.location.reload();
$('[data-reload]').addEventListener('click', reloadPreview);
// Unsaved colour edits survive a preview reload.
iframe.addEventListener('load', () => {
  if (!state) return;
  for (const [k, v] of Object.entries(state.theme)) if (!k.startsWith('_')) iframe.contentDocument?.documentElement.style.setProperty(`--${CSS_VAR[k] ?? k}`, v);
});

/* ---------- load / save ---------- */
async function load() {
  const res = await fetch(API, { headers: HEADERS });
  if (!res.ok) throw new Error(`load failed (${res.status})`);
  state = await res.json();
  snapshot = JSON.stringify(state);
  render();
  refreshDirty();
  const savedAt = sessionStorage.getItem('os-saved');
  setStatus(savedAt ? `Saved ${savedAt}` : 'Loaded from src/content', savedAt ? 'ok' : '');
  sessionStorage.removeItem('os-saved');
}

async function save() {
  if (!dirty()) return;
  setStatus('Saving…');
  const res = await fetch(API, {
    method: 'POST',
    headers: { ...HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify(state),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return setStatus(`Not saved: ${data.error ?? res.status}`, 'bad');
  snapshot = JSON.stringify(state);
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  sessionStorage.setItem('os-saved', time); // the dev server may reload this page too
  setStatus(`Saved ${time}`, 'ok');
  refreshDirty();
  setTimeout(reloadPreview, 500);
}

saveBtn.addEventListener('click', save);
$('[data-revert]').addEventListener('click', async () => {
  if (dirty() && !confirm('Drop unsaved changes?')) return;
  await load();
  reloadPreview();
});
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
});
addEventListener('beforeunload', (e) => { if (state && dirty()) e.preventDefault(); });

layoutPreview();
load().catch((err) => setStatus(String(err.message ?? err), 'bad'));
