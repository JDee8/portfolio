// Copy checker ("slop monster"), shared by the Website OS and `npm run slop`.
// Rules come from BRAND.md (banned words, no exclamation marks or emoji, no
// lists of three by default, ASD-STE100 sentence limits) plus common AI tells.
// Levels: error = breaks a brand rule, warn = probably fix, info = look at it.

/** Words BRAND.md bans outright. */
export const BANNED = [
  'passionate', 'leverage', 'seamless', 'cutting-edge', 'robust', 'innovative', 'delve',
  'journey', 'elevate', 'unlock', 'synergy', 'tapestry',
];

/** Words that make copy read as AI-written. Not banned, but flagged. */
export const AI_TELLS = [
  'empower', 'harness', 'realm', 'landscape', 'testament', 'foster', 'vibrant', 'meticulous',
  'pivotal', 'embark', 'furthermore', 'moreover', 'unleash', 'game-changer', 'spearhead',
  'holistic', 'streamline', 'navigate', 'dynamic', 'ever-evolving', 'in today', 'world-class',
  'state-of-the-art', 'best-in-class', 'paradigm', 'transformative', 'supercharge', 'thrive',
];

/** Fillers that add nothing. */
const FILLERS = ['really', 'very', 'truly', 'genuinely', 'honestly', 'actually', 'basically', 'just'];

/** Phrasal verbs with a single-verb replacement (ASD-STE100). */
const PHRASAL = {
  'set up': 'configure / install', 'carry out': 'do / run', 'find out': 'learn / discover',
  'figure out': 'find / solve', 'come up with': 'design / create', 'look into': 'examine',
  'put in place': 'implement', 'take care of': 'manage', 'make use of': 'use', 'go through': 'review',
  'bring about': 'cause', 'point out': 'show', 'build up': 'build', 'roll out': 'deploy',
};

const MAX_WORDS = 20;      // descriptions: under 20 words per sentence (BRAND.md)
const MAX_SENTENCES = 6;   // per paragraph
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const word = (w) => new RegExp(`\\b${esc(w)}\\w*`, 'i');
const EMOJI = /\p{Extended_Pictographic}/u;
const ITEM = "[\\p{L}\\p{N}+#/'.-]+(?: [\\p{L}\\p{N}+#/'.-]+){0,2}";
// Exactly three items: "A, B and C" (not part of a longer list).
const TRIPLE = new RegExp(`(?<!, )(?<![\\p{L}\\p{N}] )\\b(${ITEM}), (${ITEM}),? (and|or) (${ITEM})`, 'u');

export function sentences(text) {
  return text.split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/).map((s) => s.trim()).filter(Boolean);
}

/**
 * Check one piece of copy.
 * @param {string} text
 * @param {{ kind?: 'prose' | 'label' }} [opts] labels (tags, titles) skip sentence rules
 * @returns {{ level: 'error'|'warn'|'info', rule: string, message: string }[]}
 */
export function check(text, opts = {}) {
  const out = [];
  if (!text || typeof text !== 'string') return out;
  const add = (level, rule, message) => out.push({ level, rule, message });
  const lower = text.toLowerCase();

  for (const w of BANNED) if (word(w).test(text)) add('error', 'banned-word', `"${w}" is on the banned list`);
  for (const w of AI_TELLS) if (lower.includes(w) && word(w.split(' ')[0]).test(text)) add('warn', 'ai-vocabulary', `"${w}" reads as AI-written`);
  if (text.includes('!')) add('error', 'exclamation', 'No exclamation marks');
  if (EMOJI.test(text)) add('error', 'emoji', 'No emoji');
  if (/^\s*I'?\s?a?m an? .{0,40}\bwho (loves?|enjoys?|is passionate)/i.test(text)) add('error', 'opener', 'No "I\'m a ___ who loves ___" openers');
  if (text.includes('—')) add('info', 'em-dash', 'Em dash: often an AI tell. A full stop or comma usually works');

  if (opts.kind === 'label') return out;

  for (const f of FILLERS) if (new RegExp(`\\b${f}\\b`, 'i').test(text)) add('warn', 'filler', `"${f}" adds nothing`);
  for (const [p, alt] of Object.entries(PHRASAL)) {
    if (new RegExp(`\\b${p.replace(' ', '\\w* ')}\\b`, 'i').test(text)) add('warn', 'phrasal-verb', `"${p}": try "${alt}"`);
  }
  const all = sentences(text);
  all.forEach((s) => {
    const n = s.split(/\s+/).filter(Boolean).length;
    if (n > MAX_WORDS) add('warn', 'long-sentence', `${n} words: "${s.slice(0, 48)}…" (limit ${MAX_WORDS})`);
    if (/\b(is|are|was|were|been|being)\s+(\w+ed|built|made|done|given|shown|run|set)\b/i.test(s)) add('info', 'passive', `Passive voice? "${s.slice(0, 48)}…"`);
  });
  if (all.length > MAX_SENTENCES) add('warn', 'long-paragraph', `${all.length} sentences (limit ${MAX_SENTENCES})`);
  const t = text.match(TRIPLE);
  if (t) add('info', 'rule-of-three', `List of three: "${t[0]}". Keep it only if there really are three`);
  return out;
}

// Keys that hold data, not copy.
const SKIP = new Set(['_about', '_review', 'email', 'linkedin', 'github', 'art', 'id', 'start', 'end', 'date', 'status', 'level']);
const LABEL_KEYS = new Set(['tags', 'items', 'focus', 'knowledgeLevel', 'compliance', 'name', 'title', 'role', 'org', 'location', 'school', 'issuer', 'group', 'context', 'note', 'headline']);

/** Every copy string in cv.json with its path, e.g. ["projects.1.summary", "Segmented…", "prose"]. */
export function copyFields(cv) {
  const fields = [];
  const walk = (v, path, key) => {
    if (SKIP.has(key)) return;
    if (typeof v === 'string') {
      if (/^(https?:|mailto:)|@|^\d{4}(-\d{2})?$/.test(v)) return;
      fields.push([path, v, LABEL_KEYS.has(key) || LABEL_KEYS.has(path.split('.').slice(-2, -1)[0]) ? 'label' : 'prose']);
    } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}.${i}`, key));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, path ? `${path}.${k}` : k, k);
  };
  walk(cv, '', '');
  return fields;
}

/** Check the whole content file. */
export function checkAll(cv) {
  return copyFields(cv)
    .map(([path, text, kind]) => ({ path, text, issues: check(text, { kind }) }))
    .filter((r) => r.issues.length);
}
