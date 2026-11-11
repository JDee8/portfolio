// @ts-check
import { defineConfig } from 'astro/config';
import siteOS from './src/os/integration.mjs';

// https://astro.build/config
export default defineConfig({
  site: 'https://joaodiasworks.com',
  // Website OS: local editor at /os while `npm run dev` runs. Not part of the build.
  integrations: [siteOS()],
  build: {
    // The site's CSS is small (~16 KB), so inline it instead of making the browser wait for extra requests.
    inlineStylesheets: 'always',
  },
});
