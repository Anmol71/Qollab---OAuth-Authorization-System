import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/auth-api': {
        target: 'http://localhost:3001',
        rewrite: function (path) {
          return path.replace(/^\/auth-api/, '');
        },
        changeOrigin: true
      },
      '/client-api': {
        target: 'http://localhost:3003',
        rewrite: function (path) {
          return path.replace(/^\/client-api/, '');
        },
        changeOrigin: true,
        cookieDomainRewrite: 'localhost'
      }
    }
  }
});
