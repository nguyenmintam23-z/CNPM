import { defineConfig, devices } from '@playwright/test';

/**
 * E2E BrewLite Web (đề 7.2; issue #37; NFR-05).
 * Chạy trên BrewLite Web thật (Docker Compose local với dữ liệu seed), không giả lập API.
 * E2E_BASE_URL đổi được nếu cần chạy ở môi trường khác.
 */
export default defineConfig({
  testDir: '.',
  testMatch: '*.e2e.spec.ts',
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  outputDir: 'test-results',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    // NFR-05: luồng chính trên màn hình rộng 375 px.
    ...devices['iPhone 12'],
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 1, // ảnh minh chứng nhẹ; bề rộng hiển thị vẫn 375 px
    browserName: 'chromium',
    locale: 'vi-VN',
    screenshot: 'on',
    trace: 'on',
  },
});
