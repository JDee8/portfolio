// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://joaodiasworks.com',
  build: {
    // The site's CSS is small (~16 KB), so inline it instead of making the browser wait for extra requests.
    inlineStylesheets: 'always',
  },
});
