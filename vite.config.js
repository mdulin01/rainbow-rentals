import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'

// CLI deployments upload source without the Git directory.
let gitHash = (process.env.BUILD_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7)
if (!gitHash) {
  try {
    gitHash = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    gitHash = 'unknown'
  }
}
const buildTime = new Date().toISOString()

export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_HASH__: JSON.stringify(gitHash),
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
