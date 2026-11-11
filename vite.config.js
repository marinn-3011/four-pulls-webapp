import { defineConfig } from 'vite'

// Relative base so the built site works on GitHub Pages whether it is served
// from a project subpath (user.github.io/repo/) or a user-site root.
export default defineConfig({
  base: './',
  server: {
    port: 4731,
    strictPort: true,
    host: true,
  },
  preview: {
    port: 4731,
    strictPort: true,
    host: true,
  },
})
