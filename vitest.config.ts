import { defineConfig } from 'vitest/config'
import path from 'path'
import dotenv from 'dotenv'

// Load test environment
dotenv.config({ path: '.env.test.local' })

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
})
