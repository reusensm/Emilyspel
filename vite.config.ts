import { defineConfig } from 'vite';

export default defineConfig({
  base: '/Emilyspel/',
  build: {
    outDir: 'dist',
  },
  assetsInclude: ['**/*.enc'],
});
