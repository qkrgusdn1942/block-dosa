/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // GitHub Pages 같은 하위 경로 배포에서도 동작하도록 상대 경로로 빌드
  base: './',
  plugins: [react()],
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
