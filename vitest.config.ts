import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    env: { VITE_API_BASE_URL: 'http://localhost:4000' },
  },
});
