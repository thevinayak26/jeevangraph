import { mkdir, copyFile, readdir } from 'node:fs/promises';
const root = 'public/scan-assets';
await mkdir(root + '/core', { recursive: true });
await mkdir(root + '/lang', { recursive: true });
await copyFile('node_modules/pdfjs-dist/build/pdf.worker.min.mjs', root + '/pdf.worker.min.mjs');
await copyFile('node_modules/tesseract.js/dist/worker.min.js', root + '/worker.min.js');
for (const file of await readdir('node_modules/tesseract.js-core'))
  if (/\.(wasm|js)$/.test(file) && file.startsWith('tesseract-core'))
    await copyFile('node_modules/tesseract.js-core/' + file, root + '/core/' + file);
await copyFile(
  'node_modules/@tesseract.js-data/eng/4.0.0/eng.traineddata.gz',
  root + '/lang/eng.traineddata.gz',
);
console.log('Same-origin PDF and English OCR assets ready.');
await mkdir(root + '/licenses', { recursive: true });
for (const [pkg, name] of [
  ['pdfjs-dist', 'PDFJS'],
  ['tesseract.js', 'TESSERACT'],
  ['tesseract.js-core', 'TESSERACT_CORE'],
]) {
  try {
    await copyFile('node_modules/' + pkg + '/LICENSE', root + '/licenses/' + name + '.txt');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
