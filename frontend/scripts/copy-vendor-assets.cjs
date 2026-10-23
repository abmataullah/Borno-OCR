// Copy vendor assets that must be served same-origin (CDNs are unreliable for
// many users, especially in Bangladesh) from node_modules to /public.
//
//  1. tesseract.js worker      → /public/tesseract/worker.min.js
//  2. tesseract.js-core wasm   → /public/tesseract/tesseract-core*.wasm(.js)
//  3. OCR language data        → /public/tesseract/lang/{eng,ben}.traineddata.gz

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const projectRoot = path.join(root, '..'); // workspace root (node_modules is hoisted)
const pub = (...p) => path.join(root, 'public', ...p);
const nm = (...p) => path.join(projectRoot, 'node_modules', ...p);

let copied = 0;
function copy(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn('[vendor-assets] missing:', path.relative(root, src), '— skipped');
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  copied++;
}

// 1. tesseract worker
copy(nm('tesseract.js', 'dist', 'worker.min.js'), pub('tesseract', 'worker.min.js'));

// 2. tesseract core wasm variants (tesseract.js picks the best one at runtime)
const coreDir = nm('tesseract.js-core');
if (fs.existsSync(coreDir)) {
  for (const f of fs.readdirSync(coreDir)) {
    if (f.startsWith('tesseract-core') && (f.endsWith('.wasm') || f.endsWith('.wasm.js'))) {
      copy(path.join(coreDir, f), pub('tesseract', f));
    }
  }
}

// 3. OCR language data (best_int = best accuracy integer models)
for (const lang of ['eng', 'ben']) {
  copy(
    nm('@tesseract.js-data', lang, '4.0.0_best_int', `${lang}.traineddata.gz`),
    pub('tesseract', 'lang', `${lang}.traineddata.gz`),
  );
}

console.log(`[vendor-assets] ${copied} files copied to /public`);
