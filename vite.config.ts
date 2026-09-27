import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite';

/**
 * Mounts the same API the production server uses onto Vite's dev server, so
 * `npm run dev` is the whole app. Server modules are loaded through Vite's SSR
 * loader, so editing server code hot-reloads without restarting.
 */
function partnerUpApi(): Plugin {
  return {
    name: 'partner-up-api',
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => {
        if (!req.url?.startsWith('/api/')) return next();
        server
          .ssrLoadModule('/server/app.ts')
          .then((mod) => (mod as typeof import('./server/app')).apiMiddleware(req, res))
          .then((handled) => {
            if (!handled) next();
          })
          .catch(next);
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Load ALL .env vars into the dev server process (server-side only). Only
  // VITE_-prefixed vars could ever reach the browser, and we define none.
  const env = loadEnv(mode, process.cwd(), '');
  for (const [key, value] of Object.entries(env)) if (process.env[key] === undefined) process.env[key] = value;

  return {
    plugins: [react(), tailwindcss(), partnerUpApi()],
    server: { port: 5173 },
    build: { outDir: 'dist', sourcemap: false, chunkSizeWarningLimit: 700 },
  };
});
