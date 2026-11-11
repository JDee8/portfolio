// Website OS: a local editor for copy, colours and SEO at /os.
// Idea from Jack Roberts' "AI website building workflow": small edits should not
// cost a full AI rebuild. Dev server only: `astro build` never includes /os or the
// save endpoint, so nothing here reaches the published site.
import { readFile, writeFile } from 'node:fs/promises';

const FILES = {
  cv: new URL('../content/cv.json', import.meta.url),
  theme: new URL('../content/theme.json', import.meta.url),
};
const HEX = /^#[0-9a-f]{6}$/i;
const ENDPOINT = '/__os/content';

function validate(body) {
  const { cv, theme } = body ?? {};
  if (!cv || typeof cv !== 'object' || typeof cv.name !== 'string' || !cv.site || !Array.isArray(cv.projects)) {
    return 'cv.json must keep its shape (name, site, projects…)';
  }
  if (!theme || typeof theme !== 'object') return 'theme.json missing';
  for (const [k, v] of Object.entries(theme)) {
    if (!k.startsWith('_') && !HEX.test(v)) return `theme.${k} must be a 6-digit hex colour`;
  }
  return null;
}

function savePlugin() {
  return {
    name: 'site-os-save',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(ENDPOINT, async (req, res) => {
        const send = (code, data) => {
          res.statusCode = code;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(data));
        };
        // Only this dev server's own pages may call it: no cross-site requests.
        const host = req.headers.host ?? '';
        const origin = req.headers.origin;
        let sameOrigin = true;
        if (origin) { try { sameOrigin = new URL(origin).host === host; } catch { sameOrigin = false; } }
        if (!sameOrigin) return send(403, { error: 'cross-origin request refused' });
        if (req.headers['x-site-os'] !== '1') return send(403, { error: 'missing X-Site-OS header' });

        if (req.method === 'GET') {
          const [cv, theme] = await Promise.all([readFile(FILES.cv, 'utf8'), readFile(FILES.theme, 'utf8')]);
          return send(200, { cv: JSON.parse(cv), theme: JSON.parse(theme) });
        }
        if (req.method === 'POST') {
          if (!String(req.headers['content-type']).startsWith('application/json')) return send(415, { error: 'JSON only' });
          let raw = '';
          for await (const chunk of req) {
            raw += chunk;
            if (raw.length > 512_000) return send(413, { error: 'too large' });
          }
          let body;
          try { body = JSON.parse(raw); } catch { return send(400, { error: 'invalid JSON' }); }
          const problem = validate(body);
          if (problem) return send(422, { error: problem });
          await writeFile(FILES.cv, JSON.stringify(body.cv, null, 2) + '\n');
          await writeFile(FILES.theme, JSON.stringify(body.theme, null, 2) + '\n');
          return send(200, { ok: true, savedAt: new Date().toISOString() });
        }
        return send(405, { error: 'GET or POST' });
      });
    },
  };
}

export default function siteOS() {
  return {
    name: 'site-os',
    hooks: {
      'astro:config:setup': ({ command, injectRoute, updateConfig, logger }) => {
        if (command !== 'dev') return;
        injectRoute({ pattern: '/os', entrypoint: new URL('./OS.astro', import.meta.url), prerender: true });
        updateConfig({ vite: { plugins: [savePlugin()] } });
        logger.info('Website OS at /os (dev only)');
      },
    },
  };
}
