import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The platform is served under /app/ of the EnsinoLibre site (behind the
// public, zero-build landing + docs + generator). Relative base keeps assets
// working wherever it is mounted.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: 'dist', emptyOutDir: true },
  server: { port: 4180 },
});
