import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Config riêng cho chế độ WEB (không cần Electron)
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist-web',
    rollupOptions: { input: 'index.html' },
  },
});
