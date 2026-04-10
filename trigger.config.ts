import { defineConfig } from '@trigger.dev/sdk/v3'

export default defineConfig({
  project: 'proj_byhmnbhfgddhbxafnecq', // ⚠️ Trigger.dev 대시보드 → Settings → Project ref 로 교체
  dirs: ['./trigger'],
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
    },
  },
})
