import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/React_PAC-SAN/' : '/',
  test: { environment: 'node', include: ['src/tests/**/*.test.ts'] },
}));
