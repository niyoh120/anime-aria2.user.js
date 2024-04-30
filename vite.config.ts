import { defineConfig } from 'vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import monkey, { cdn } from 'vite-plugin-monkey'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    nodePolyfills({
      include: ['path']
    }),
    monkey({
      entry: 'src/main.ts',
      userscript: {
        namespace: 'https://github.com/niyoh120/userscripts',
        match: ['https://hanime1.me/watch*']
      },
      build: {
        externalGlobals: {
          jsoneditor: cdn.jsdelivr()
        },
        externalResource: {
          'jsoneditor/dist/jsoneditor.min.css': cdn.jsdelivr()
        }
      }
    })
  ]
})
