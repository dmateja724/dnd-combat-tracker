import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));

export default defineConfig(() => {
  const appVersion = process.env.VITE_APP_VERSION ?? process.env.APP_VERSION ?? packageJson.version;

  return {
    plugins: [
      react(),
      {
        name: 'inject-app-version-meta',
        transformIndexHtml() {
          return {
            tags: [
              {
                tag: 'meta',
                attrs: { name: 'app-version', content: appVersion },
                injectTo: 'head'
              }
            ]
          };
        }
      }
    ],
    define: {
      __APP_VERSION__: JSON.stringify(appVersion)
    },
    server: {
      open: true,
      proxy: {
        '/api': {
          target: 'http://localhost:4000',
          changeOrigin: true
        }
      }
    },
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      css: true,
      globals: true,
      coverage: {
        provider: 'v8'
      }
    }
  };
});
