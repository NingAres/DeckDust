import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cpSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateRuntimeAssets } from './scripts/runtime-assets.js';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  plugins: [react(), {
    name: 'app-assets',
    buildStart() {
      validateRuntimeAssets();
    },
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        return html.replace(/((?:src|href)="[^"]+\.(?:js|css))(?=")/g, `$1?v=${version}`);
      },
    },
    closeBundle() {
      cpSync('assets', 'web-dist/assets', { recursive: true });
      validateRuntimeAssets('.', 'web-dist');
    },
  }],
  publicDir: false,
  build: { outDir: 'web-dist', emptyOutDir: true },
  server: {
    host: '127.0.0.1',
    proxy: { '/api': 'http://127.0.0.1:18765' },
    fs: { allow: [resolve('.')] },
  },
});

