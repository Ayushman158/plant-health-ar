import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? '/plant-health-ar/' : './',
  plugins: [
    basicSsl(),
  ],
  server: {
    host: '0.0.0.0',
    port: 3002,
    https: true,
  },
});
