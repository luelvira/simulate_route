import { defineConfig } from 'vite';

/** Development server: the planning API runs in `pnpm server` on port 3000. */
export default defineConfig({
  server: { proxy: { '/api': 'http://localhost:3000' } },
});
