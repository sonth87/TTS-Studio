import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: {
    build: {
      outDir: 'dist-electron/main',
      lib: { entry: 'electron/main.ts' },
    },
  },
  preload: {
    build: {
      outDir: 'dist-electron/preload',
      lib: { entry: 'electron/preload.ts' },
    },
  },
  renderer: {
    root: '.',
    build: {
      outDir: 'dist',
      rollupOptions: { input: 'index.html' },
    },
    plugins: [react()],
  },
});
