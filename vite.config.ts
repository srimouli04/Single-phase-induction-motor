import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './', // relative asset URLs (the router is hash-based), so dist/ can be hosted from any folder
  server: { host: '127.0.0.1', port: 5173 },
  build: { chunkSizeWarningLimit: 1500 },
  test: { environment: 'node', include: ['src/tests/**/*.test.ts'] },
});
