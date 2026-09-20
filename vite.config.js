import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

/**
 * onnxruntime-web locates its WASM builds with `new URL(..., import.meta.url)`,
 * so Vite resolves them at build time and emits them as assets — 26 MB of
 * asyncify binary that is never requested, because transformers.js fetches the
 * variant it actually wants at runtime. Drop them from the output.
 */
const stripOrtWasm = {
  name: 'strip-unused-ort-wasm',
  generateBundle(_options, bundle) {
    for (const [file, asset] of Object.entries(bundle)) {
      if (asset.type === 'asset' && /ort-wasm.*\.wasm$/.test(file)) {
        delete bundle[file];
      }
    }
  },
};

export default defineConfig({
  base: './',
  plugins: [
    basicSsl(),
    stripOrtWasm,
  ],
  optimizeDeps: {
    exclude: ['@huggingface/transformers', 'onnxruntime-web'],
  },
  server: {
    host: '0.0.0.0',
    port: 3002,
    https: true,
  },
});
