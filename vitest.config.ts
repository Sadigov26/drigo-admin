import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    // Bound concurrent jsdom instances to keep the suite stable on local machines.
    maxWorkers: 2,
    environment: 'jsdom',
    env: { VITE_API_BASE_URL: 'http://localhost:4000' },
  },
});
