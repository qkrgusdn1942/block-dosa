/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

/** 봇 밸런스 확인 (npm run sim). 평소 테스트(npm test)에는 들어가지 않는다 */
export default defineConfig({
  test: {
    include: ['scripts/**/*.sim.ts'],
    testTimeout: 30 * 60 * 1000,
  },
});
