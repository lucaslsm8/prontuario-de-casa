import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Tauri espera porta fixa e não deve limpar a tela do terminal.
const host = process.env.TAURI_DEV_HOST;

const require = createRequire(import.meta.url);

/**
 * Leitor de texto (OCR) das fotos de resultado: o tesseract.js precisa do worker, do núcleo e do modelo de português
 * com nomes fixos numa pasta (ele escolhe o núcleo pelo aparelho). Este plugin entrega esses arquivos em `/ocr/`,
 * direto do node_modules: no `npm run dev` por um middleware e no build como arquivos do pacote. Nada vem da internet.
 * Só o modo LSTM (oem 1): o worker usa um dos três núcleos "-lstm" conforme o aparelho tenha SIMD.
 */
const ARQUIVOS_OCR: Record<string, string> = {
  'worker.min.js': 'tesseract.js/dist/worker.min.js',
  'tesseract-core-lstm.wasm.js': 'tesseract.js-core/tesseract-core-lstm.wasm.js',
  'tesseract-core-simd-lstm.wasm.js': 'tesseract.js-core/tesseract-core-simd-lstm.wasm.js',
  'tesseract-core-relaxedsimd-lstm.wasm.js': 'tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js',
  'por.traineddata.gz': '@tesseract.js-data/por/4.0.0_best_int/por.traineddata.gz',
};

function ocrLocal(): Plugin {
  const caminho = (nome: string) => require.resolve(ARQUIVOS_OCR[nome]);
  return {
    name: 'ocr-local',
    configureServer(server) {
      server.middlewares.use('/ocr/', (req, res, next) => {
        const nome = (req.url ?? '').replace(/^\//, '').split('?')[0];
        if (!ARQUIVOS_OCR[nome]) return next();
        res.setHeader('Content-Type', nome.endsWith('.js') ? 'text/javascript' : 'application/octet-stream');
        res.end(readFileSync(caminho(nome)));
      });
    },
    generateBundle() {
      for (const nome of Object.keys(ARQUIVOS_OCR)) {
        this.emitFile({ type: 'asset', fileName: `ocr/${nome}`, source: readFileSync(caminho(nome)) });
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), ocrLocal()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: 'ws', host, port: 1421 } : undefined,
    watch: { ignored: ['**/src-tauri/**'] },
  },
  build: {
    target: 'es2021',
    sourcemap: false,
  },
});
