import { defineConfig, loadEnv } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const target = env['WAISHE_API_TARGET'] || 'http://127.0.0.1:27463';
  return {
    base: './',
    plugins: [preact()],
    build: {
      target: 'es2022',
      outDir: 'dist',
      emptyOutDir: true,
    },
    server: {
      proxy: {
        '/api': { target },
        '/auth': { target },
      },
    },
  };
});
