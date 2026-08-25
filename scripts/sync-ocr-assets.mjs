import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "public/vendor/tesseract");

const assets = [
  [
    "node_modules/tesseract.js/dist/worker.min.js",
    "worker.min.js",
  ],
  [
    "node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js",
    "core/tesseract-core-lstm.wasm.js",
  ],
  [
    "node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js",
    "core/tesseract-core-simd-lstm.wasm.js",
  ],
  [
    "node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js",
    "core/tesseract-core-relaxedsimd-lstm.wasm.js",
  ],
  [
    "node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz",
    "lang/eng.traineddata.gz",
  ],
];

await Promise.all(assets.map(async ([source, destination]) => {
  const target = resolve(output, destination);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(resolve(root, source), target);
}));
