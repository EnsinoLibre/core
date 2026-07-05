import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Basic Vite config. Nothing fancy yet: just the React plugin.
// We'll add path aliases here once the blocks and design-system
// packages are linked as real workspace dependencies.
export default defineConfig({
  plugins: [react()],
})
