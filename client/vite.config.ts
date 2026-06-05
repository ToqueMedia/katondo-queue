import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';

export default defineConfig({
  plugins: [
    react(),
    legacy({
      targets: ['chrome >= 49', 'not IE 11', 'Android >= 5'],
      additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
      polyfills: [
        'es.promise',
        'es.symbol',
        'es.array.includes',
        'es.object.assign',
        'es.object.values',
        'es.object.entries',
        'es.string.starts-with',
        'es.string.ends-with',
        'es.promise.finally',
        'esnext.global-this',
      ],
    }),
  ],
  build: {
    cssTarget: 'chrome61', // Evita compressões de cores CSS modernas que quebram navegadores antigos
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
    },
  },
});
