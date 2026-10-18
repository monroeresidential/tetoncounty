import { defineConfig } from 'astro/config';
import { siteUrl } from './src/config.ts';
import { localApi } from './scripts/local-api.mjs';

export default defineConfig({
  site: siteUrl,
  output: 'static',
  devToolbar: { enabled: false },
  // Public page links remain slash-terminated; API and data URLs have no trailing slash.
  trailingSlash: 'ignore',
  build: { inlineStylesheets: 'never' },
  server: { host: '127.0.0.1', port: 4321 },
  vite: { plugins: [localApi()] },
});
