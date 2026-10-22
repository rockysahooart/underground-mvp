import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/underground-mvp/',
  plugins: [react()],
  build: { target: 'es2020', cssCodeSplit: true },
  test: { include: ['tests/**/*.test.ts'] },
} as never);
